-- MVP de inventario: perfiles, inventarios compartidos, miembros con rol y productos.
-- Todo protegido con RLS: cada usuario ve solo los inventarios donde es miembro.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.rol as enum ('dueño', 'editor', 'lector');
create type public.led_color as enum ('verde', 'azul', 'rojo', 'amarillo', 'violeta');
create type public.fuente_cambio as enum ('manual', 'camara');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Datos públicos de cada cuenta. Se crea sola al registrarse (trigger más abajo).
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null unique,
  creado_en timestamptz not null default now()
);

create table public.inventarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  lugar text not null default '',
  creado_por uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table public.miembros (
  inventario_id uuid not null references public.inventarios (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol public.rol not null default 'lector',
  agregado_en timestamptz not null default now(),
  primary key (inventario_id, usuario_id)
);
create index miembros_usuario_idx on public.miembros (usuario_id);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 120),
  categoria text not null default 'General',
  cantidad integer not null default 0 check (cantidad >= 0),
  minimo integer not null default 0 check (minimo >= 0),
  ubicacion text not null default '',
  led public.led_color not null default 'verde',
  fuente public.fuente_cambio not null default 'manual',
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);
create index productos_inventario_idx on public.productos (inventario_id);

-- ---------------------------------------------------------------------------
-- Helpers para RLS. Son security definer para no caer en recursión al
-- consultar `miembros` desde las políticas de la propia tabla `miembros`.
-- ---------------------------------------------------------------------------

create function public.rol_en(inv uuid)
returns public.rol
language sql stable security definer set search_path = ''
as $$
  select rol from public.miembros where inventario_id = inv and usuario_id = auth.uid()
$$;

create function public.es_miembro(inv uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.miembros where inventario_id = inv and usuario_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Perfil automático al registrarse. El nombre viene de options.data.nombre en signUp().
create function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    lower(new.email)
  );
  return new;
end;
$$;

create trigger al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Quien crea un inventario queda como dueño.
create function public.agregar_dueno()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.miembros (inventario_id, usuario_id, rol)
  values (new.id, new.creado_por, 'dueño');
  return new;
end;
$$;

create trigger al_crear_inventario
  after insert on public.inventarios
  for each row execute function public.agregar_dueno();

-- Cada cambio de producto renueva la marca de tiempo.
create function public.tocar_producto()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger al_actualizar_producto
  before update on public.productos
  for each row execute function public.tocar_producto();

-- ---------------------------------------------------------------------------
-- Invitar por correo: busca el perfil y lo agrega. Solo el dueño puede.
-- ---------------------------------------------------------------------------

create function public.invitar_miembro(inv uuid, correo text, nuevo_rol public.rol)
returns public.miembros
language plpgsql security definer set search_path = ''
as $$
declare
  invitado uuid;
  fila public.miembros;
begin
  if public.rol_en(inv) is distinct from 'dueño' then
    raise exception 'Solo el dueño puede invitar' using errcode = '42501';
  end if;
  if nuevo_rol = 'dueño' then
    raise exception 'No se puede invitar como dueño' using errcode = '22023';
  end if;

  select id into invitado from public.perfiles where email = lower(trim(correo));
  if invitado is null then
    raise exception 'No hay ninguna cuenta con ese correo' using errcode = 'P0002';
  end if;

  insert into public.miembros (inventario_id, usuario_id, rol)
  values (inv, invitado, nuevo_rol)
  on conflict (inventario_id, usuario_id) do update set rol = excluded.rol
    where public.miembros.rol <> 'dueño'
  returning * into fila;
  return fila;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.inventarios enable row level security;
alter table public.miembros enable row level security;
alter table public.productos enable row level security;

-- perfiles: el propio, y los de gente con la que comparto algún inventario.
create policy "ver perfiles cercanos" on public.perfiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.miembros m
      where m.usuario_id = perfiles.id and public.es_miembro(m.inventario_id)
    )
  );
create policy "editar mi perfil" on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- inventarios
create policy "ver mis inventarios" on public.inventarios for select to authenticated
  using (public.es_miembro(id) or creado_por = auth.uid());
create policy "crear inventarios" on public.inventarios for insert to authenticated
  with check (creado_por = auth.uid());
create policy "dueño edita inventario" on public.inventarios for update to authenticated
  using (public.rol_en(id) = 'dueño');
create policy "dueño borra inventario" on public.inventarios for delete to authenticated
  using (public.rol_en(id) = 'dueño');

-- miembros: los ve cualquiera del inventario; solo el dueño cambia roles o
-- quita gente (y nadie toca la fila del dueño). Uno siempre puede irse.
create policy "ver miembros" on public.miembros for select to authenticated
  using (public.es_miembro(inventario_id));
create policy "dueño cambia roles" on public.miembros for update to authenticated
  using (public.rol_en(inventario_id) = 'dueño' and rol <> 'dueño')
  with check (rol <> 'dueño');
create policy "dueño quita o uno se va" on public.miembros for delete to authenticated
  using (
    rol <> 'dueño'
    and (public.rol_en(inventario_id) = 'dueño' or usuario_id = auth.uid())
  );

-- productos: leen todos los miembros; escriben dueño y editores.
create policy "ver productos" on public.productos for select to authenticated
  using (public.es_miembro(inventario_id));
create policy "crear productos" on public.productos for insert to authenticated
  with check (public.rol_en(inventario_id) in ('dueño', 'editor'));
create policy "editar productos" on public.productos for update to authenticated
  using (public.rol_en(inventario_id) in ('dueño', 'editor'))
  with check (public.rol_en(inventario_id) in ('dueño', 'editor'));
create policy "borrar productos" on public.productos for delete to authenticated
  using (public.rol_en(inventario_id) in ('dueño', 'editor'));

-- Postgres da EXECUTE a public por defecto: se lo dejamos solo a usuarios logueados.
revoke execute on function public.rol_en(uuid) from public, anon;
revoke execute on function public.es_miembro(uuid) from public, anon;
revoke execute on function public.invitar_miembro(uuid, text, public.rol) from public, anon;
grant execute on function public.rol_en(uuid) to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;
grant execute on function public.invitar_miembro(uuid, text, public.rol) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: la app escucha cambios de productos y miembros.
-- ---------------------------------------------------------------------------

alter table public.productos replica identity full;
alter table public.miembros replica identity full;
alter publication supabase_realtime add table public.productos, public.miembros;
