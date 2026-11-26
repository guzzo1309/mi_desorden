-- El admin ve la foto de perfil de las cuentas.
--
--   - admin_usuarios devuelve también avatar_path.
--   - El admin puede leer el bucket "avatares" (la policy de antes solo dejaba ver
--     las fotos de perfiles visibles, y el admin no comparte inventarios).
--
-- Requiere 20261125000000_perfil_personalizable y 20261029000300_admin_gestion.

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
  avatar_path text
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
           p.avatar_path
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.roles r on r.id = p.rol_id
    cross join lateral public.plan_de(p.id) pl
    order by p.creado_en desc;
end;
$$;

revoke execute on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;

drop policy if exists "avatares: el admin ve todos" on storage.objects;
create policy "avatares: el admin ve todos" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and public.es_admin());

commit;
