-- Prueba de la contraseña temporal. Se pega en el SQL Editor y no deja nada:
-- todo corre en una transacción que termina en rollback.
-- Si pasa, aparece el aviso "OK: clave inicial" y una fila "ok".
--
-- Requiere la migración 20261029000600_clave_inicial.

begin;

do $$
declare
  u uuid := gen_random_uuid();
  otro uuid := gen_random_uuid();
begin
  -- Una cuenta creada por el servidor con app_metadata.clave_temporal.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
    'prueba-clave@example.com', crypt('Temporal123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"clave_temporal":true}',
    '{"nombre":"Prueba"}', now(), now(), '', '', '', ''
  );
  -- Una cuenta común (sin la marca), como un registro normal.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', otro, 'authenticated', 'authenticated',
    'prueba-comun@example.com', crypt('Comun12345', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"nombre":"Comun"}', now(), now(), '', '', '', ''
  );

  assert exists (select 1 from public.claves_temporales where usuario_id = u),
    'La cuenta con clave temporal tiene que quedar anotada';
  assert not exists (select 1 from public.claves_temporales where usuario_id = otro),
    'Una cuenta común no tiene clave temporal';

  -- Como la cuenta con clave temporal.
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  assert public.debe_cambiar_clave(), 'Tiene que deber cambiar la clave';

  -- Sin cambiarla de verdad no se puede saltear.
  begin
    perform public.clave_cambiada();
    raise exception 'clave_cambiada tenía que fallar sin cambio de clave';
  exception when sqlstate '22023' then null;
  end;

  -- Cambia la contraseña (lo que hace GoTrue) y ahí sí se limpia la marca.
  update auth.users set encrypted_password = crypt('MiPropia456', gen_salt('bf')) where id = u;
  perform public.clave_cambiada();
  assert not public.debe_cambiar_clave(), 'La marca tenía que limpiarse';

  -- La cuenta común nunca debe cambiarla.
  perform set_config('request.jwt.claims', json_build_object('sub', otro)::text, true);
  perform set_config('request.jwt.claim.sub', otro::text, true);
  assert not public.debe_cambiar_clave(), 'La cuenta común no debe cambiar la clave';

  raise notice 'OK: clave inicial';
end $$;

rollback;

select 'ok' as resultado;
