-- Gestión del admin: resumen sin contar a los admin, detalle de una cuenta y
-- suspender / reactivar cuentas.
--
-- El resumen ahora cuenta solo clientes (los admin de la plataforma no entran
-- en "Cuentas", "Nuevas" ni "Activas") y suma dos bloques: cuentas por plan y
-- las que están cerca del límite de su plan.
--
-- Suspender usa auth.users.banned_until: la cuenta no puede iniciar sesión y se
-- cierran sus sesiones. El access token que ya tenga sigue valiendo hasta que
-- venza (cerca de una hora). Queda registrado en admin_log.
--
-- Requiere 20261029000100_planes y 20261029000200_limites_plan.

begin;

-- ¿Esta cuenta es admin de la plataforma? Uso interno de las funciones admin_*.
create function public.es_cuenta_admin(cuenta uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    join public.roles r on r.id = p.rol_id
    where p.id = cuenta and r.rol = 'admin'
  )
$$;

revoke execute on function public.es_cuenta_admin(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resumen
-- ---------------------------------------------------------------------------

create or replace function public.admin_resumen()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'cuentas',     (select count(*) from public.perfiles p
                    where not public.es_cuenta_admin(p.id)),
    'nuevas_7d',   (select count(*) from public.perfiles p
                    where p.creado_en > now() - interval '7 days'
                      and not public.es_cuenta_admin(p.id)),
    'nuevas_30d',  (select count(*) from public.perfiles p
                    where p.creado_en > now() - interval '30 days'
                      and not public.es_cuenta_admin(p.id)),
    'activos_7d',  (select count(*) from auth.users u
                    where u.last_sign_in_at > now() - interval '7 days'
                      and not public.es_cuenta_admin(u.id)),
    'inventarios', (select count(*) from public.inventarios),
    'productos',   (select count(*) from public.productos),
    'categorias',  (select count(*) from public.categorias),
    'invitaciones', (select count(*) from public.invitaciones),

    -- Altas por día, últimos 14 días (incluye los días sin altas).
    'altas_por_dia', (
      select coalesce(jsonb_agg(
               jsonb_build_object('dia', d.dia, 'altas', coalesce(a.altas, 0)) order by d.dia
             ), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') as d(dia)
      left join (
        select p.creado_en::date as dia, count(*) as altas
        from public.perfiles p
        where p.creado_en >= current_date - 13 and not public.es_cuenta_admin(p.id)
        group by 1
      ) a on a.dia = d.dia::date
    ),

    -- Cuántas cuentas tiene cada plan (los archivados solo si todavía tienen cuentas).
    'por_plan', (
      select coalesce(jsonb_agg(
               jsonb_build_object('codigo', pl.codigo, 'nombre', pl.nombre, 'cuentas', c.n)
               order by pl.orden, pl.nombre
             ), '[]'::jsonb)
      from public.planes pl
      cross join lateral (
        select count(*) as n
        from public.suscripciones s
        where s.plan_id = pl.id and s.hasta is null and not public.es_cuenta_admin(s.usuario_id)
      ) c
      where pl.activo or c.n > 0
    ),

    -- Las 10 que están más cerca de su límite (desde el 80 %): candidatas a cambiar de plan.
    'cerca_limite', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'usuario_id', b.usuario_id, 'nombre', b.nombre, 'email', b.email,
                 'plan', b.plan, 'recurso', b.recurso, 'inventario', b.inventario,
                 'usados', b.usados, 'max', b.max
               ) order by b.usados::numeric / b.max desc
             ), '[]'::jsonb)
      from (
        select * from (
          select p.id as usuario_id, p.nombre, p.email, pl.nombre as plan,
                 'inventarios'::text as recurso, null::text as inventario,
                 (select count(*) from public.inventarios i where i.creado_por = p.id) as usados,
                 pl.max_inventarios as max
          from public.perfiles p
          cross join lateral public.plan_de(p.id) pl
          where pl.max_inventarios is not null and not public.es_cuenta_admin(p.id)

          union all

          select p.id, p.nombre, p.email, pl.nombre, 'productos', i.nombre,
                 (select count(*) from public.productos x where x.inventario_id = i.id),
                 pl.max_productos
          from public.inventarios i
          join public.perfiles p on p.id = i.creado_por
          cross join lateral public.plan_de(p.id) pl
          where pl.max_productos is not null

          union all

          select p.id, p.nombre, p.email, pl.nombre, 'personas', i.nombre,
                 (select count(*) from public.miembros m where m.inventario_id = i.id)
                   + (select count(*) from public.invitaciones v where v.inventario_id = i.id),
                 pl.max_personas
          from public.inventarios i
          join public.perfiles p on p.id = i.creado_por
          cross join lateral public.plan_de(p.id) pl
          where pl.max_personas is not null
        ) u
        where u.usados >= u.max * 0.8
        order by u.usados::numeric / u.max desc
        limit 10
      ) b
    )
  ) into resultado;

  return resultado;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuarios: ahora con el estado de suspensión
