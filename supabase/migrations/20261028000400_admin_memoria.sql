create or replace function public.memoria_por_usuario()
returns table (usuario_id uuid, nombre text, email text, archivos bigint, bytes bigint)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, p.email, count(o.id),
           coalesce(sum((o.metadata->>'size')::bigint), 0)
    from public.perfiles p
    left join public.inventarios i on i.creado_por = p.id
    left join public.productos pr on pr.inventario_id = i.id and pr.foto_path is not null
    left join storage.objects o on o.bucket_id = 'productos' and o.name = pr.foto_path
    group by p.id, p.nombre, p.email
    order by 5 desc;
end;
$fn$;

-- Moderación: libera las fotos de los inventarios de un usuario.
create or replace function public.liberar_fotos(p_usuario uuid)
returns integer language plpgsql security definer set search_path = ''
as $fn$
declare
  borrados integer;
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  with objetivos as (
    select pr.id, pr.foto_path
    from public.productos pr
    join public.inventarios i on i.id = pr.inventario_id
    where i.creado_por = p_usuario and pr.foto_path is not null
  ), borrado as (
    delete from storage.objects o
    using objetivos t
    where o.bucket_id = 'productos' and o.name = t.foto_path
    returning o.id
  ), limpieza as (
    update public.productos pr
    set foto_path = null
    from objetivos t
    where pr.id = t.id
    returning pr.id
  )
  select count(*) into borrados from borrado;

  return borrados;
end;
$fn$;

revoke execute on function public.memoria_por_usuario() from public, anon;
revoke execute on function public.liberar_fotos(uuid) from public, anon;
grant execute on function public.memoria_por_usuario() to authenticated;
grant execute on function public.liberar_fotos(uuid) to authenticated;