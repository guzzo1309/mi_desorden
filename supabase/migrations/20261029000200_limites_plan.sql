-- Límites de los planes, aplicados en la base.
--
-- La app puede avisar antes, pero la regla vive acá: un insert que pasa el
-- límite del plan del owner falla con el código 53400 y un mensaje para mostrar.
--
--   inventarios  los que creó la cuenta (creado_por)          → planes.max_inventarios
--   productos    los de cada inventario                       → planes.max_productos
--   personas     miembros + invitaciones pendientes del inv.  → planes.max_personas
--
-- Solo frenan altas nuevas. Si alguien queda por encima del límite (por
-- ejemplo al bajar de plan) conserva todo lo que ya tiene.
--
-- Cada chequeo bloquea la fila del owner en perfiles (for update): dos altas
-- simultáneas se ponen en fila y no pueden colarse las dos por el mismo cupo.
--
-- Requiere 20261029000100_planes.

begin;

-- Falla si `usado` ya llegó a `limite` (null = ilimitado).
create function public.exigir_cupo(usado bigint, limite integer, mensaje text)
returns void
language plpgsql set search_path = ''
as $$
begin
  if limite is not null and usado >= limite then
    raise exception '%', mensaje using errcode = '53400';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inventarios: los que creó la cuenta
-- ---------------------------------------------------------------------------

create function public.limite_inventarios()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  plan public.planes;
begin
  perform 1 from public.perfiles where id = new.creado_por for update;
  plan := public.plan_de(new.creado_por);
  perform public.exigir_cupo(
    (select count(*) from public.inventarios where creado_por = new.creado_por),
    plan.max_inventarios,
    format('Tu plan %s permite %s %s. Pasá a otro plan para crear más.',
           plan.nombre, plan.max_inventarios,
           case plan.max_inventarios when 1 then 'inventario' else 'inventarios' end)
  );
  return new;
end;
$$;

create trigger al_limitar_inventarios
  before insert on public.inventarios
  for each row execute function public.limite_inventarios();

-- ---------------------------------------------------------------------------
-- Productos: por inventario, con el plan del owner
-- ---------------------------------------------------------------------------

create function public.limite_productos()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  duenio uuid;
  plan public.planes;
begin
  select creado_por into duenio from public.inventarios where id = new.inventario_id;
  if duenio is null then
    return new;
  end if;
  perform 1 from public.perfiles where id = duenio for update;
  plan := public.plan_de(duenio);
  perform public.exigir_cupo(
    (select count(*) from public.productos where inventario_id = new.inventario_id),
    plan.max_productos,
    format('Este inventario llegó al límite de su plan %s (%s productos). Pedile al owner que cambie de plan.',
           plan.nombre, plan.max_productos)
  );
  return new;
end;
$$;

create trigger al_limitar_productos
  before insert on public.productos
  for each row execute function public.limite_productos();

-- ---------------------------------------------------------------------------
-- Personas: miembros + invitaciones pendientes
-- ---------------------------------------------------------------------------

-- Chequeo compartido por los triggers de miembros e invitaciones.
create function public.verificar_cupo_personas(inv uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  duenio uuid;
  plan public.planes;
begin
  select creado_por into duenio from public.inventarios where id = inv;
  if duenio is null then
    return;
  end if;
  perform 1 from public.perfiles where id = duenio for update;
  plan := public.plan_de(duenio);
  perform public.exigir_cupo(
    (select count(*) from public.miembros where inventario_id = inv)
      + (select count(*) from public.invitaciones where inventario_id = inv),
    plan.max_personas,
    format('Este inventario llegó al límite de su plan %s (%s personas). Cambiá de plan para invitar a más.',
           plan.nombre, plan.max_personas)
  );
end;
$$;

create function public.limite_personas()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.verificar_cupo_personas(new.inventario_id);
  return new;
end;
$$;

-- Miembros: solo cuando el owner agrega a otra persona (invitar). No frena el
-- alta del propio owner al crear el inventario, ni aceptar_invitaciones: esa
-- invitación ya contaba como persona y pasa a ser miembro sin sumar.
create function public.limite_personas_miembro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and new.usuario_id <> auth.uid() then
    perform public.verificar_cupo_personas(new.inventario_id);
  end if;
  return new;
end;
$$;

create trigger al_limitar_miembros
  before insert on public.miembros
  for each row execute function public.limite_personas_miembro();

create trigger al_limitar_invitaciones
  before insert on public.invitaciones
  for each row execute function public.limite_personas();

revoke execute on function public.exigir_cupo(bigint, integer, text) from public, anon, authenticated;
revoke execute on function public.limite_inventarios() from public, anon, authenticated;
revoke execute on function public.limite_productos() from public, anon, authenticated;
revoke execute on function public.verificar_cupo_personas(uuid) from public, anon, authenticated;
revoke execute on function public.limite_personas() from public, anon, authenticated;
revoke execute on function public.limite_personas_miembro() from public, anon, authenticated;

commit;

-- Verificación: los 5 triggers de límites tienen que aparecer.
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_schema = 'public' and trigger_name like 'al_limitar_%'
order by 1, 2;
