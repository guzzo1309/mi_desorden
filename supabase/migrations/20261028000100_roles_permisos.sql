-- Roles owner / admin / employee con sus permisos en la tabla roles.
--
-- Reemplaza el catálogo de 20261028000000_roles.sql y el tipo public.rol
-- (dueño / editor / lector). Ahora:
--   - roles(id numérico, rol, descripcion, permisos…): cada permiso es una
--     columna booleana de la fila del rol.
--   - miembros.rol_id e invitaciones.rol_id → roles.id (el rol es por
--     inventario: se puede ser owner de uno y employee de otro).
--   - Las políticas preguntan por permisos con public.puede(inventario,
--     'permiso'), no por nombres de rol.
--
-- Permisos:
--   permiso               owner  admin  employee
--   ver                     ✓      ✓       ✓
--   ajustar_stock           ✓      ✓       ✓    (solo la cantidad)
--   editar_productos        ✓      ✓            (crear/editar/borrar, categorías, facturas)
--   gestionar_fotos         ✓      ✓
--   gestionar_accesos       ✓      ✓            (el admin solo maneja employees)
--   eliminar_inventario     ✓
--
-- Los miembros actuales pasan: dueño → owner, editor → admin, lector → employee.

-- ---------------------------------------------------------------------------
-- 1. Fuera las políticas que usan el rol viejo (se recrean al final)
--
-- Con "if exists": funciona esté o no aplicada 20261027000300_fotos_solo_dueno.
-- ---------------------------------------------------------------------------

drop policy if exists "dueño edita inventario" on public.inventarios;
drop policy if exists "dueño borra inventario" on public.inventarios;
drop policy if exists "dueño cambia roles" on public.miembros;
drop policy if exists "dueño quita o uno se va" on public.miembros;
drop policy if exists "crear productos" on public.productos;
drop policy if exists "editar productos" on public.productos;
drop policy if exists "borrar productos" on public.productos;
drop policy if exists "crear categorias" on public.categorias;
drop policy if exists "editar categorias" on public.categorias;
drop policy if exists "borrar categorias" on public.categorias;
drop policy if exists "dueño ve invitaciones" on public.invitaciones;
drop policy if exists "dueño cancela invitaciones" on public.invitaciones;
drop policy if exists "productos: el dueño sube fotos" on storage.objects;
drop policy if exists "productos: el dueño reemplaza fotos" on storage.objects;
drop policy if exists "productos: el dueño borra fotos" on storage.objects;
-- Si no se aplicó 20261027000300_fotos_solo_dueno, siguen las de 20261006.
drop policy if exists "productos: subir fotos" on storage.objects;
drop policy if exists "productos: reemplazar fotos" on storage.objects;
drop policy if exists "productos: borrar fotos" on storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Tabla roles nueva
-- ---------------------------------------------------------------------------

alter table public.miembros drop constraint if exists miembros_rol_fkey;
alter table public.invitaciones drop constraint if exists invitaciones_rol_fkey;
drop table if exists public.roles;

create table public.roles (
  -- Ids fijos: las funciones de abajo buscan los roles por nombre, no por id.
  id smallint primary key,
  rol text not null unique check (rol ~ '^[a-z_]{2,30}$'),
  descripcion text not null default '',
  ver boolean not null default true,
  ajustar_stock boolean not null default false,
  editar_productos boolean not null default false,
  gestionar_fotos boolean not null default false,
  gestionar_accesos boolean not null default false,
  eliminar_inventario boolean not null default false
);

comment on table public.roles is
  'Roles de un inventario y sus permisos. Las políticas leen los permisos con public.puede().';

insert into public.roles
  (id, rol, descripcion, ver, ajustar_stock, editar_productos, gestionar_fotos, gestionar_accesos, eliminar_inventario)
values
  (1, 'owner', 'Creó el inventario: control total, incluido borrarlo y nombrar admins.',
   true, true, true, true, true, true),
  (2, 'admin', 'Maneja productos, categorías, fotos, facturas y a los employees.',
   true, true, true, true, true, false),
  (3, 'employee', 'Ve el inventario y ajusta el stock. Para agregar o borrar productos le pide a un admin.',
   true, true, false, false, false, false);

