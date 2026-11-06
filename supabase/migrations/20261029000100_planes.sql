-- Planes (tiers) y suscripciones.
--
-- El plan es de la cuenta que es owner: los límites cuentan lo que esa cuenta
-- creó (inventarios) y lo que hay en sus inventarios (productos, personas).
-- Los empleados invitados no gastan de su propio plan.
--
--   planes         catálogo editable por el admin. Un límite null = ilimitado.
--   suscripciones  qué plan tiene cada cuenta, con historial (hasta null = vigente).
--   admin_log      registro append-only de lo que hace el admin.
--
-- Los límites se aplican en 20261029000200_limites_plan. Acá solo se definen
-- los datos y las funciones para verlos y administrarlos.
--
-- Requiere 20261029000000_admin_panel (admin_usuarios) y es_admin().

begin;

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

create table public.planes (
  id uuid primary key default gen_random_uuid(),
  -- Identificador estable (free, pro…). No cambia aunque se renombre el plan.
  codigo text not null unique check (codigo ~ '^[a-z0-9_]{2,30}$'),
  nombre text not null check (char_length(nombre) between 2 and 40),
  descripcion text not null default '' check (char_length(descripcion) <= 200),
  -- null = ilimitado.
  max_inventarios integer check (max_inventarios > 0),
  max_productos integer check (max_productos > 0),
  max_personas integer check (max_personas > 0),
  -- Solo informativo: todavía no hay cobro.
  precio_mensual numeric(10, 2) check (precio_mensual >= 0),
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.planes is
  'Catálogo de planes. Límite null = ilimitado. Se archivan (activo = false), no se borran.';

create table public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  -- restrict: no se puede borrar un plan que alguien tiene o tuvo.
  plan_id uuid not null references public.planes (id) on delete restrict,
  desde timestamptz not null default now(),
  -- null = vigente.
  hasta timestamptz,
  origen text not null default 'manual' check (origen in ('manual')),
  asignado_por uuid references public.perfiles (id) on delete set null,
  check (hasta is null or hasta >= desde)
);

-- Una sola suscripción vigente por cuenta.
create unique index suscripciones_vigente_idx
  on public.suscripciones (usuario_id) where hasta is null;
create index suscripciones_plan_idx on public.suscripciones (plan_id);

create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.perfiles (id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. RLS: lectura para ver mi plan; escribir solo por las funciones del admin
-- ---------------------------------------------------------------------------

alter table public.planes enable row level security;
alter table public.suscripciones enable row level security;
alter table public.admin_log enable row level security;

create policy "ver planes" on public.planes for select to authenticated using (true);
create policy "ver mi suscripcion" on public.suscripciones for select to authenticated
  using (usuario_id = auth.uid());
-- admin_log sin políticas: nadie lo lee ni lo escribe directo, solo las funciones.

-- ---------------------------------------------------------------------------
-- 3. Planes de arranque y asignación automática
-- ---------------------------------------------------------------------------

insert into public.planes
  (codigo, nombre, descripcion, max_inventarios, max_productos, max_personas, orden)
values
  ('free', 'Free', 'Para empezar: un inventario chico.', 1, 100, 2, 1),
  ('pro', 'Pro', 'Para un negocio con varios inventarios y equipo.', 5, 2000, 10, 2),
  ('business', 'Business', 'Sin límites.', null, null, null, 3);

-- Las cuentas que ya existen arrancan en Free.
insert into public.suscripciones (usuario_id, plan_id)
select p.id, (select id from public.planes where codigo = 'free')
from public.perfiles p;

-- Las nuevas también: crear_perfil ahora asigna Free al registrarse.
create or replace function public.crear_perfil()
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
  insert into public.suscripciones (usuario_id, plan_id)
  select new.id, id from public.planes where codigo = 'free';
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Consultas
-- ---------------------------------------------------------------------------

-- Plan vigente de una cuenta. Sin suscripción (no debería pasar) cae en Free.
create function public.plan_de(usuario uuid)
returns public.planes
language sql stable security definer set search_path = ''
as $$
  select p.*
  from public.planes p
  where p.id = coalesce(
    (select s.plan_id from public.suscripciones s where s.usuario_id = usuario and s.hasta is null),
    (select id from public.planes where codigo = 'free')
  )
$$;

-- Mi plan y cuánto llevo usado. Para el bloque "Tu plan" de la app.
create function public.mi_plan()
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
    'precio_mensual', plan.precio_mensual,
    'inventarios_usados', (select count(*) from public.inventarios where creado_por = yo)
  );
end;
$$;

