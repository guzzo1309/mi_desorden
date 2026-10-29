-- Roles definitivos: owner / editor / lector por inventario y admin de plataforma.
--
-- Deja el repo igual a lo que ya está en Supabase (se aplicó a mano el
-- 28/10 sin migración) y suma lo que faltaba para las facturas.
--
--   rol      ámbito       ver  stock  productos  fotos  accesos  borrar inv.
--   owner    inventario    ✓     ✓        ✓        ✓       ✓         ✓
--   editor   inventario    ✓     ✓        ✓
--   lector   inventario    ✓
--   admin    plataforma   (no es rol de inventario: KPIs, tokens y tiers de
--                          MI DESORDEN; va en perfiles.rol_id)
--
-- Los miembros que había pasan: admin (de inventario) → editor, employee → lector.
--
-- Se puede correr sobre la base después de 20261028000200 o sobre la de
-- Supabase tal como está: todo es "if not exists" / "or replace".

begin;

-- ---------------------------------------------------------------------------
-- 1. roles.ambito
-- ---------------------------------------------------------------------------

alter table public.roles add column if not exists ambito text not null default 'inventario';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roles_ambito_check') then
    alter table public.roles
      add constraint roles_ambito_check check (ambito in ('inventario', 'plataforma'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Los cuatro roles con sus permisos
-- ---------------------------------------------------------------------------

insert into public.roles
  (rol, ambito, descripcion, ver, ajustar_stock, editar_productos, gestionar_fotos, gestionar_accesos, eliminar_inventario)
values
  ('owner', 'inventario',
   'Dueño de sus inventarios: todo, incluido sacar fotos, invitar empleados y borrar el inventario.',
   true, true, true, true, true, true),
  ('editor', 'inventario',
   'Empleado que ajusta el stock y edita productos, categorías y facturas.',
   true, true, true, false, false, false),
  ('lector', 'inventario',
   'Empleado que solo mira el inventario. Los cambios se los pide al owner.',
   true, false, false, false, false, false)
on conflict (rol) do update set
  ambito = excluded.ambito,
  descripcion = excluded.descripcion,
  ver = excluded.ver,
  ajustar_stock = excluded.ajustar_stock,
  editar_productos = excluded.editar_productos,
  gestionar_fotos = excluded.gestionar_fotos,
  gestionar_accesos = excluded.gestionar_accesos,
  eliminar_inventario = excluded.eliminar_inventario;

-- Miembros e invitaciones con los roles viejos (si quedaba alguno).
update public.miembros set rol_id = public.rol_id('editor') where rol_id = public.rol_id('admin');
update public.invitaciones set rol_id = public.rol_id('editor') where rol_id = public.rol_id('admin');
update public.miembros set rol_id = public.rol_id('lector') where rol_id = public.rol_id('employee');
update public.invitaciones set rol_id = public.rol_id('lector') where rol_id = public.rol_id('employee');
delete from public.roles where rol = 'employee';

-- admin pasa a ser el rol de plataforma (sin permisos sobre inventarios).
insert into public.roles
  (rol, ambito, descripcion, ver, ajustar_stock, editar_productos, gestionar_fotos, gestionar_accesos, eliminar_inventario)
values
  ('admin', 'plataforma', 'Administrador de MI DESORDEN: KPIs, rendimiento, tokens y tiers.',
   false, false, false, false, false, false)
on conflict (rol) do update set
  ambito = excluded.ambito,
  descripcion = excluded.descripcion,
  ver = excluded.ver,
  ajustar_stock = excluded.ajustar_stock,
  editar_productos = excluded.editar_productos,
  gestionar_fotos = excluded.gestionar_fotos,
  gestionar_accesos = excluded.gestionar_accesos,
  eliminar_inventario = excluded.eliminar_inventario;

-- Un miembro nuevo sin rol explícito es lector.
alter table public.miembros alter column rol_id set default public.rol_id('lector');

-- ---------------------------------------------------------------------------
-- 3. Rol de plataforma en el perfil
-- ---------------------------------------------------------------------------

alter table public.perfiles add column if not exists rol_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_rol_id_fkey') then
    alter table public.perfiles
      add constraint perfiles_rol_id_fkey foreign key (rol_id) references public.roles (id);
  end if;
end;
$$;

comment on column public.perfiles.rol_id is
  'Rol de plataforma (admin) o null. Se asigna solo desde el SQL Editor, nunca desde la app.';

-- ¿Soy admin de MI DESORDEN?
create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    join public.roles r on r.id = p.rol_id
    where p.id = auth.uid() and r.rol = 'admin'
  )
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- El rol de plataforma no se cambia desde la app, y solo puede ser uno de plataforma.
create or replace function public.proteger_rol_perfil()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.rol_id is not distinct from old.rol_id then
    return new;
  end if;
  -- Con sesión (la app) nadie se cambia el rol: ni siquiera el propio perfil.
  if auth.uid() is not null then
    raise exception 'El rol de plataforma no se cambia desde la app' using errcode = '42501';
  end if;
  if new.rol_id is not null and not exists (
    select 1 from public.roles where id = new.rol_id and ambito = 'plataforma'
  ) then
    raise exception 'Ese rol no es de plataforma' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists al_cambiar_rol_perfil on public.perfiles;
create trigger al_cambiar_rol_perfil
  before update of rol_id on public.perfiles
  for each row execute function public.proteger_rol_perfil();

-- El correo del perfil tampoco se cambia desde la app (lo maneja Auth).
create or replace function public.proteger_email_perfil()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, service role, triggers de Auth) no se restringe.
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'El correo no se cambia desde la app' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists al_cambiar_email_perfil on public.perfiles;
create trigger al_cambiar_email_perfil
  before update of email on public.perfiles
  for each row execute function public.proteger_email_perfil();

