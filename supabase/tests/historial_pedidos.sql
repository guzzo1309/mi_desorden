-- Prueba del historial de movimientos y de los pedidos de plan. Se pega en el
-- SQL Editor y no deja nada: todo corre en una transacción que termina en rollback.
-- Si todo pasa, aparecen los avisos "OK: …" (pestaña Messages) y una fila "ok".
--
-- Requiere las migraciones 20261029000400_historial y 20261029000500_pedidos_plan.

begin;

do $$
declare
  u uuid := gen_random_uuid();
  inv uuid;
  prod uuid;
  pro uuid := (select id from public.planes where codigo = 'pro');
  pedido uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
    'prueba-historial@example.com', 'x', now(),
    '{"provider":"email","providers":["email"]}', '{"nombre":"Prueba"}', now(), now(),
    '', '', '', ''
  );

  insert into public.inventarios (nombre, creado_por) values ('Hist', u) returning id into inv;

  -- 1. Historial: alta, stock, edición, baja.
  insert into public.productos (inventario_id, nombre, cantidad, ubicacion)
  values (inv, 'Coca', 10, 'A1') returning id into prod;
  update public.productos set cantidad = 8 where id = prod;
  update public.productos set ubicacion = 'B2' where id = prod;
  delete from public.productos where id = prod;

  assert (select count(*) from public.movimientos where inventario_id = inv) = 4,
    'Tenían que quedar 4 movimientos';
  assert (select cantidad_antes from public.movimientos
          where inventario_id = inv and tipo = 'stock') = 10, 'Stock: antes distinto de 10';
  assert (select cantidad_despues from public.movimientos
          where inventario_id = inv and tipo = 'stock') = 8, 'Stock: después distinto de 8';
  assert (select detalle -> 'ubicacion' ->> 'a' from public.movimientos
          where inventario_id = inv and tipo = 'editado') = 'B2', 'La edición no guardó la ubicación';
  assert exists (select 1 from public.movimientos
                 where inventario_id = inv and tipo = 'eliminado' and producto_nombre = 'Coca'),
    'Falta el movimiento de baja';

  -- 2. El owner de un inventario no se puede cambiar.
  begin
    update public.inventarios set creado_por = gen_random_uuid() where id = inv;
    raise exception 'Cambiar creado_por tenía que fallar';
  exception when sqlstate '42501' then null;
  end;

  -- 3. Borrar un inventario con productos no se rompe por el historial.
  insert into public.productos (inventario_id, nombre, cantidad) values (inv, 'X', 1);
  delete from public.inventarios where id = inv;
  assert not exists (select 1 from public.movimientos where inventario_id = inv),
    'El historial tenía que borrarse con el inventario';

  -- 4. Pedidos de plan (con sesión simulada como esa cuenta).
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);

  pedido := public.pedir_plan(pro, 'más inventarios');
  assert (select (public.mi_pedido_plan() ->> 'plan')) = 'Pro', 'mi_pedido_plan no devolvió Pro';

  -- Pedir de nuevo reemplaza: sigue habiendo uno solo pendiente.
  perform public.pedir_plan(pro, 'otro motivo');
  assert (select count(*) from public.pedidos_plan where usuario_id = u and estado = 'pendiente') = 1,
    'Tiene que haber un solo pedido pendiente';

  begin
    perform public.pedir_plan((select id from public.planes where codigo = 'free'), '');
    raise exception 'Pedir el plan que ya tiene tenía que fallar';
  exception when sqlstate '22023' then null;
  end;

  perform public.cancelar_pedido_plan();
  assert public.mi_pedido_plan() is null, 'El pedido no se canceló';

  raise notice 'OK: historial y pedidos de plan';
end $$;

-- Las funciones del admin rechazan a quien no es admin.
do $$
begin
  begin perform public.admin_pedidos_plan(); raise exception 'admin_pedidos_plan dejó pasar';
  exception when sqlstate '42501' then null; end;
  begin perform public.admin_resolver_pedido(gen_random_uuid(), true); raise exception 'admin_resolver_pedido dejó pasar';
  exception when sqlstate '42501' then null; end;
  raise notice 'OK: funciones del admin protegidas';
end $$;

rollback;

select 'ok' as resultado;
