-- Categorías personalizables: el owner del inventario le puede poner a cada
-- categoría una imagen representativa, un estilo de letra y un color de título.
--
-- - categorias.imagen_path: ruta en el bucket "categorias"
--   (<inventario_id>/<categoria_id>-<sufijo>.jpg). Null = el ícono de carpeta.
-- - categorias.fuente: estilo de letra del título. Null = la del sistema.
-- - categorias.color: color del título (una clave de la paleta de la app, que
--   se adapta al modo oscuro). Null = el de siempre.
-- - Solo el owner cambia estas columnas (trigger); editores siguen creando,
--   renombrando y borrando categorías como antes.
-- - Bucket "categorias", privado: las imágenes las ven los miembros y solo el
--   owner las sube, cambia o borra.
--
-- Requiere 20261028000200_roles_uuid (rol_id, mi_rol_id).

begin;

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------

alter table public.categorias
  add column if not exists imagen_path text,
  add column if not exists fuente text,
  add column if not exists color text;

alter table public.categorias
  add constraint categorias_fuente_valida
    check (fuente is null or fuente in ('redondeada', 'serif', 'mono', 'condensada')),
  add constraint categorias_color_valido
    check (color is null or color in ('marca', 'kraft', 'rojo', 'verde', 'azul', 'violeta')),
  add constraint categorias_imagen_propia
    check (imagen_path is null or imagen_path like inventario_id::text || '/' || id::text || '-%');

comment on column public.categorias.imagen_path is
  'Ruta en el bucket "categorias": <inventario_id>/<categoria_id>-<sufijo>.jpg. Null = ícono de carpeta.';
comment on column public.categorias.fuente is
  'Estilo de letra del título: redondeada, serif, mono o condensada. Null = la del sistema.';
comment on column public.categorias.color is
  'Color del título, clave de la paleta de la app (marca, kraft, rojo, verde, azul, violeta). Null = el de siempre.';

-- ---------------------------------------------------------------------------
-- 2. Solo el owner personaliza
-- ---------------------------------------------------------------------------

create function public.es_owner(inv uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.mi_rol_id(inv) = public.rol_id('owner'), false)
$$;

revoke execute on function public.es_owner(uuid) from public, anon;
grant execute on function public.es_owner(uuid) to authenticated;

create function public.proteger_estilo_categoria()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, service role) no se restringe.
  if auth.uid() is null or public.es_owner(new.inventario_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.imagen_path is not null or new.fuente is not null or new.color is not null then
      raise exception 'Solo el owner del inventario puede personalizar las categorías'
        using errcode = '42501';
    end if;
  elsif new.imagen_path is distinct from old.imagen_path
    or new.fuente is distinct from old.fuente
    or new.color is distinct from old.color
  then
    raise exception 'Solo el owner del inventario puede personalizar las categorías'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger al_cambiar_estilo_categoria
  before insert or update on public.categorias
  for each row execute function public.proteger_estilo_categoria();

-- ---------------------------------------------------------------------------
-- 3. Bucket privado para las imágenes
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('categorias', 'categorias', false, 2 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Inventario dueño de un archivo (<inventario_id>/…); null si la ruta no empieza con un uuid.
create function public.inventario_de_ruta(ruta text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when split_part(ruta, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(ruta, '/', 1)::uuid
  end
$$;

create policy "categorias: ver imágenes de mis inventarios" on storage.objects for select to authenticated
  using (bucket_id = 'categorias' and public.es_miembro(public.inventario_de_ruta(name)));

create policy "categorias: el owner sube imágenes" on storage.objects for insert to authenticated
  with check (bucket_id = 'categorias' and public.es_owner(public.inventario_de_ruta(name)));

create policy "categorias: el owner reemplaza imágenes" on storage.objects for update to authenticated
  using (bucket_id = 'categorias' and public.es_owner(public.inventario_de_ruta(name)))
  with check (bucket_id = 'categorias' and public.es_owner(public.inventario_de_ruta(name)));

create policy "categorias: el owner borra imágenes" on storage.objects for delete to authenticated
  using (bucket_id = 'categorias' and public.es_owner(public.inventario_de_ruta(name)));

commit;