-- ---------------------------------------------------------------------------
-- 4. Miembros e invitaciones solo con roles de inventario
-- ---------------------------------------------------------------------------

create or replace function public.validar_rol_inventario()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.roles where id = new.rol_id and ambito = 'inventario'
  ) then
    raise exception 'Ese rol no es de inventario' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists al_guardar_rol_miembro on public.miembros;
create trigger al_guardar_rol_miembro
  before insert or update of rol_id on public.miembros
  for each row execute function public.validar_rol_inventario();

drop trigger if exists al_guardar_rol_invitacion on public.invitaciones;
create trigger al_guardar_rol_invitacion
  before insert or update of rol_id on public.invitaciones
  for each row execute function public.validar_rol_inventario();

-- Solo el owner da, cambia o quita roles, y solo editor o lector.
create or replace function public.puede_asignar(inv uuid, rol_objetivo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.mi_rol_id(inv) = public.rol_id('owner')
    and rol_objetivo in (public.rol_id('editor'), public.rol_id('lector'))
$$;

-- Mensaje acorde a los roles nuevos (antes decía "pedile a un admin").
create or replace function public.proteger_producto()
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
    raise exception 'Tu rol solo puede ajustar el stock: pedile el resto de los cambios al owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Productos de una factura por revisar (faltaba en Supabase)
--
-- Lo mismo que 20261027000100 y 20261027000200: cargar_productos() crea lo
-- nuevo con por_revisar = true y deja de estar pendiente con categoría y foto.
-- ---------------------------------------------------------------------------

alter table public.productos add column if not exists por_revisar boolean not null default false;

comment on column public.productos.por_revisar is
  'True si entró con una factura y el owner todavía no le puso categoría y foto.';

create index if not exists productos_por_revisar_idx
  on public.productos (inventario_id) where por_revisar;

create or replace function public.revisar_producto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.por_revisar and new.categoria_id is not null and new.foto_path is not null then
    new.por_revisar := false;
  end if;
  return new;
end;
$$;

drop trigger if exists al_revisar_producto on public.productos;
create trigger al_revisar_producto
  before update on public.productos
  for each row execute function public.revisar_producto();

commit;

-- Verificación: los roles y cuántos miembros y perfiles tiene cada uno.
select r.rol, r.ambito,
  (select count(*) from public.miembros m where m.rol_id = r.id) as miembros,
  (select count(*) from public.perfiles p where p.rol_id = r.id) as perfiles
from public.roles r
order by r.ambito, r.rol;
