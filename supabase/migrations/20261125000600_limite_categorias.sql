-- Límite de categorías por plan.
--
-- Como los productos, las categorías cuentan por inventario (principales y
-- subcategorías juntas) contra el plan de su owner: planes.max_categorias,
-- null = ilimitado. Solo frena altas nuevas: quien ya tiene más las conserva.
--
--   Free      10 categorías por inventario
--   Pro       50
--   Business  sin límite
--
-- También suma el límite a mi_plan, limites_inventario y a las funciones del
-- admin (admin_planes, admin_guardar_plan).
--
-- Requiere 20261029000100_planes y 20261029000200_limites_plan.

begin;

alter table public.planes
  add column if not exists max_categorias integer check (max_categorias > 0);

update public.planes set max_categorias = 10 where codigo = 'free';
update public.planes set max_categorias = 50 where codigo = 'pro';

-- ---------------------------------------------------------------------------
-- Trigger: por inventario, con el plan del owner
-- ---------------------------------------------------------------------------

create or replace function public.limite_categorias()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  duenio uuid;
  plan public.planes;
begin
  select creado_por into duenio from public.inventarios where id = new.inventario_id;
  if duenio is null then
    return new;
  end if;
  perform 1 from public.perfiles where id = duenio for update;
  plan := public.plan_de(duenio);
  perform public.exigir_cupo(
    (select count(*) from public.categorias where inventario_id = new.inventario_id),
    plan.max_categorias,
    format('Este inventario llegó al límite de su plan %s (%s categorías). Pídele al owner que cambie de plan.',
           plan.nombre, plan.max_categorias)
  );
  return new;
end;
$$;

drop trigger if exists al_limitar_categorias on public.categorias;
create trigger al_limitar_categorias
  before insert on public.categorias
  for each row execute function public.limite_categorias();

revoke execute on function public.limite_categorias() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consultas de la app
-- ---------------------------------------------------------------------------

create or replace function public.mi_plan()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  plan public.planes;
begin
  if yo is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  plan := public.plan_de(yo);
  return jsonb_build_object(
    'id', plan.id,
    'codigo', plan.codigo,
    'nombre', plan.nombre,
    'descripcion', plan.descripcion,
    'max_inventarios', plan.max_inventarios,
    'max_productos', plan.max_productos,
    'max_personas', plan.max_personas,
    'max_categorias', plan.max_categorias,
    'precio_mensual', plan.precio_mensual,
    'inventarios_usados', (select count(*) from public.inventarios where creado_por = yo)
  );
end;
$$;

create or replace function public.limites_inventario(inv uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  plan public.planes;
begin
  if not public.es_miembro(inv) then
    raise exception 'No eres miembro de este inventario' using errcode = '42501';
  end if;
  plan := public.plan_de((select creado_por from public.inventarios where id = inv));
  return jsonb_build_object(
    'plan', plan.nombre,
    'max_productos', plan.max_productos,
    'max_personas', plan.max_personas,
    'max_categorias', plan.max_categorias,
    'productos', (select count(*) from public.productos where inventario_id = inv),
    'categorias', (select count(*) from public.categorias where inventario_id = inv),
    'personas',
      (select count(*) from public.miembros where inventario_id = inv)
      + (select count(*) from public.invitaciones where inventario_id = inv)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: ver y guardar el nuevo límite
-- ---------------------------------------------------------------------------

drop function public.admin_planes();
create function public.admin_planes()
returns table (
  id uuid,
  codigo text,
  nombre text,
  descripcion text,
  max_inventarios integer,
  max_productos integer,
  max_personas integer,
  max_categorias integer,
  precio_mensual numeric,
  activo boolean,
  orden integer,
  suscriptores bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;
  return query
    select p.id, p.codigo, p.nombre, p.descripcion, p.max_inventarios, p.max_productos,
           p.max_personas, p.max_categorias, p.precio_mensual, p.activo, p.orden,
           (select count(*) from public.suscripciones s where s.plan_id = p.id and s.hasta is null)
    from public.planes p
    order by p.orden, p.nombre;
end;
$$;

drop function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, numeric, boolean, integer);
create function public.admin_guardar_plan(
  p_id uuid,
  p_codigo text,
  p_nombre text,
  p_descripcion text,
  p_max_inventarios integer,
  p_max_productos integer,
  p_max_personas integer,
  p_max_categorias integer,
  p_precio_mensual numeric,
  p_activo boolean,
  p_orden integer
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  resultado uuid;
  codigo_actual text;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.planes
      (codigo, nombre, descripcion, max_inventarios, max_productos, max_personas,
       max_categorias, precio_mensual, activo, orden)
    values
      (lower(trim(p_codigo)), trim(p_nombre), trim(coalesce(p_descripcion, '')),
       p_max_inventarios, p_max_productos, p_max_personas, p_max_categorias,
       p_precio_mensual, coalesce(p_activo, true), coalesce(p_orden, 0))
    returning id into resultado;
  else
    select codigo into codigo_actual from public.planes where id = p_id;
    if codigo_actual is null then
      raise exception 'Ese plan no existe' using errcode = '22023';
    end if;
    -- Free es el plan de arranque de toda cuenta nueva: tiene que seguir activo.
    if codigo_actual = 'free' and p_activo is false then
      raise exception 'El plan Free no se puede archivar' using errcode = '22023';
    end if;
    update public.planes set
      nombre = trim(p_nombre),
      descripcion = trim(coalesce(p_descripcion, '')),
      max_inventarios = p_max_inventarios,
      max_productos = p_max_productos,
      max_personas = p_max_personas,
      max_categorias = p_max_categorias,
      precio_mensual = p_precio_mensual,
      activo = coalesce(p_activo, activo),
      orden = coalesce(p_orden, orden),
      actualizado_en = now()
    where id = p_id
    returning id into resultado;
  end if;

  insert into public.admin_log (admin_id, accion, entidad, entidad_id, detalle)
  values (
    auth.uid(),
    case when p_id is null then 'crear_plan' else 'editar_plan' end,
    'plan', resultado::text,
    jsonb_build_object('nombre', p_nombre, 'max_inventarios', p_max_inventarios,
                       'max_productos', p_max_productos, 'max_personas', p_max_personas,
                       'max_categorias', p_max_categorias, 'activo', p_activo)
  );
  return resultado;
end;
$$;

revoke execute on function public.admin_planes() from public, anon;
revoke execute on function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, integer, numeric, boolean, integer) from public, anon;
grant execute on function public.admin_planes() to authenticated;
grant execute on function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, integer, numeric, boolean, integer) to authenticated;

commit;

-- Verificación
select codigo, nombre, max_inventarios, max_categorias, max_productos, max_personas
from public.planes
order by orden;
