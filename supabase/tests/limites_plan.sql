-- Prueba de los planes y sus límites. Se pega en el SQL Editor y no deja nada:
-- todo corre dentro de una transacción que termina en rollback.
--
-- Si algo falla, el error dice cuál. Si todo pasa, aparece el aviso final
-- "OK: planes y límites" (pestaña Messages del editor) y el resultado es una fila "ok".
--
-- Requiere las migraciones 20261029000100_planes y 20261029000200_limites_plan.

begin;

do $$
declare
  u uuid := gen_random_uuid();
  inv uuid;
  libre uuid := (select id from public.planes where codigo = 'free');
  pro uuid := (select id from public.planes where codigo = 'pro');
begin
  -- Límites chicos para probar rápido (el rollback final los devuelve).
  update public.planes set max_inventarios = 1, max_productos = 2, max_personas = 2
  where codigo = 'free';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
    'prueba-limites@example.com', 'x', now(),
    '{"provider":"email","providers":["email"]}', '{"nombre":"Prueba"}', now(), now(),
    '', '', '', ''
  );

  -- 1. Toda cuenta nueva arranca en Free.
  assert exists (
    select 1 from public.suscripciones where usuario_id = u and plan_id = libre and hasta is null
  ), 'La cuenta nueva no quedó en Free';

  -- 2. Inventarios: el primero entra, el segundo no.
  insert into public.inventarios (nombre, creado_por) values ('Uno', u) returning id into inv;
  begin
    insert into public.inventarios (nombre, creado_por) values ('Dos', u);
    raise exception 'El segundo inventario tenía que fallar';
  exception when sqlstate '53400' then null;
  end;

  -- 3. Productos: dos entran, el tercero no.
  insert into public.productos (inventario_id, nombre) values (inv, 'A'), (inv, 'B');
  begin
    insert into public.productos (inventario_id, nombre) values (inv, 'C');
    raise exception 'El tercer producto tenía que fallar';
  exception when sqlstate '53400' then null;
  end;

  -- 4. Personas: el owner ya cuenta 1; una invitación suma otra; la siguiente no.
  insert into public.invitaciones (inventario_id, email, rol_id)
  values (inv, 'a@example.com', public.rol_id('lector'));
  begin
    insert into public.invitaciones (inventario_id, email, rol_id)
    values (inv, 'b@example.com', public.rol_id('lector'));
    raise exception 'La segunda invitación tenía que fallar';
  exception when sqlstate '53400' then null;
  end;

  -- 5. Con un plan ilimitado en un límite, no frena.
  update public.planes set max_productos = null where codigo = 'free';
  insert into public.productos (inventario_id, nombre) values (inv, 'C'), (inv, 'D');

  -- 6. Bajar el límite no borra nada: lo que ya hay se conserva.
  update public.planes set max_productos = 1 where codigo = 'free';
  assert (select count(*) from public.productos where inventario_id = inv) = 4,
    'Bajar el límite borró productos';

  -- 7. Cambiar de plan: cierra la suscripción vigente y deja una sola.
  update public.suscripciones set hasta = now() where usuario_id = u and hasta is null;
  insert into public.suscripciones (usuario_id, plan_id) values (u, pro);
  assert (select count(*) from public.suscripciones where usuario_id = u and hasta is null) = 1,
    'Tiene que haber una sola suscripción vigente';
  assert (select (public.plan_de(u)).codigo) = 'pro', 'plan_de no devolvió Pro';

  -- 8. Un plan con cuentas no se puede borrar.
  begin
    delete from public.planes where codigo = 'pro';
    raise exception 'Borrar un plan con cuentas tenía que fallar';
  exception when foreign_key_violation then null;
  end;

  raise notice 'OK: planes y límites';
end $$;

-- Las funciones del admin rechazan a quien no es admin (acá no hay sesión).
do $$
begin
  begin perform public.admin_planes(); raise exception 'admin_planes dejó pasar';
  exception when sqlstate '42501' then null; end;
  begin perform public.admin_asignar_plan(gen_random_uuid(), gen_random_uuid()); raise exception 'admin_asignar_plan dejó pasar';
  exception when sqlstate '42501' then null; end;
  raise notice 'OK: funciones del admin protegidas';
end $$;

rollback;

select 'ok' as resultado;