-- Límites del inventario: los del plan de su owner. Los ve cualquier miembro.
create function public.limites_inventario(inv uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  plan public.planes;
begin
  if not public.es_miembro(inv) then
    raise exception 'No sos miembro de este inventario' using errcode = '42501';
  end if;
  plan := public.plan_de((select creado_por from public.inventarios where id = inv));
  return jsonb_build_object(
    'plan', plan.nombre,
    'max_productos', plan.max_productos,
    'max_personas', plan.max_personas,
    'productos', (select count(*) from public.productos where inventario_id = inv),
    'personas',
      (select count(*) from public.miembros where inventario_id = inv)
      + (select count(*) from public.invitaciones where inventario_id = inv)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Funciones del admin
-- ---------------------------------------------------------------------------

create function public.admin_planes()
returns table (
  id uuid,
  codigo text,
  nombre text,
  descripcion text,
  max_inventarios integer,
  max_productos integer,
  max_personas integer,
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
           p.max_personas, p.precio_mensual, p.activo, p.orden,
           (select count(*) from public.suscripciones s where s.plan_id = p.id and s.hasta is null)
    from public.planes p
    order by p.orden, p.nombre;
end;
$$;

-- Crea (plan_id null) o actualiza un plan. El código no cambia al editar.
create function public.admin_guardar_plan(
  p_id uuid,
  p_codigo text,
  p_nombre text,
  p_descripcion text,
  p_max_inventarios integer,
  p_max_productos integer,
  p_max_personas integer,
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
       precio_mensual, activo, orden)
    values
      (lower(trim(p_codigo)), trim(p_nombre), trim(coalesce(p_descripcion, '')),
       p_max_inventarios, p_max_productos, p_max_personas, p_precio_mensual,
       coalesce(p_activo, true), coalesce(p_orden, 0))
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
                       'activo', p_activo)
  );
  return resultado;
end;
$$;

-- Cambia el plan de una cuenta: cierra la suscripción vigente y abre la nueva.
create function public.admin_asignar_plan(p_usuario uuid, p_plan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  vigente uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario) then
    raise exception 'Esa cuenta no existe' using errcode = '22023';
  end if;
  if not exists (select 1 from public.planes where id = p_plan and activo) then
    raise exception 'Ese plan no existe o está archivado' using errcode = '22023';
  end if;

  select plan_id into vigente from public.suscripciones
  where usuario_id = p_usuario and hasta is null;
  if vigente = p_plan then
    return;
  end if;

  update public.suscripciones set hasta = now()
  where usuario_id = p_usuario and hasta is null;
  insert into public.suscripciones (usuario_id, plan_id, asignado_por)
  values (p_usuario, p_plan, auth.uid());

  insert into public.admin_log (admin_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'asignar_plan', 'usuario', p_usuario::text,
          jsonb_build_object('de', vigente, 'a', p_plan));
end;
$$;

-- admin_usuarios ahora trae también el plan de cada cuenta.
drop function public.admin_usuarios();
create function public.admin_usuarios()
returns table (
  id uuid,
  nombre text,
  email text,
  creado_en timestamptz,
  ultimo_acceso timestamptz,
  inventarios bigint,
  es_admin boolean,
  plan_id uuid,
  plan_nombre text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, p.email, p.creado_en, u.last_sign_in_at,
           (select count(*) from public.miembros m where m.usuario_id = p.id),
           coalesce(r.rol = 'admin', false),
           pl.id, pl.nombre
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.roles r on r.id = p.rol_id
    cross join lateral public.plan_de(p.id) pl
    order by p.creado_en desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.plan_de(uuid) from public, anon, authenticated;
revoke execute on function public.mi_plan() from public, anon;
revoke execute on function public.limites_inventario(uuid) from public, anon;
revoke execute on function public.admin_planes() from public, anon;
revoke execute on function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, numeric, boolean, integer) from public, anon;
revoke execute on function public.admin_asignar_plan(uuid, uuid) from public, anon;
revoke execute on function public.admin_usuarios() from public, anon;

grant execute on function public.mi_plan() to authenticated;
grant execute on function public.limites_inventario(uuid) to authenticated;
grant execute on function public.admin_planes() to authenticated;
grant execute on function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, numeric, boolean, integer) to authenticated;
grant execute on function public.admin_asignar_plan(uuid, uuid) to authenticated;
grant execute on function public.admin_usuarios() to authenticated;

commit;

-- Verificación
select codigo, nombre, max_inventarios, max_productos, max_personas, activo,
       (select count(*) from public.suscripciones s where s.plan_id = p.id and s.hasta is null) as cuentas
from public.planes p
order by orden;
