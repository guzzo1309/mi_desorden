-- Contraseña inicial: el owner crea la cuenta de su empleado con una contraseña
-- temporal y, al entrar por primera vez, la app lo obliga a elegir la suya.
--
-- La API (con la service key) crea la cuenta marcándola con
-- app_metadata.clave_temporal = true. El trigger de registro anota entonces el
-- hash de esa contraseña en `claves_temporales`, una tabla privada (sin
-- políticas: ni siquiera el dueño de la cuenta la lee).
--
--   debe_cambiar_clave()  ¿mi cuenta todavía tiene la contraseña que me puso el owner?
--   clave_cambiada()      la app la llama después de cambiarla. Solo limpia la marca
--                         si el hash actual es distinto del temporal: no se puede
--                         saltear llamando a la función sin cambiar la contraseña.
--
-- Requiere 20261029000100_planes (crear_perfil con la suscripción Free).

begin;

create table public.claves_temporales (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  -- Hash bcrypt de la contraseña temporal, para saber si ya la cambió.
  hash text not null,
  creado_en timestamptz not null default now()
);

alter table public.claves_temporales enable row level security;
-- Sin políticas a propósito: solo las funciones de abajo (security definer) la tocan.

-- crear_perfil: igual que antes (perfil + plan Free) y, si la cuenta la creó un
-- owner con contraseña temporal, anota la marca.
create or replace function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    lower(new.email)
  );
  insert into public.suscripciones (usuario_id, plan_id)
  select new.id, id from public.planes where codigo = 'free';

  -- app_metadata solo la escribe el servidor: el usuario no se la puede poner.
  if new.raw_app_meta_data ->> 'clave_temporal' = 'true' and new.encrypted_password is not null then
    insert into public.claves_temporales (usuario_id, hash)
    values (new.id, new.encrypted_password);
  end if;
  return new;
end;
$$;

create function public.debe_cambiar_clave()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.claves_temporales where usuario_id = auth.uid())
$$;

create function public.clave_cambiada()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  if not exists (select 1 from public.claves_temporales where usuario_id = yo) then
    return;
  end if;

  if exists (
    select 1
    from public.claves_temporales c
    join auth.users u on u.id = c.usuario_id
    where c.usuario_id = yo and u.encrypted_password is distinct from c.hash
  ) then
    delete from public.claves_temporales where usuario_id = yo;
  else
    raise exception 'Todavía no cambiaste la contraseña' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.debe_cambiar_clave() from public, anon;
revoke execute on function public.clave_cambiada() from public, anon;
grant execute on function public.debe_cambiar_clave() to authenticated;
grant execute on function public.clave_cambiada() to authenticated;

commit;

-- Verificación: la tabla existe y está vacía (nadie tiene contraseña temporal todavía).
select count(*) as con_clave_temporal from public.claves_temporales;
