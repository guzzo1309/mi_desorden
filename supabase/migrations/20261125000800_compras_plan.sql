-- Compra de planes (de prueba: no se cobra nada) e ingresos para el admin.
--
-- En vez de pedirle el plan al admin, la cuenta lo compra: elige mensual o anual
-- (el anual con descuento), se registra la compra y el plan cambia al instante.
-- El admin ve cuánto se ha ganado en su resumen.
--
--   planes.precio_anual      precio por año; arranca en 12 meses con 20 % menos
--   suscripciones.periodo    mensual | anual (null en los gratis o asignados a mano)
--   suscripciones.vence_en   hasta cuándo está pago (informativo: no se corta solo)
--   compras                  cada compra con su monto; queda aunque se borre la cuenta
--   comprar_plan()           compra y cambia el plan
--
-- Requiere 20261125000600_limite_categorias y 20261125000700_resumen_categorias.

begin;

-- ---------------------------------------------------------------------------
-- 1. Precio anual y período de la suscripción
-- ---------------------------------------------------------------------------

alter table public.planes
  add column if not exists precio_anual numeric(10, 2) check (precio_anual >= 0);

update public.planes
set precio_anual = round(precio_mensual * 12 * 0.8, 2)
where precio_mensual is not null and precio_anual is null;

alter table public.suscripciones
  add column if not exists periodo text check (periodo in ('mensual', 'anual')),
  add column if not exists vence_en timestamptz;

alter table public.suscripciones drop constraint if exists suscripciones_origen_check;
alter table public.suscripciones
  add constraint suscripciones_origen_check check (origen in ('manual', 'compra'));

-- ---------------------------------------------------------------------------
-- 2. Compras
-- ---------------------------------------------------------------------------

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  -- set null: el ingreso queda aunque se borre la cuenta.
  usuario_id uuid references public.perfiles (id) on delete set null,
  plan_id uuid not null references public.planes (id) on delete restrict,
  -- Copia del nombre del plan y del email al momento de comprar.
  plan_nombre text not null,
  email text not null default '',
  periodo text not null check (periodo in ('mensual', 'anual')),
  monto numeric(10, 2) not null check (monto >= 0),
  moneda text not null default 'USD',
  creado_en timestamptz not null default now()
);

create index if not exists compras_creado_idx on public.compras (creado_en desc);
create index if not exists compras_usuario_idx on public.compras (usuario_id);

alter table public.compras enable row level security;

-- Cada uno ve las suyas; se crean solo con comprar_plan.
drop policy if exists "ver mis compras" on public.compras;
create policy "ver mis compras" on public.compras for select to authenticated
  using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Comprar
-- ---------------------------------------------------------------------------

