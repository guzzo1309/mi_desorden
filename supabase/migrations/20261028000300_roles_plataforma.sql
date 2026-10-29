-- Roles definitivos:
--
--   inventario  owner   dueño de sus inventarios: todo, incluido invitar y borrar
--   inventario  editor  empleado: ajusta stock, edita productos, categorías y facturas
--   inventario  lector  empleado: solo mira (los cambios se los pide al owner)
--   plataforma  admin   dueño de MI DESORDEN: panel de KPIs, tokens y tiers
--
-- Las fotos y las invitaciones quedan solo para el owner.
--
-- Requiere 20261028000200_roles_uuid (roles.id uuid). Las filas se renombran
-- (admin → editor, employee → lector), así que los miembros conservan su rol
-- sin tocar miembros.rol_id.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ámbito y filas de roles
-- ---------------------------------------------------------------------------

alter table public.roles
  add column ambito text not null default 'inventario'
    check (ambito in ('inventario', 'plataforma'));

comment on column public.roles.ambito is
  'inventario: se asigna en miembros. plataforma: se asigna en perfiles (admin de MI DESORDEN).';

-- El "admin" de inventario de 20261028000100 era el editor; employee, el lector.
update public.roles set
  rol = 'editor',
  descripcion = 'Empleado que ajusta el stock y edita productos, categorías y facturas.',
  ver = true, ajustar_stock = true, editar_productos = true,
  gestionar_fotos = false, gestionar_accesos = false, eliminar_inventario = false
where rol = 'admin';

update public.roles set
  rol = 'lector',
  descripcion = 'Empleado que solo mira el inventario. Los cambios se los pide al owner.',
  ver = true, ajustar_stock = false, editar_productos = false,
  gestionar_fotos = false, gestionar_accesos = false, eliminar_inventario = false
where rol = 'employee';

update public.roles set
  descripcion = 'Dueño de sus inventarios: todo, incluido sacar fotos, invitar empleados y borrar el inventario.',
  ver = true, ajustar_stock = true, editar_productos = true,
  gestionar_fotos = true, gestionar_accesos = true, eliminar_inventario = true
where rol = 'owner';

-- Los permisos de inventario no aplican al admin: lo suyo es su propia vista.
insert into public.roles
  (rol, ambito, descripcion, ver, ajustar_stock, editar_productos, gestionar_fotos,
   gestionar_accesos, eliminar_inventario)
values
  ('admin', 'plataforma', 'Administrador de MI DESORDEN: KPIs, rendimiento, tokens y tiers.',
   false, false, false, false, false, false);

alter table public.miembros alter column rol_id set default public.rol_id('lector');

-- ---------------------------------------------------------------------------
-- 2. Cada rol en su lugar
-- ---------------------------------------------------------------------------

-- miembros e invitaciones solo con roles de inventario (y nunca owner por invitación).
create function public.validar_rol_inventario()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.roles where id = new.rol_id and ambito = 'inventario'
  ) then
    raise exception 'Ese rol no es de inventario' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger al_guardar_rol_miembro
  before insert or update of rol_id on public.miembros
  for each row execute function public.validar_rol_inventario();

create trigger al_guardar_rol_invitacion
  before insert or update of rol_id on public.invitaciones
  for each row execute function public.validar_rol_inventario();

-- perfiles.rol_id: rol de plataforma (null = usuario común, admin = vos).
alter table public.perfiles add column rol_id uuid references public.roles (id);

comment on column public.perfiles.rol_id is
  'Rol en MI DESORDEN (null = usuario). Se asigna solo por SQL, nunca desde la app.';

create function public.proteger_rol_perfil()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.rol_id is not distinct from old.rol_id then
    return new;
  end if;
  -- Con sesión (la app) nadie se cambia el rol: ni siquiera el propio perfil.
  if auth.uid() is not null then
    raise exception 'El rol de plataforma no se cambia desde la app' using errcode = '42501';
  end if;
  if new.rol_id is not null and not exists (
    select 1 from public.roles where id = new.rol_id and ambito = 'plataforma'
  ) then
    raise exception 'Ese rol no es de plataforma' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger al_cambiar_rol_perfil
  before update of rol_id on public.perfiles
  for each row execute function public.proteger_rol_perfil();

-- ¿Soy admin de MI DESORDEN? Para las políticas y la vista de administración.
create function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    join public.roles r on r.id = p.rol_id
    where p.id = auth.uid() and r.rol = 'admin'
  )
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Solo el owner invita y maneja a sus empleados (editor / lector)
-- ---------------------------------------------------------------------------

create or replace function public.puede_asignar(inv uuid, rol_objetivo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.mi_rol_id(inv) = public.rol_id('owner')
    and rol_objetivo in (public.rol_id('editor'), public.rol_id('lector'))
$$;

commit;

-- ---------------------------------------------------------------------------
-- Para hacerte admin (desde el SQL Editor; la app no puede):
--   update public.perfiles set rol_id = public.rol_id('admin') where email = 'tu@correo.com';
-- ---------------------------------------------------------------------------

-- Verificación
select r.rol, r.ambito, r.ajustar_stock, r.editar_productos, r.gestionar_fotos,
       r.gestionar_accesos, r.eliminar_inventario,
       (select count(*) from public.miembros m where m.rol_id = r.id) as miembros
from public.roles r
order by r.ambito, r.rol;
