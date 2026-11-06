-- roles.id pasa de smallint a uuid (y con él miembros.rol_id e
-- invitaciones.rol_id). Se rehacen las funciones y políticas que usaban el
-- tipo del id. Los roles se siguen buscando por nombre ('owner', …), así que
-- nada depende del valor del id.

begin;

-- 1. Políticas que usan puede_asignar / rol_id (se recrean al final)
drop policy if exists "cambiar roles" on public.miembros;
drop policy if exists "quitar acceso o irse" on public.miembros;
drop policy if exists "cancelar invitaciones" on public.invitaciones;

-- 2. Funciones con el id smallint en la firma o en el resultado
drop function if exists public.puede_asignar(uuid, smallint);
drop function if exists public.mi_rol_id(uuid);
drop function if exists public.rol_id(text);

-- 3. Id nuevo en roles y columnas nuevas que apuntan a él
alter table public.roles add column id_nuevo uuid not null default gen_random_uuid();

alter table public.miembros add column rol_nuevo uuid;
update public.miembros m set rol_nuevo = r.id_nuevo from public.roles r where r.id = m.rol_id;

alter table public.invitaciones add column rol_nuevo uuid;
update public.invitaciones i set rol_nuevo = r.id_nuevo from public.roles r where r.id = i.rol_id;

-- 4. Fuera las columnas viejas, adentro las nuevas con su nombre
alter table public.miembros drop column rol_id;
alter table public.invitaciones drop column rol_id;

alter table public.roles drop constraint roles_pkey;
alter table public.roles drop column id;
alter table public.roles rename column id_nuevo to id;
alter table public.roles add primary key (id);

alter table public.miembros rename column rol_nuevo to rol_id;
alter table public.miembros alter column rol_id set not null;
alter table public.miembros
  add constraint miembros_rol_id_fkey foreign key (rol_id) references public.roles (id);

alter table public.invitaciones rename column rol_nuevo to rol_id;
alter table public.invitaciones alter column rol_id set not null;
alter table public.invitaciones
  add constraint invitaciones_rol_id_fkey foreign key (rol_id) references public.roles (id);

-- 5. Funciones con uuid
create function public.rol_id(nombre text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.roles where rol = nombre
$$;

create function public.mi_rol_id(inv uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select rol_id from public.miembros where inventario_id = inv and usuario_id = auth.uid()
$$;

-- El owner maneja admins y employees; un admin, solo employees. Al owner no lo toca nadie.
create function public.puede_asignar(inv uuid, rol_objetivo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when rol_objetivo = public.rol_id('owner') then false
    when public.mi_rol_id(inv) = public.rol_id('owner') then true
    when public.puede(inv, 'gestionar_accesos') then rol_objetivo = public.rol_id('employee')
    else false
  end
$$;

revoke execute on function public.rol_id(text) from public, anon;
revoke execute on function public.mi_rol_id(uuid) from public, anon;
revoke execute on function public.puede_asignar(uuid, uuid) from public, anon;
grant execute on function public.rol_id(text) to authenticated;
grant execute on function public.mi_rol_id(uuid) to authenticated;
grant execute on function public.puede_asignar(uuid, uuid) to authenticated;

-- Un miembro nuevo sin rol explícito es employee.
alter table public.miembros alter column rol_id set default public.rol_id('employee');

-- invitar(): misma firma, el rol objetivo ahora es uuid.
create or replace function public.invitar(inv uuid, correo text, nuevo_rol text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  limpio text := lower(trim(correo));
  objetivo uuid := public.rol_id(nuevo_rol);
  invitado uuid;
begin
  if not public.puede(inv, 'gestionar_accesos') then
    raise exception 'No tenés permiso para invitar' using errcode = '42501';
  end if;
  if objetivo is null then
    raise exception 'Ese rol no existe' using errcode = '22023';
  end if;
  if not public.puede_asignar(inv, objetivo) then
    raise exception 'No podés dar el rol %', nuevo_rol using errcode = '42501';
  end if;
  if limpio !~ '^\S+@\S+\.\S+$' then
    raise exception 'El correo no es válido' using errcode = '22023';
  end if;

  select id into invitado from public.perfiles where email = limpio;

  if invitado is not null then
    insert into public.miembros (inventario_id, usuario_id, rol_id)
    values (inv, invitado, objetivo)
    on conflict (inventario_id, usuario_id) do update set rol_id = excluded.rol_id
      where public.puede_asignar(inv, public.miembros.rol_id);
    delete from public.invitaciones where inventario_id = inv and email = limpio;
    return 'miembro';
  end if;

  insert into public.invitaciones (inventario_id, email, rol_id, invitado_por)
  values (inv, limpio, objetivo, auth.uid())
  on conflict (inventario_id, email) do update set rol_id = excluded.rol_id, creado_en = now();
  return 'pendiente';
end;
$$;

-- 6. Políticas de nuevo
create policy "cambiar roles" on public.miembros for update to authenticated
  using (public.puede_asignar(inventario_id, rol_id))
  with check (public.puede_asignar(inventario_id, rol_id));
create policy "quitar acceso o irse" on public.miembros for delete to authenticated
  using (
    rol_id <> public.rol_id('owner')
    and (usuario_id = auth.uid() or public.puede_asignar(inventario_id, rol_id))
  );
create policy "cancelar invitaciones" on public.invitaciones for delete to authenticated
  using (public.puede_asignar(inventario_id, rol_id));

commit;

-- Verificación: los 3 roles con su uuid y cuántos miembros tiene cada uno.
select r.id, r.rol, (select count(*) from public.miembros m where m.rol_id = r.id) as miembros
from public.roles r
order by r.rol;
