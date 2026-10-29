-- Ya está aplicada en Supabase (se corrió a mano el 29/10 como 20261029000100_solicitudes):
-- es idempotente, así que volver a correrla no cambia nada.
--
-- Solicitudes: un lector le pide a quien edita el inventario (owner o editor)
-- que agregue un producto, que elimine uno o que cambie su stock.
--
-- Quien resuelve la acepta o la rechaza. Al aceptar, la app hace el cambio
-- (crear, borrar o ajustar) con los permisos normales de productos; la
-- solicitud solo deja registro y avisa en tiempo real.

begin;

create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios (id) on delete cascade,
  -- Null en "agregar" (todavía no existe) o si el producto ya se borró.
  producto_id uuid references public.productos (id) on delete set null,
  tipo text not null check (tipo in ('agregar', 'eliminar', 'stock')),
  -- Nombre del producto a agregar, o lo que quiera aclarar quien pide.
  detalle text not null default '' check (char_length(detalle) <= 300),
  -- Solo para "stock": la cantidad que pide.
  cantidad integer check (cantidad is null or cantidad >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creado_por uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  creado_en timestamptz not null default now(),
  resuelto_por uuid references public.perfiles (id) on delete set null,
  resuelto_en timestamptz,
  check (tipo <> 'agregar' or char_length(trim(detalle)) > 0),
  check (tipo <> 'stock' or cantidad is not null)
);

create index if not exists solicitudes_inventario_idx
  on public.solicitudes (inventario_id) where estado = 'pendiente';

comment on table public.solicitudes is
  'Pedidos de un lector (agregar, eliminar o cambiar stock). Los resuelven owner y editores.';

-- Al resolver se anota quién y cuándo; una solicitud resuelta ya no cambia.
create or replace function public.resolver_solicitud()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Se borró el producto (on delete set null): eso siempre pasa.
  if new.producto_id is null and old.producto_id is not null
    and (to_jsonb(new) - 'producto_id') = (to_jsonb(old) - 'producto_id')
  then
    return new;
  end if;
  if old.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue resuelta' using errcode = '22023';
  end if;
  if (to_jsonb(new) - array['estado', 'resuelto_por', 'resuelto_en'])
    is distinct from (to_jsonb(old) - array['estado', 'resuelto_por', 'resuelto_en'])
  then
    raise exception 'De una solicitud solo se cambia el estado' using errcode = '42501';
  end if;
  if new.estado <> 'pendiente' then
    new.resuelto_por := auth.uid();
    new.resuelto_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists al_resolver_solicitud on public.solicitudes;
create trigger al_resolver_solicitud
  before update on public.solicitudes
  for each row execute function public.resolver_solicitud();

alter table public.solicitudes enable row level security;

-- Las ve quien la hizo y quien puede resolverlas.
drop policy if exists "ver solicitudes" on public.solicitudes;
create policy "ver solicitudes" on public.solicitudes for select to authenticated
  using (
    (creado_por = auth.uid() and public.es_miembro(inventario_id))
    or public.puede(inventario_id, 'editar_productos')
  );

-- Cualquier miembro pide, a su nombre y como pendiente.
drop policy if exists "pedir" on public.solicitudes;
create policy "pedir" on public.solicitudes for insert to authenticated
  with check (
    public.es_miembro(inventario_id)
    and creado_por = auth.uid()
    and estado = 'pendiente'
    and (producto_id is null or exists (
      select 1 from public.productos p
      where p.id = producto_id and p.inventario_id = solicitudes.inventario_id
    ))
  );

-- Resuelven owner y editores.
drop policy if exists "resolver solicitudes" on public.solicitudes;
create policy "resolver solicitudes" on public.solicitudes for update to authenticated
  using (public.puede(inventario_id, 'editar_productos'))
  with check (public.puede(inventario_id, 'editar_productos'));

-- Quien la hizo la puede retirar mientras está pendiente.
drop policy if exists "retirar solicitud" on public.solicitudes;
create policy "retirar solicitud" on public.solicitudes for delete to authenticated
  using (creado_por = auth.uid() and estado = 'pendiente');

-- Realtime: avisa al owner y a los editores en cuanto llega una.
alter table public.solicitudes replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes'
  ) then
    alter publication supabase_realtime add table public.solicitudes;
  end if;
end;
$$;

commit;