alter table public.roles enable row level security;
create policy "ver roles" on public.roles for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. miembros.rol_id e invitaciones.rol_id
-- ---------------------------------------------------------------------------

alter table public.miembros add column rol_id smallint references public.roles (id);
update public.miembros
set rol_id = case rol::text when 'dueño' then 1 when 'editor' then 2 else 3 end;
alter table public.miembros alter column rol_id set not null;
alter table public.miembros alter column rol_id set default 3; -- employee
alter table public.miembros drop column rol;

alter table public.invitaciones add column rol_id smallint references public.roles (id);
update public.invitaciones
set rol_id = case rol::text when 'editor' then 2 else 3 end;
alter table public.invitaciones alter column rol_id set not null;
alter table public.invitaciones drop column rol;

-- ---------------------------------------------------------------------------
-- 4. Fuera las funciones y el tipo viejos
-- ---------------------------------------------------------------------------

drop function public.rol_en(uuid);
drop function if exists public.invitar_miembro(uuid, text, public.rol);
drop function public.invitar(uuid, text, public.rol);
drop function if exists public.puede_editar_carpeta(text);
drop function if exists public.es_dueno_carpeta(text);
drop type public.rol;

-- ---------------------------------------------------------------------------
-- 5. Funciones de permisos
-- ---------------------------------------------------------------------------

-- Id de un rol por su nombre ('owner', 'admin', 'employee').
create function public.rol_id(nombre text)
returns smallint
language sql stable security definer set search_path = ''
as $$
  select id from public.roles where rol = nombre
$$;

-- Mi rol en un inventario (null si no soy miembro).
create function public.mi_rol_id(inv uuid)
returns smallint
language sql stable security definer set search_path = ''
as $$
  select rol_id from public.miembros where inventario_id = inv and usuario_id = auth.uid()
$$;

-- ¿Tengo este permiso en el inventario? Un permiso que no existe da false.
create function public.puede(inv uuid, permiso text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case permiso
      when 'ver' then r.ver
      when 'ajustar_stock' then r.ajustar_stock
      when 'editar_productos' then r.editar_productos
      when 'gestionar_fotos' then r.gestionar_fotos
      when 'gestionar_accesos' then r.gestionar_accesos
      when 'eliminar_inventario' then r.eliminar_inventario
      else false
    end
    from public.miembros m
    join public.roles r on r.id = m.rol_id
    where m.inventario_id = inv and m.usuario_id = auth.uid()
  ), false)
$$;

