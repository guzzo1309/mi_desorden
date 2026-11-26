-- El admin ve el teléfono de las cuentas (si lo cargaron en su perfil).
--
-- Requiere 20261126000100_admin_avatares.

begin;

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
  plan_nombre text,
  suspendido boolean,
  avatar_path text,
  telefono text
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
           pl.id, pl.nombre,
           coalesce(u.banned_until > now(), false),
           p.avatar_path,
           p.telefono
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.roles r on r.id = p.rol_id
    cross join lateral public.plan_de(p.id) pl
    order by p.creado_en desc;
end;
$$;

revoke execute on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;

commit;
