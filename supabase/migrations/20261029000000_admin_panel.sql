-- Panel del admin de MI DESORDEN: resumen de KPIs y lista de cuentas.
--
-- El admin ve cifras agregadas y datos de cuenta, no el contenido de los
-- inventarios de los demás. Por eso todo sale de funciones security definer
-- que exigen es_admin(), y no de permisos extra de lectura sobre las tablas.
--
-- Requiere 20261028000300_roles_plataforma (es_admin, perfiles.rol_id).

begin;

-- ---------------------------------------------------------------------------
-- Resumen: totales, altas recientes y usuarios activos
-- ---------------------------------------------------------------------------

create function public.admin_resumen()
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
    'cuentas',        (select count(*) from public.perfiles),
    'nuevas_7d',      (select count(*) from public.perfiles where creado_en > now() - interval '7 days'),
    'nuevas_30d',     (select count(*) from public.perfiles where creado_en > now() - interval '30 days'),
    'activos_7d',     (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'inventarios',    (select count(*) from public.inventarios),
    'productos',      (select count(*) from public.productos),
    'categorias',     (select count(*) from public.categorias),
    'invitaciones',   (select count(*) from public.invitaciones),
    -- Altas por día, últimos 14 días (incluye los días sin altas).
    'altas_por_dia',  (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'altas', coalesce(a.altas, 0)) order by d.dia), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') as d(dia)
      left join (
        select creado_en::date as dia, count(*) as altas
        from public.perfiles
        where creado_en >= current_date - 13
        group by 1
      ) a on a.dia = d.dia::date
    )
  ) into resultado;

  return resultado;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuarios: una fila por cuenta
-- ---------------------------------------------------------------------------

create function public.admin_usuarios()
returns table (
  id uuid,
  nombre text,
  email text,
  creado_en timestamptz,
  ultimo_acceso timestamptz,
  inventarios bigint,
  es_admin boolean
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
           coalesce(r.rol = 'admin', false)
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.roles r on r.id = p.rol_id
    order by p.creado_en desc;
end;
$$;

revoke execute on function public.admin_resumen() from public, anon;
revoke execute on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_resumen() to authenticated;
grant execute on function public.admin_usuarios() to authenticated;

commit;
