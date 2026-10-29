-- Tabla de roles: el catálogo de roles de un inventario con su nombre y
-- descripción, en vez de que solo existan como valores del tipo public.rol.
--
-- El id es el mismo valor del tipo ('dueño', 'editor', 'lector'): así
-- miembros.rol e invitaciones.rol pasan a apuntar a esta tabla con una clave
-- foránea sin cambiar columnas, funciones ni políticas (que siguen comparando
-- con 'dueño', etc.).
--
-- Para sumar un rol nuevo hacen falta dos pasos:
--   alter type public.rol add value 'nuevo';
--   insert into public.roles (id, nombre, descripcion, orden) values ('nuevo', …);
-- y revisar las políticas que deban darle permisos.
--
-- El administrador de MI DESORDEN (tiers, KPIs) no es un rol de inventario:
-- va aparte, con el panel de administración.

create table public.roles (
  id public.rol primary key,
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 40),
  descripcion text not null default '',
  -- De más a menos permisos: para listarlos en orden en la app.
  orden smallint not null unique
);

comment on table public.roles is 'Roles de un inventario. id = valor de public.rol.';

insert into public.roles (id, nombre, descripcion, orden) values
  ('dueño', 'Dueño',
   'Control total del inventario: productos, categorías, fotos y quién tiene acceso.', 1),
  ('editor', 'Editor',
   'Agrega y cambia productos y categorías, y carga facturas. No cambia fotos ni accesos.', 2),
  ('lector', 'Lector',
   'Solo mira el inventario.', 3);

-- Catálogo de solo lectura para cualquiera con sesión; se cambia con migraciones.
alter table public.roles enable row level security;
create policy "ver roles" on public.roles for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Las columnas de rol apuntan a la tabla
-- ---------------------------------------------------------------------------

alter table public.miembros
  add constraint miembros_rol_fkey foreign key (rol) references public.roles (id);

alter table public.invitaciones
  add constraint invitaciones_rol_fkey foreign key (rol) references public.roles (id);
