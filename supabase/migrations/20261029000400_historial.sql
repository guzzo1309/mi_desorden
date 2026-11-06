-- Historial de movimientos de un inventario, y el owner no se puede cambiar.
--
-- Cada alta, cambio de stock, edición o baja de un producto queda en
-- `movimientos` con quién lo hizo, escrito por un trigger: ni la app ni
-- los empleados pueden tocarlo. Solo el owner del inventario lo ve.
--
-- El historial no se borra con el producto (el producto_id no tiene FK), pero
-- sí con el inventario. No hay retención automática todavía: crece con el uso.
--
-- Requiere 20261028000100_roles_permisos (puede) y 20261008000000_categorias.

begin;

-- ---------------------------------------------------------------------------
-- 1. El owner de un inventario (creado_por) no cambia
-- ---------------------------------------------------------------------------
-- La política de UPDATE de inventarios no limita columnas: sin esto, un owner
-- podría pasarle el inventario a otra cuenta para esquivar el límite de su plan.

create function public.proteger_creado_por()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.creado_por is distinct from old.creado_por then
    raise exception 'El owner de un inventario no se puede cambiar' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger al_proteger_creado_por
  before update of creado_por on public.inventarios
  for each row execute function public.proteger_creado_por();

-- ---------------------------------------------------------------------------
-- 2. Tabla de movimientos
-- ---------------------------------------------------------------------------

create table public.movimientos (
  id bigint generated always as identity primary key,
  inventario_id uuid not null references public.inventarios (id) on delete cascade,
  -- Sin FK a propósito: el producto puede borrarse y el historial se queda.
  producto_id uuid,
  producto_nombre text not null,
  usuario_id uuid references public.perfiles (id) on delete set null,
  tipo text not null check (tipo in ('creado', 'stock', 'editado', 'eliminado')),
  cantidad_antes integer,
  cantidad_despues integer,
  -- manual | camara
  fuente text,
  -- Para 'editado': { "ubicacion": { "de": "A2", "a": "B3" }, ... }
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index movimientos_inventario_idx on public.movimientos (inventario_id, id desc);
create index movimientos_producto_idx on public.movimientos (producto_id, id desc);

alter table public.movimientos enable row level security;

-- Lo ve quien gestiona accesos (el owner). Nadie escribe directo: solo el trigger.
create policy "owner ve el historial" on public.movimientos for select to authenticated
  using (public.puede(inventario_id, 'gestionar_accesos'));

-- ---------------------------------------------------------------------------
-- 3. Trigger sobre productos
-- ---------------------------------------------------------------------------

create function public.registrar_movimiento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cambios jsonb := '{}'::jsonb;
  cat_antes text;
  cat_despues text;
begin
  if tg_op = 'INSERT' then
    insert into public.movimientos
      (inventario_id, producto_id, producto_nombre, usuario_id, tipo, cantidad_despues, fuente)
    values
      (new.inventario_id, new.id, new.nombre, auth.uid(), 'creado', new.cantidad, new.fuente);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.cantidad is distinct from old.cantidad then
      insert into public.movimientos
        (inventario_id, producto_id, producto_nombre, usuario_id, tipo,
         cantidad_antes, cantidad_despues, fuente)
      values
        (new.inventario_id, new.id, new.nombre, auth.uid(), 'stock',
         old.cantidad, new.cantidad, new.fuente);
    end if;

    if new.nombre is distinct from old.nombre then
      cambios := cambios || jsonb_build_object('nombre', jsonb_build_object('de', old.nombre, 'a', new.nombre));
    end if;
    if new.ubicacion is distinct from old.ubicacion then
      cambios := cambios || jsonb_build_object('ubicacion', jsonb_build_object('de', old.ubicacion, 'a', new.ubicacion));
    end if;
    if new.minimo is distinct from old.minimo then
      cambios := cambios || jsonb_build_object('minimo', jsonb_build_object('de', old.minimo, 'a', new.minimo));
    end if;
    if new.categoria_id is distinct from old.categoria_id then
      select nombre into cat_antes from public.categorias where id = old.categoria_id;
      select nombre into cat_despues from public.categorias where id = new.categoria_id;
      cambios := cambios || jsonb_build_object('categoria', jsonb_build_object('de', cat_antes, 'a', cat_despues));
    end if;

    if cambios <> '{}'::jsonb then
      insert into public.movimientos
        (inventario_id, producto_id, producto_nombre, usuario_id, tipo, fuente, detalle)
      values
        (new.inventario_id, new.id, new.nombre, auth.uid(), 'editado', new.fuente, cambios);
    end if;
    return new;
  end if;

  -- DELETE. Si se está borrando el inventario entero, no hay a dónde anotarlo.
  if exists (select 1 from public.inventarios where id = old.inventario_id) then
    insert into public.movimientos
      (inventario_id, producto_id, producto_nombre, usuario_id, tipo, cantidad_antes)
    values
      (old.inventario_id, old.id, old.nombre, auth.uid(), 'eliminado', old.cantidad);
  end if;
  return old;
end;
$$;

revoke execute on function public.registrar_movimiento() from public, anon, authenticated;

create trigger al_registrar_movimiento
  after insert or update or delete on public.productos
  for each row execute function public.registrar_movimiento();

commit;

-- Verificación: la tabla y los triggers tienen que aparecer.
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in ('al_registrar_movimiento', 'al_proteger_creado_por')
order by 1, 2;