create or replace function public.comprar_plan(p_plan uuid, p_periodo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  plan public.planes;
  vigente public.suscripciones;
  v_monto numeric(10, 2);
  v_periodo text;
  v_vence timestamptz;
begin
  if yo is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  if public.es_cuenta_admin(yo) then
    raise exception 'Los admin de la plataforma no tienen plan' using errcode = '22023';
  end if;
  if p_periodo is null or p_periodo not in ('mensual', 'anual') then
    raise exception 'El período es mensual o anual' using errcode = '22023';
  end if;

  select * into plan from public.planes where id = p_plan and activo;
  if plan.id is null then
    raise exception 'Ese plan no existe o está archivado' using errcode = '22023';
  end if;

  -- Una compra a la vez por cuenta.
  perform 1 from public.perfiles where id = yo for update;

  v_monto := case p_periodo
    when 'anual' then coalesce(plan.precio_anual, plan.precio_mensual * 12)
    else plan.precio_mensual
  end;
  if v_monto is null then
    raise exception 'Ese plan todavía no tiene precio' using errcode = '22023';
  end if;
  -- Gratis: cambia el plan sin compra, sin período ni vencimiento.
  if v_monto > 0 then
    v_periodo := p_periodo;
    v_vence := case p_periodo
      when 'anual' then now() + interval '1 year'
      else now() + interval '1 month'
    end;
  end if;

  select * into vigente from public.suscripciones where usuario_id = yo and hasta is null;
  if vigente.plan_id = p_plan and vigente.periodo is not distinct from v_periodo then
    raise exception 'Ya tienes ese plan' using errcode = '22023';
  end if;

  update public.suscripciones set hasta = now() where usuario_id = yo and hasta is null;
  insert into public.suscripciones (usuario_id, plan_id, origen, periodo, vence_en)
  values (yo, p_plan, 'compra', v_periodo, v_vence);

  if v_monto > 0 then
    insert into public.compras (usuario_id, plan_id, plan_nombre, email, periodo, monto)
    values (yo, p_plan, plan.nombre,
            coalesce((select email from public.perfiles where id = yo), ''), p_periodo, v_monto);
  end if;

  -- Si tenía un pedido al admin, ya no hace falta.
  update public.pedidos_plan
  set estado = 'cancelado', resuelto_en = now()
  where usuario_id = yo and estado = 'pendiente';

  return jsonb_build_object('plan', plan.nombre, 'periodo', v_periodo, 'monto', v_monto,
                            'vence_en', v_vence);
end;
$$;

revoke execute on function public.comprar_plan(uuid, text) from public, anon;
grant execute on function public.comprar_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mi plan: con el precio anual, el período y el vencimiento
-- ---------------------------------------------------------------------------

create or replace function public.mi_plan()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  plan public.planes;
  vigente public.suscripciones;
begin
  if yo is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  plan := public.plan_de(yo);
  select * into vigente from public.suscripciones where usuario_id = yo and hasta is null;
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
    'precio_anual', plan.precio_anual,
    'periodo', vigente.periodo,
    'vence_en', vigente.vence_en,
    'inventarios_usados', (select count(*) from public.inventarios where creado_por = yo)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Admin: el precio anual en la lista y al guardar
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
  precio_anual numeric,
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
           p.max_personas, p.max_categorias, p.precio_mensual, p.precio_anual, p.activo, p.orden,
           (select count(*) from public.suscripciones s where s.plan_id = p.id and s.hasta is null)
    from public.planes p
    order by p.orden, p.nombre;
end;
$$;

drop function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, integer, numeric, boolean, integer);
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
  p_precio_anual numeric,
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
       max_categorias, precio_mensual, precio_anual, activo, orden)
    values
      (lower(trim(p_codigo)), trim(p_nombre), trim(coalesce(p_descripcion, '')),
       p_max_inventarios, p_max_productos, p_max_personas, p_max_categorias,
       p_precio_mensual, p_precio_anual, coalesce(p_activo, true), coalesce(p_orden, 0))
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
      precio_anual = p_precio_anual,
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
revoke execute on function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, integer, numeric, numeric, boolean, integer) from public, anon;
grant execute on function public.admin_planes() to authenticated;
grant execute on function public.admin_guardar_plan(uuid, text, text, text, integer, integer, integer, integer, numeric, numeric, boolean, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Resumen del admin con los ingresos
-- ---------------------------------------------------------------------------

create or replace function public.admin_resumen()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'cuentas',     (select count(*) from public.perfiles p
                    where not public.es_cuenta_admin(p.id)),
    'nuevas_7d',   (select count(*) from public.perfiles p
                    where p.creado_en > now() - interval '7 days'
                      and not public.es_cuenta_admin(p.id)),
    'nuevas_30d',  (select count(*) from public.perfiles p
                    where p.creado_en > now() - interval '30 days'
                      and not public.es_cuenta_admin(p.id)),
    'activos_7d',  (select count(*) from auth.users u
                    where u.last_sign_in_at > now() - interval '7 days'
                      and not public.es_cuenta_admin(u.id)),
    'inventarios', (select count(*) from public.inventarios),
    'productos',   (select count(*) from public.productos),
    'categorias',  (select count(*) from public.categorias),
    'invitaciones', (select count(*) from public.invitaciones),

    -- Altas por día, últimos 14 días (incluye los días sin altas).
    'altas_por_dia', (
      select coalesce(jsonb_agg(
               jsonb_build_object('dia', d.dia, 'altas', coalesce(a.altas, 0)) order by d.dia
             ), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') as d(dia)
      left join (
        select p.creado_en::date as dia, count(*) as altas
        from public.perfiles p
        where p.creado_en >= current_date - 13 and not public.es_cuenta_admin(p.id)
        group by 1
      ) a on a.dia = d.dia::date
    ),

    -- Cuántas cuentas tiene cada plan (los archivados solo si todavía tienen cuentas).
    'por_plan', (
      select coalesce(jsonb_agg(
               jsonb_build_object('codigo', pl.codigo, 'nombre', pl.nombre, 'cuentas', c.n)
               order by pl.orden, pl.nombre
             ), '[]'::jsonb)
      from public.planes pl
      cross join lateral (
        select count(*) as n
        from public.suscripciones s
        where s.plan_id = pl.id and s.hasta is null and not public.es_cuenta_admin(s.usuario_id)
      ) c
      where pl.activo or c.n > 0
    ),

    -- Las 10 que están más cerca de su límite (desde el 80 %): candidatas a cambiar de plan.
    'cerca_limite', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'usuario_id', b.usuario_id, 'nombre', b.nombre, 'email', b.email,
                 'plan', b.plan, 'recurso', b.recurso, 'inventario', b.inventario,
                 'usados', b.usados, 'max', b.max
               ) order by b.usados::numeric / b.max desc
             ), '[]'::jsonb)
      from (
        select * from (
          select p.id as usuario_id, p.nombre, p.email, pl.nombre as plan,
                 'inventarios'::text as recurso, null::text as inventario,
                 (select count(*) from public.inventarios i where i.creado_por = p.id) as usados,
                 pl.max_inventarios as max
          from public.perfiles p
          cross join lateral public.plan_de(p.id) pl
          where pl.max_inventarios is not null and not public.es_cuenta_admin(p.id)

          union all

          select p.id, p.nombre, p.email, pl.nombre, 'productos', i.nombre,
                 (select count(*) from public.productos x where x.inventario_id = i.id),
                 pl.max_productos
          from public.inventarios i
          join public.perfiles p on p.id = i.creado_por
          cross join lateral public.plan_de(p.id) pl
          where pl.max_productos is not null

          union all

          select p.id, p.nombre, p.email, pl.nombre, 'categorias', i.nombre,
                 (select count(*) from public.categorias x where x.inventario_id = i.id),
                 pl.max_categorias
          from public.inventarios i
          join public.perfiles p on p.id = i.creado_por
          cross join lateral public.plan_de(p.id) pl
          where pl.max_categorias is not null

          union all

          select p.id, p.nombre, p.email, pl.nombre, 'personas', i.nombre,
                 (select count(*) from public.miembros m where m.inventario_id = i.id)
                   + (select count(*) from public.invitaciones v where v.inventario_id = i.id),
                 pl.max_personas
          from public.inventarios i
          join public.perfiles p on p.id = i.creado_por
          cross join lateral public.plan_de(p.id) pl
          where pl.max_personas is not null
        ) u
        where u.usados >= u.max * 0.8
        order by u.usados::numeric / u.max desc
        limit 10
      ) b
    ),

    -- Lo que se ha ganado con las compras de planes.
    'ingresos', jsonb_build_object(
      'total', (select coalesce(sum(monto), 0) from public.compras),
      'ultimos_30d', (select coalesce(sum(monto), 0) from public.compras
                      where creado_en > now() - interval '30 days'),
      'mes_actual', (select coalesce(sum(monto), 0) from public.compras
                     where creado_en >= date_trunc('month', now())),
      'compras', (select count(*) from public.compras),
      -- Lo que entra por mes con las suscripciones pagas vigentes (el anual / 12).
      'recurrente_mensual', (
        select coalesce(round(sum(
                 case s.periodo
                   when 'anual' then coalesce(pl.precio_anual, pl.precio_mensual * 12) / 12
                   else pl.precio_mensual
                 end), 2), 0)
        from public.suscripciones s
        join public.planes pl on pl.id = s.plan_id
        where s.hasta is null and s.periodo is not null
      ),
      'por_plan', (
        select coalesce(jsonb_agg(jsonb_build_object('plan', x.plan_nombre, 'monto', x.monto,
                                                     'compras', x.n) order by x.monto desc),
                        '[]'::jsonb)
        from (
          select plan_nombre, sum(monto) as monto, count(*) as n
          from public.compras group by plan_nombre
        ) x
      ),
      'ultimas', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'usuario_id', c.usuario_id, 'nombre', coalesce(p.nombre, c.email),
                 'email', c.email, 'plan', c.plan_nombre, 'periodo', c.periodo,
                 'monto', c.monto, 'creado_en', c.creado_en
               ) order by c.creado_en desc), '[]'::jsonb)
        from (select * from public.compras order by creado_en desc limit 8) c
        left join public.perfiles p on p.id = c.usuario_id
      )
    )
  ) into resultado;

  return resultado;
end;
$$;

commit;
