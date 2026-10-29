-- Historial de pedidos de plan ya resueltos, para el admin.
--
-- Un pedido que se aprueba, se rechaza o lo cancela el owner sale de la lista de
-- pendientes y hasta ahora no quedaba rastro visible. Esta función lista los más
-- recientes (con quién lo resolvió) para mostrarlos en la pestaña Planes.
--
-- Requiere 20261029000500_pedidos_plan.

begin;

create function public.admin_pedidos_resueltos(p_limite integer default 20)
returns table (
  id uuid,
  usuario_id uuid,
  nombre text,
  plan_pedido text,
  estado text,
  motivo text,
  creado_en timestamptz,
  resuelto_en timestamptz,
  resuelto_por_nombre text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;
  return query
    select d.id, d.usuario_id, p.nombre, pl.nombre, d.estado, d.motivo,
           d.creado_en, d.resuelto_en, r.nombre
    from public.pedidos_plan d
    join public.perfiles p on p.id = d.usuario_id
    join public.planes pl on pl.id = d.plan_id
    left join public.perfiles r on r.id = d.resuelto_por
    where d.estado <> 'pendiente'
    order by coalesce(d.resuelto_en, d.creado_en) desc
    limit greatest(1, least(coalesce(p_limite, 20), 100));
end;
$$;

revoke execute on function public.admin_pedidos_resueltos(integer) from public, anon;
grant execute on function public.admin_pedidos_resueltos(integer) to authenticated;

commit;

-- Verificación: en el SQL Editor no hay sesión de admin, así que tiene que rechazar con
-- "Solo el admin de la plataforma".
--   select * from public.admin_pedidos_resueltos();
