-- Pedidos de cambio de plan.
--
-- Hoy el admin asigna los planes a mano (no hay cobro). Cuando un owner llega a
-- su límite puede pedir otro plan: el pedido le llega al admin, que lo aprueba
-- (el plan cambia solo) o lo rechaza.
--
--   - Un solo pedido pendiente por cuenta: si pide de nuevo, se reemplaza.
--   - El owner puede cancelar el suyo mientras esté pendiente.
--   - Si el admin cambia el plan a mano al plan pedido, el pedido se cierra solo.
--
-- Requiere 20261029000100_planes y 20261029000300_admin_gestion (es_cuenta_admin).

begin;

create table public.pedidos_plan (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  -- restrict: no se puede borrar un plan que alguien pidió.
  plan_id uuid not null references public.planes (id) on delete restrict,
  motivo text not null default '' check (char_length(motivo) <= 300),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references public.perfiles (id) on delete set null
);

-- Un solo pedido pendiente por cuenta.
create unique index pedidos_plan_pendiente_idx
  on public.pedidos_plan (usuario_id) where estado = 'pendiente';
create index pedidos_plan_plan_idx on public.pedidos_plan (plan_id);

alter table public.pedidos_plan enable row level security;

-- Cada uno ve los suyos. Se crean y se cancelan solo por las funciones de abajo.
create policy "ver mis pedidos de plan" on public.pedidos_plan for select to authenticated
  using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Del lado del owner
-- ---------------------------------------------------------------------------

-- Pide un plan. Si ya tenía un pedido pendiente, lo reemplaza.
create function public.pedir_plan(p_plan uuid, p_motivo text default '')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  resultado uuid;
begin
  if yo is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  if public.es_cuenta_admin(yo) then
    raise exception 'Los admin de la plataforma no tienen plan' using errcode = '22023';
  end if;
  if not exists (select 1 from public.planes where id = p_plan and activo) then
    raise exception 'Ese plan no existe o está archivado' using errcode = '22023';
  end if;
  if (public.plan_de(yo)).id = p_plan then
    raise exception 'Ya tenés ese plan' using errcode = '22023';
  end if;

  insert into public.pedidos_plan (usuario_id, plan_id, motivo)
  values (yo, p_plan, left(trim(coalesce(p_motivo, '')), 300))
  on conflict (usuario_id) where estado = 'pendiente'
  do update set plan_id = excluded.plan_id, motivo = excluded.motivo, creado_en = now()
  returning id into resultado;

  return resultado;
end;
$$;

-- Mi pedido pendiente, o null.
create function public.mi_pedido_plan()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
           'id', d.id, 'plan_id', d.plan_id, 'plan', pl.nombre,
           'motivo', d.motivo, 'creado_en', d.creado_en
         )
  from public.pedidos_plan d
  join public.planes pl on pl.id = d.plan_id
  where d.usuario_id = auth.uid() and d.estado = 'pendiente'
$$;

create function public.cancelar_pedido_plan()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.pedidos_plan
  set estado = 'cancelado', resuelto_en = now()
  where usuario_id = auth.uid() and estado = 'pendiente';
end;
$$;

-- ---------------------------------------------------------------------------
-- Del lado del admin
-- ---------------------------------------------------------------------------

create function public.admin_pedidos_plan()
returns table (
  id uuid,
  usuario_id uuid,
  nombre text,
  email text,
  plan_actual text,
  plan_pedido text,
  motivo text,
  creado_en timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;
  return query
    select d.id, d.usuario_id, p.nombre, p.email,
           (public.plan_de(d.usuario_id)).nombre, pl.nombre, d.motivo, d.creado_en
    from public.pedidos_plan d
    join public.perfiles p on p.id = d.usuario_id
    join public.planes pl on pl.id = d.plan_id
    where d.estado = 'pendiente'
    order by d.creado_en;
end;
$$;

-- Aprueba (cambia el plan de la cuenta) o rechaza un pedido.
create function public.admin_resolver_pedido(p_id uuid, p_aprobar boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pedido public.pedidos_plan;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  select * into pedido from public.pedidos_plan where id = p_id and estado = 'pendiente' for update;
  if not found then
    raise exception 'Ese pedido ya se resolvió o no existe' using errcode = '22023';
  end if;

  if p_aprobar then
    -- Cambia el plan (y cierra este pedido) con la misma función de siempre.
    perform public.admin_asignar_plan(pedido.usuario_id, pedido.plan_id);
  end if;

  update public.pedidos_plan
  set estado = case when p_aprobar then 'aprobado' else 'rechazado' end,
      resuelto_en = now(), resuelto_por = auth.uid()
  where id = p_id;

  insert into public.admin_log (admin_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(),
          case when p_aprobar then 'aprobar_pedido_plan' else 'rechazar_pedido_plan' end,
          'usuario', pedido.usuario_id::text,
          jsonb_build_object('pedido', p_id, 'plan', pedido.plan_id));
end;
$$;

-- Si el admin cambia el plan a mano al que la cuenta había pedido, el pedido se cierra.
create or replace function public.admin_asignar_plan(p_usuario uuid, p_plan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  vigente uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario) then
    raise exception 'Esa cuenta no existe' using errcode = '22023';
  end if;
  if not exists (select 1 from public.planes where id = p_plan and activo) then
    raise exception 'Ese plan no existe o está archivado' using errcode = '22023';
  end if;

  update public.pedidos_plan
  set estado = 'aprobado', resuelto_en = now(), resuelto_por = auth.uid()
  where usuario_id = p_usuario and plan_id = p_plan and estado = 'pendiente';

  select plan_id into vigente from public.suscripciones
  where usuario_id = p_usuario and hasta is null;
  if vigente = p_plan then
    return;
  end if;

  update public.suscripciones set hasta = now()
  where usuario_id = p_usuario and hasta is null;
  insert into public.suscripciones (usuario_id, plan_id, asignado_por)
  values (p_usuario, p_plan, auth.uid());

  insert into public.admin_log (admin_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'asignar_plan', 'usuario', p_usuario::text,
          jsonb_build_object('de', vigente, 'a', p_plan));
end;
$$;

revoke execute on function public.pedir_plan(uuid, text) from public, anon;
revoke execute on function public.mi_pedido_plan() from public, anon;
revoke execute on function public.cancelar_pedido_plan() from public, anon;
revoke execute on function public.admin_pedidos_plan() from public, anon;
revoke execute on function public.admin_resolver_pedido(uuid, boolean) from public, anon;
grant execute on function public.pedir_plan(uuid, text) to authenticated;
grant execute on function public.mi_pedido_plan() to authenticated;
grant execute on function public.cancelar_pedido_plan() to authenticated;
grant execute on function public.admin_pedidos_plan() to authenticated;
grant execute on function public.admin_resolver_pedido(uuid, boolean) to authenticated;

commit;

-- Verificación: la tabla tiene que existir y vacía; las del admin rechazan sin sesión.
select count(*) as pedidos from public.pedidos_plan;
