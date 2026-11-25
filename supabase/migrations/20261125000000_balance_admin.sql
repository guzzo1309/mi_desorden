

begin;

-- 1. Precio congelado en cada suscripción
alter table public.suscripciones
  add column precio_mensual numeric(10, 2) check (precio_mensual >= 0);

comment on column public.suscripciones.precio_mensual is
  'Precio mensual del plan cuando empezó la suscripción. Lo usa el balance; null = sin precio.';

update public.suscripciones s
set precio_mensual = p.precio_mensual
from public.planes p
where p.id = s.plan_id;

create function public.copiar_precio_suscripcion()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.precio_mensual is null then
    select precio_mensual into new.precio_mensual from public.planes where id = new.plan_id;
  end if;
  return new;
end;
$$;

create trigger al_crear_suscripcion_precio
  before insert on public.suscripciones
  for each row execute function public.copiar_precio_suscripcion();

-- 2. Balance
create function public.balance_max_detalle()
returns integer
language sql immutable
as $$ select 500 $$;

create function public.admin_balance(
  p_anio integer,
  p_mes integer default null,
  p_dia integer default null,
  p_zona text default 'America/Caracas'
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  zona text := coalesce(nullif(trim(p_zona), ''), 'America/Caracas');
  inicio timestamptz;
  fin timestamptz;
  resultado jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  if p_anio is null or p_anio < 2000 or p_anio > 2100 then
    raise exception 'El año tiene que estar entre 2000 y 2100' using errcode = '22023';
  end if;
  if p_mes is not null and (p_mes < 1 or p_mes > 12) then
    raise exception 'El mes tiene que estar entre 1 y 12' using errcode = '22023';
  end if;
  if p_dia is not null and p_mes is null then
    raise exception 'Para filtrar por día elige también el mes' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = zona) then
    raise exception 'Zona horaria desconocida: %', zona using errcode = '22023';
  end if;

  begin
    inicio := make_timestamptz(p_anio, coalesce(p_mes, 1), coalesce(p_dia, 1), 0, 0, 0, zona);
    if extract(month from inicio at time zone zona) <> coalesce(p_mes, 1) then
      raise exception using errcode = '22008';
    end if;
  exception when datetime_field_overflow then
    raise exception 'Esa fecha no existe' using errcode = '22023';
  end;

  fin := case
    when p_dia is not null then (inicio at time zone zona + interval '1 day') at time zone zona
    when p_mes is not null then (inicio at time zone zona + interval '1 month') at time zone zona
    else (inicio at time zone zona + interval '1 year') at time zone zona
  end;

  with subs as (
    select s.usuario_id, s.plan_id, s.desde, s.hasta, s.precio_mensual,
           least(coalesce(s.hasta, now()), now(), fin) as limite
    from public.suscripciones s
    where s.precio_mensual > 0
      and s.desde < fin
      and coalesce(s.hasta, now()) >= inicio
      and not public.es_cuenta_admin(s.usuario_id)
  ),
  cobros as (
    select c.fecha, s.usuario_id, s.plan_id, s.precio_mensual as monto
    from subs s
    cross join lateral generate_series(
      0,
      (extract(year from age(s.limite, s.desde)) * 12
        + extract(month from age(s.limite, s.desde)))::integer + 1
    ) as k
    cross join lateral (select s.desde + k * interval '1 month' as fecha) c
    where c.fecha >= inicio
      and c.fecha < fin
      and c.fecha <= now()
      and (s.hasta is null or c.fecha < s.hasta)
  ),
  detalle as (
    select c.fecha, c.monto, p.nombre, p.email, pl.nombre as plan
    from cobros c
    join public.perfiles p on p.id = c.usuario_id
    join public.planes pl on pl.id = c.plan_id
  )
  select jsonb_build_object(
    'filtro', jsonb_build_object('anio', p_anio, 'mes', p_mes, 'dia', p_dia, 'zona', zona),
    'desde', inicio,
    'hasta', fin,
    'generado_en', now(),
    'generado_por', (select nombre from public.perfiles where id = auth.uid()),
    'total', coalesce((select sum(monto) from cobros), 0),
    'cobros', (select count(*) from cobros),
    'cuentas', (select count(distinct usuario_id) from cobros),
    'por_plan', coalesce((
      select jsonb_agg(jsonb_build_object(
               'plan', pl.nombre, 'codigo', pl.codigo,
               'cobros', x.cobros, 'total', x.total
             ) order by x.total desc, pl.orden)
      from (select plan_id, count(*) as cobros, sum(monto) as total
            from cobros group by plan_id) x
      join public.planes pl on pl.id = x.plan_id
    ), '[]'::jsonb),
    'serie', case
      when p_dia is not null then '[]'::jsonb
      when p_mes is not null then coalesce((
        select jsonb_agg(jsonb_build_object('periodo', d.periodo, 'cobros', d.cobros, 'total', d.total)
                         order by d.periodo)
        from (select to_char(fecha at time zone zona, 'YYYY-MM-DD') as periodo,
                     count(*) as cobros, sum(monto) as total
              from cobros group by 1) d
      ), '[]'::jsonb)
      else (
        select jsonb_agg(jsonb_build_object(
                 'periodo', to_char(make_date(p_anio, m, 1), 'YYYY-MM'),
                 'cobros', coalesce(x.cobros, 0),
                 'total', coalesce(x.total, 0)
               ) order by m)
        from generate_series(1, 12) as m
        left join (
          select extract(month from fecha at time zone zona)::integer as mes,
                 count(*) as cobros, sum(monto) as total
          from cobros group by 1
        ) x on x.mes = m
      )
    end,
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', d.fecha,
               'dia', to_char(d.fecha at time zone zona, 'YYYY-MM-DD'),
               'cuenta', d.nombre, 'email', d.email, 'plan', d.plan, 'monto', d.monto
             ) order by d.fecha, d.nombre)
      from (select * from detalle order by fecha, nombre limit public.balance_max_detalle()) d
    ), '[]'::jsonb),
    'detalle_total', (select count(*) from cobros)
  ) into resultado;

  return resultado;
end;
$$;

revoke execute on function public.copiar_precio_suscripcion() from public, anon, authenticated;
revoke execute on function public.balance_max_detalle() from public, anon;
revoke execute on function public.admin_balance(integer, integer, integer, text) from public, anon;
grant execute on function public.admin_balance(integer, integer, integer, text) to authenticated;

commit;