-- ---------------------------------------------------------------------------

drop function public.admin_usuarios();
create function public.admin_usuarios()
returns table (
  id uuid,
  nombre text,
  email text,
  creado_en timestamptz,
  ultimo_acceso timestamptz,
  inventarios bigint,
  es_admin boolean,
  plan_id uuid,
  plan_nombre text,
  suspendido boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, p.email, p.creado_en, u.last_sign_in_at,
           (select count(*) from public.miembros m where m.usuario_id = p.id),
           coalesce(r.rol = 'admin', false),
           pl.id, pl.nombre,
           coalesce(u.banned_until > now(), false)
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.roles r on r.id = p.rol_id
    cross join lateral public.plan_de(p.id) pl
    order by p.creado_en desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Detalle de una cuenta
-- ---------------------------------------------------------------------------

create function public.admin_usuario_detalle(p_usuario uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  perfil record;
  plan public.planes;
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;

  select p.id, p.nombre, p.email, p.creado_en, u.last_sign_in_at as ultimo_acceso,
         coalesce(u.banned_until > now(), false) as suspendido,
         coalesce(r.rol = 'admin', false) as es_admin
  into perfil
  from public.perfiles p
  left join auth.users u on u.id = p.id
  left join public.roles r on r.id = p.rol_id
  where p.id = p_usuario;

  if not found then
    raise exception 'Esa cuenta no existe' using errcode = '22023';
  end if;

  plan := public.plan_de(p_usuario);

  return jsonb_build_object(
    'id', perfil.id,
    'nombre', perfil.nombre,
    'email', perfil.email,
    'creado_en', perfil.creado_en,
    'ultimo_acceso', perfil.ultimo_acceso,
    'suspendido', perfil.suspendido,
    'es_admin', perfil.es_admin,
    'plan', jsonb_build_object('id', plan.id, 'codigo', plan.codigo, 'nombre', plan.nombre),
    'historial_planes', (
      select coalesce(jsonb_agg(
               jsonb_build_object('plan', pl.nombre, 'desde', s.desde, 'hasta', s.hasta)
               order by s.desde desc
             ), '[]'::jsonb)
      from public.suscripciones s
      join public.planes pl on pl.id = s.plan_id
      where s.usuario_id = p_usuario
    ),
    -- Los inventarios que creó, con cuánto tienen. El contenido no se expone.
    'inventarios', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', i.id, 'nombre', i.nombre, 'creado_en', i.creado_en,
                 'productos', (select count(*) from public.productos x where x.inventario_id = i.id),
                 'personas',
                   (select count(*) from public.miembros m where m.inventario_id = i.id)
                   + (select count(*) from public.invitaciones v where v.inventario_id = i.id)
               ) order by i.creado_en
             ), '[]'::jsonb)
      from public.inventarios i
      where i.creado_por = p_usuario
    ),
    'inventarios_ajenos', (
      select count(*) from public.miembros m
      join public.inventarios i on i.id = m.inventario_id
      where m.usuario_id = p_usuario and i.creado_por <> p_usuario
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Suspender / reactivar
-- ---------------------------------------------------------------------------

create function public.admin_suspender(p_usuario uuid, p_suspender boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin de la plataforma' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No podés suspender tu propia cuenta' using errcode = '22023';
  end if;
  if public.es_cuenta_admin(p_usuario) then
    raise exception 'No se suspende a un admin de la plataforma' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario) then
    raise exception 'Esa cuenta no existe' using errcode = '22023';
  end if;

  update auth.users
  set banned_until = case when p_suspender then now() + interval '100 years' else null end
  where id = p_usuario;

  -- Cierra sus sesiones: no puede renovar el token (el actual vale hasta que venza).
  if p_suspender then
    delete from auth.sessions where user_id = p_usuario;
  end if;

  insert into public.admin_log (admin_id, accion, entidad, entidad_id, detalle)
  values (
    auth.uid(),
    case when p_suspender then 'suspender_cuenta' else 'reactivar_cuenta' end,
    'usuario', p_usuario::text,
    jsonb_build_object('motivo', nullif(trim(coalesce(p_motivo, '')), ''))
  );
end;
$$;

revoke execute on function public.admin_resumen() from public, anon;
revoke execute on function public.admin_usuarios() from public, anon;
revoke execute on function public.admin_usuario_detalle(uuid) from public, anon;
revoke execute on function public.admin_suspender(uuid, boolean, text) from public, anon;
grant execute on function public.admin_resumen() to authenticated;
grant execute on function public.admin_usuarios() to authenticated;
grant execute on function public.admin_usuario_detalle(uuid) to authenticated;
grant execute on function public.admin_suspender(uuid, boolean, text) to authenticated;

commit;

-- Verificación: en el SQL Editor no hay sesión, así que las tres tienen que
-- rechazar con "Solo el admin de la plataforma".
--   select public.admin_resumen();
--   select * from public.admin_usuarios();
--   select public.admin_usuario_detalle(gen_random_uuid());