-- ¿Puedo dar (o quitar) este rol? El owner maneja admins y employees; un
-- admin, solo employees. El rol owner no se asigna nunca.
create function public.puede_asignar(inv uuid, rol_objetivo smallint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when rol_objetivo = public.rol_id('owner') then false
    when public.mi_rol_id(inv) = public.rol_id('owner') then true
    when public.puede(inv, 'gestionar_accesos') then rol_objetivo = public.rol_id('employee')
    else false
  end
$$;

-- Permisos sobre la carpeta de Storage de un inventario (<inventario_id>/…).
create function public.puede_fotos_carpeta(ruta text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when split_part(ruta, '/', 1) ~ '^[0-9a-f-]{36}$'
      then public.puede(split_part(ruta, '/', 1)::uuid, 'gestionar_fotos')
    else false
  end
$$;

revoke execute on function public.rol_id(text) from public, anon;
revoke execute on function public.mi_rol_id(uuid) from public, anon;
revoke execute on function public.puede(uuid, text) from public, anon;
revoke execute on function public.puede_asignar(uuid, smallint) from public, anon;
revoke execute on function public.puede_fotos_carpeta(text) from public, anon;
grant execute on function public.rol_id(text) to authenticated;
grant execute on function public.mi_rol_id(uuid) to authenticated;
grant execute on function public.puede(uuid, text) to authenticated;
grant execute on function public.puede_asignar(uuid, smallint) to authenticated;
grant execute on function public.puede_fotos_carpeta(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funciones que asignaban roles
-- ---------------------------------------------------------------------------

-- Quien crea un inventario queda como owner.
create or replace function public.agregar_dueno()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.miembros (inventario_id, usuario_id, rol_id)
  values (new.id, new.creado_por, public.rol_id('owner'));
  return new;
end;
$$;

-- invitar(): miembro directo si el correo tiene cuenta, si no invitación
-- pendiente. nuevo_rol es el nombre del rol ('admin' o 'employee').
create function public.invitar(inv uuid, correo text, nuevo_rol text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  limpio text := lower(trim(correo));
  objetivo smallint := public.rol_id(nuevo_rol);
  invitado uuid;
begin
  if not public.puede(inv, 'gestionar_accesos') then
    raise exception 'No tenés permiso para invitar' using errcode = '42501';
  end if;
  if objetivo is null then
    raise exception 'Ese rol no existe' using errcode = '22023';
  end if;
  if not public.puede_asignar(inv, objetivo) then
    raise exception 'No podés dar el rol %', nuevo_rol using errcode = '42501';
  end if;
  if limpio !~ '^\S+@\S+\.\S+$' then
    raise exception 'El correo no es válido' using errcode = '22023';
  end if;

  select id into invitado from public.perfiles where email = limpio;

  if invitado is not null then
    insert into public.miembros (inventario_id, usuario_id, rol_id)
    values (inv, invitado, objetivo)
    on conflict (inventario_id, usuario_id) do update set rol_id = excluded.rol_id
      -- No se puede pisar al owner ni a alguien que yo no podría manejar.
      where public.puede_asignar(inv, public.miembros.rol_id);
    delete from public.invitaciones where inventario_id = inv and email = limpio;
    return 'miembro';
  end if;

  insert into public.invitaciones (inventario_id, email, rol_id, invitado_por)
  values (inv, limpio, objetivo, auth.uid())
  on conflict (inventario_id, email) do update set rol_id = excluded.rol_id, creado_en = now();
  return 'pendiente';
end;
$$;

revoke execute on function public.invitar(uuid, text, text) from public, anon;
grant execute on function public.invitar(uuid, text, text) to authenticated;

-- Al confirmar el correo, las invitaciones pendientes pasan a ser accesos.
create or replace function public.aceptar_invitaciones()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.miembros (inventario_id, usuario_id, rol_id)
  select i.inventario_id, new.id, i.rol_id
  from public.invitaciones i
  where i.email = lower(new.email)
  on conflict (inventario_id, usuario_id) do nothing;

  delete from public.invitaciones where email = lower(new.email);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Productos: el employee solo cambia la cantidad
-- ---------------------------------------------------------------------------

-- Quien solo puede ajustar stock no toca nada más del producto. La política de
-- update deja entrar con ajustar_stock; esto frena el resto de los campos.
create function public.proteger_producto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, service role) no se restringe.
  if auth.uid() is not null
    and not public.puede(old.inventario_id, 'editar_productos')
    and (to_jsonb(new) - array['cantidad', 'fuente', 'actualizado_en'])
      is distinct from (to_jsonb(old) - array['cantidad', 'fuente', 'actualizado_en'])
  then
    raise exception 'Tu rol solo puede ajustar el stock: pedile a un admin el resto de los cambios'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger al_proteger_producto
  before update on public.productos
  for each row execute function public.proteger_producto();

-- La foto: solo con gestionar_fotos.
create or replace function public.proteger_foto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
    and new.foto_path is distinct from old.foto_path
    and not public.puede(new.inventario_id, 'gestionar_fotos')
  then
    raise exception 'Tu rol no puede cambiar las fotos de los productos' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists al_cambiar_foto on public.productos;
create trigger al_cambiar_foto
  before update of foto_path on public.productos
  for each row execute function public.proteger_foto();

-- Facturas: con editar_productos (misma función que 20261027000100, otro chequeo).
create or replace function public.cargar_productos(inv uuid, lineas jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  linea record;
  fila public.productos;
  existente uuid;
  resultado jsonb := '[]'::jsonb;
begin
  if not public.puede(inv, 'editar_productos') then
    raise exception 'No tenés permiso para cargar productos en este inventario'
      using errcode = '42501';
  end if;
  if jsonb_typeof(lineas) is distinct from 'array' or jsonb_array_length(lineas) = 0 then
    raise exception 'La factura no tiene productos' using errcode = '22023';
  end if;
  if jsonb_array_length(lineas) > 200 then
    raise exception 'Máximo 200 productos por factura' using errcode = '22023';
  end if;

  -- Las líneas repetidas en la misma factura se suman antes de tocar la tabla.
  for linea in
    select min(trim(l ->> 'nombre')) as nombre, sum((l ->> 'cantidad')::integer) as cantidad
    from jsonb_array_elements(lineas) as l
    group by lower(trim(l ->> 'nombre'))
  loop
    if linea.nombre is null or char_length(linea.nombre) not between 1 and 120 then
      raise exception 'Hay un producto sin nombre o con un nombre muy largo' using errcode = '22023';
    end if;
    if linea.cantidad is null or linea.cantidad <= 0 then
      raise exception 'La cantidad de “%” tiene que ser mayor que cero', linea.nombre
        using errcode = '22023';
    end if;

    select id into existente from public.productos
    where inventario_id = inv and lower(trim(nombre)) = lower(linea.nombre)
    order by creado_en
    limit 1;

    if existente is not null then
      update public.productos
      set cantidad = cantidad + linea.cantidad, fuente = 'manual'
      where id = existente
      returning * into fila;
      resultado := resultado || jsonb_build_object('producto', to_jsonb(fila), 'nuevo', false);
    else
      insert into public.productos (inventario_id, nombre, cantidad, fuente, por_revisar)
      values (inv, linea.nombre, linea.cantidad, 'manual', true)
      returning * into fila;
      resultado := resultado || jsonb_build_object('producto', to_jsonb(fila), 'nuevo', true);
    end if;
  end loop;

  return resultado;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Políticas con permisos
-- ---------------------------------------------------------------------------

-- inventarios: el owner lo renombra y lo borra.
create policy "owner edita inventario" on public.inventarios for update to authenticated
  using (public.puede(id, 'eliminar_inventario'));
create policy "owner borra inventario" on public.inventarios for delete to authenticated
  using (public.puede(id, 'eliminar_inventario'));

-- miembros: se cambia o se quita a quien yo puedo manejar (nunca al owner).
-- Cualquiera se puede ir, menos el owner.
create policy "cambiar roles" on public.miembros for update to authenticated
  using (public.puede_asignar(inventario_id, rol_id))
  with check (public.puede_asignar(inventario_id, rol_id));
create policy "quitar acceso o irse" on public.miembros for delete to authenticated
  using (
    rol_id <> public.rol_id('owner')
    and (usuario_id = auth.uid() or public.puede_asignar(inventario_id, rol_id))
  );

-- productos: crear y borrar con editar_productos; actualizar con ajustar_stock
-- (el trigger proteger_producto frena lo que no sea la cantidad).
create policy "crear productos" on public.productos for insert to authenticated
  with check (public.puede(inventario_id, 'editar_productos'));
create policy "editar productos" on public.productos for update to authenticated
  using (public.puede(inventario_id, 'ajustar_stock'))
  with check (public.puede(inventario_id, 'ajustar_stock'));
create policy "borrar productos" on public.productos for delete to authenticated
  using (public.puede(inventario_id, 'editar_productos'));

-- categorias
create policy "crear categorias" on public.categorias for insert to authenticated
  with check (public.puede(inventario_id, 'editar_productos'));
create policy "editar categorias" on public.categorias for update to authenticated
  using (public.puede(inventario_id, 'editar_productos'))
  with check (public.puede(inventario_id, 'editar_productos'));
create policy "borrar categorias" on public.categorias for delete to authenticated
  using (public.puede(inventario_id, 'editar_productos'));

-- invitaciones pendientes
create policy "ver invitaciones" on public.invitaciones for select to authenticated
  using (public.puede(inventario_id, 'gestionar_accesos'));
create policy "cancelar invitaciones" on public.invitaciones for delete to authenticated
  using (public.puede_asignar(inventario_id, rol_id));

-- Storage: fotos con gestionar_fotos (ver sigue igual: puede_ver_carpeta).
create policy "productos: subir fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.puede_fotos_carpeta(name));
create policy "productos: reemplazar fotos" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.puede_fotos_carpeta(name))
  with check (bucket_id = 'productos' and public.puede_fotos_carpeta(name));
create policy "productos: borrar fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.puede_fotos_carpeta(name));

-- Realtime: la tabla de roles no se escucha (cambia solo por migraciones).
