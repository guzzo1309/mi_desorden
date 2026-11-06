create or replace function public.kpis_plataforma(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_usuario uuid default null
) returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'usuarios_total',   (select count(*) from public.perfiles
                          where p_usuario is null or id = p_usuario),
    'usuarios_nuevos',  (select count(*) from public.perfiles
                          where creado_en between p_desde and p_hasta
                            and (p_usuario is null or id = p_usuario)),
    'usuarios_activos', (select count(distinct usuario_id) from public.usos_api
                          where creado_en between p_desde and p_hasta
                            and usuario_id is not null
                            and (p_usuario is null or usuario_id = p_usuario)),
    'inventarios',      (select count(*) from public.inventarios
                          where p_usuario is null or creado_por = p_usuario),
    'productos',        (select count(*) from public.productos pr
                          join public.inventarios i on i.id = pr.inventario_id
                          where pr.creado_en between p_desde and p_hasta
                            and (p_usuario is null or i.creado_por = p_usuario)),
    'productos_movidos',(select count(*) from public.productos pr
                          join public.inventarios i on i.id = pr.inventario_id
                          where pr.actualizado_en between p_desde and p_hasta
                            and (p_usuario is null or i.creado_por = p_usuario)),
    'usos',             (select count(*) from public.usos_api
                          where creado_en between p_desde and p_hasta
                            and (p_usuario is null or usuario_id = p_usuario)),
    'usos_con_error',   (select count(*) from public.usos_api
                          where creado_en between p_desde and p_hasta
                            and estado >= 400
                            and (p_usuario is null or usuario_id = p_usuario)),
    'invitaciones',     (select count(*) from public.invitaciones inv
                          join public.inventarios i on i.id = inv.inventario_id
                          where p_usuario is null or i.creado_por = p_usuario),
    'memoria_bytes',    (select coalesce(sum((o.metadata->>'size')::bigint), 0)
                          from storage.objects o
                          join public.productos pr on pr.foto_path = o.name
                          join public.inventarios i on i.id = pr.inventario_id
                          where o.bucket_id = 'productos'
                            and (p_usuario is null or i.creado_por = p_usuario))
  );
end;
$fn$;

create or replace function public.trafico_por_hora(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_usuario uuid default null
) returns table (hora int, usos bigint)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return query
    select h.hora, count(u.id)
    from generate_series(0, 23) as h(hora)
    left join public.usos_api u
      on date_part('hour', u.creado_en) = h.hora
     and u.creado_en between p_desde and p_hasta
     and (p_usuario is null or u.usuario_id = p_usuario)
    group by h.hora
    order by h.hora;
end;
$fn$;

create or replace function public.serie_productos(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_usuario uuid default null
) returns table (dia date, productos bigint)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return query
    select d::date, count(x.id)
    from generate_series(p_desde::date, p_hasta::date, interval '1 day') as d
    left join lateral (
      select pr.id
      from public.productos pr
      join public.inventarios i on i.id = pr.inventario_id
      where pr.creado_en::date = d::date
        and (p_usuario is null or i.creado_por = p_usuario)
    ) x on true
    group by d
    order by d;
end;
$fn$;

create or replace function public.uso_por_usuario(
  p_desde timestamptz,
  p_hasta timestamptz
) returns table (
  usuario_id uuid, nombre text, email text, es_admin boolean,
  usos bigint, errores bigint, productos bigint, movidos bigint
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, p.email, p.es_admin,
      (select count(*) from public.usos_api u
        where u.usuario_id = p.id and u.creado_en between p_desde and p_hasta),
      (select count(*) from public.usos_api u
        where u.usuario_id = p.id and u.creado_en between p_desde and p_hasta
          and u.estado >= 400),
      (select count(*) from public.productos pr
        join public.inventarios i on i.id = pr.inventario_id
        where i.creado_por = p.id and pr.creado_en between p_desde and p_hasta),
      (select count(*) from public.productos pr
        join public.inventarios i on i.id = pr.inventario_id
        where i.creado_por = p.id and pr.actualizado_en between p_desde and p_hasta)
    from public.perfiles p
    order by 5 desc;
end;
$fn$;

create or replace function public.eventos_usuario(
  p_usuario uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_limit int default 50
) returns table (ruta text, metodo text, estado int, duracion_ms int, creado_en timestamptz)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return query
    select u.ruta, u.metodo, u.estado, u.duracion_ms, u.creado_en
    from public.usos_api u
    where u.usuario_id = p_usuario
      and u.creado_en between p_desde and p_hasta
    order by u.creado_en desc
    limit least(p_limit, 200);
end;
$fn$;

revoke execute on function public.kpis_plataforma(timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.trafico_por_hora(timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.serie_productos(timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.uso_por_usuario(timestamptz, timestamptz) from public, anon;
revoke execute on function public.eventos_usuario(uuid, timestamptz, timestamptz, int) from public, anon;

grant execute on function public.kpis_plataforma(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.trafico_por_hora(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.serie_productos(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.uso_por_usuario(timestamptz, timestamptz) to authenticated;
grant execute on function public.eventos_usuario(uuid, timestamptz, timestamptz, int) to authenticated;