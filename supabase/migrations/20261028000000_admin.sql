alter table public.perfiles add column if not exists es_admin boolean not null default false;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select coalesce((select p.es_admin from public.perfiles p where p.id = auth.uid()), false)
$fn$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

create or replace function public.dar_admin(correo text, valor boolean default true)
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  update public.perfiles set es_admin = valor where email = lower(trim(correo));
  if not found then
    raise exception 'No hay cuenta con ese correo' using errcode = 'P0002';
  end if;
end;
$fn$;

revoke execute on function public.dar_admin(text, boolean) from public, anon;
grant execute on function public.dar_admin(text, boolean) to authenticated;

drop policy if exists "admin ve todos los perfiles" on public.perfiles;
create policy "admin ve todos los perfiles" on public.perfiles
  for select to authenticated using (public.es_admin());