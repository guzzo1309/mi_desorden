-- Descripción de productos generada con IA (HU 43).
--
--   productos.descripcion   la ficha del producto. La ven todos los miembros y
--                           la editan quienes tienen editar_productos.
--   roles.usar_ia           permiso nuevo: pedirle a la IA que escriba o mejore
--                           la descripción. Solo el owner (administrador del inventario).
--   planes.max_tokens_ia    tokens de IA por mes de la cuenta owner (null = ilimitado).
--   uso_ia                  lo gastado por cuenta y por mes (un UPDATE atómico por uso).
--   consumo_tokens          libro append-only de cada llamada, con clave de idempotencia.
--
-- El consumo lo registra solo la API con la service key (ia_cuota, ia_registrar):
-- la app solo puede leer su propio uso (mi_uso_ia).
--
-- Requiere 20261028000300_roles_plataforma (roles) y 20261029000100_planes (plan_de).

begin;

-- ---------------------------------------------------------------------------
-- 1. La descripción del producto
-- ---------------------------------------------------------------------------

alter table public.productos
  add column if not exists descripcion text not null default ''
    check (char_length(descripcion) <= 1000);

comment on column public.productos.descripcion is
  'Ficha del producto. La puede escribir el owner con ayuda de la IA (POST /descripciones).';

-- ---------------------------------------------------------------------------
-- 2. Permiso usar_ia (una columna por permiso, como el resto de la tabla roles)
-- ---------------------------------------------------------------------------

alter table public.roles add column if not exists usar_ia boolean not null default false;

comment on column public.roles.usar_ia is
  'Puede pedirle a la IA que escriba o mejore la descripción de un producto.';

update public.roles set usar_ia = (rol = 'owner') where ambito = 'inventario';

create or replace function public.puede(inv uuid, permiso text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case permiso
      when 'ver' then r.ver
      when 'ajustar_stock' then r.ajustar_stock
      when 'editar_productos' then r.editar_productos
      when 'gestionar_fotos' then r.gestionar_fotos
      when 'gestionar_accesos' then r.gestionar_accesos
      when 'eliminar_inventario' then r.eliminar_inventario
      when 'usar_ia' then r.usar_ia
      else false
    end
    from public.miembros m
    join public.roles r on r.id = m.rol_id
    where m.inventario_id = inv and m.usuario_id = auth.uid()
  ), false)
$$;

-- ---------------------------------------------------------------------------
-- 3. Cuota mensual de tokens por plan
-- ---------------------------------------------------------------------------

alter table public.planes
  add column if not exists max_tokens_ia integer check (max_tokens_ia >= 0);

comment on column public.planes.max_tokens_ia is
  'Tokens de IA por mes (entrada + salida). null = ilimitado, 0 = sin IA.';

update public.planes set max_tokens_ia = 20000 where codigo = 'free' and max_tokens_ia is null;
update public.planes set max_tokens_ia = 200000 where codigo = 'pro' and max_tokens_ia is null;
-- business queda en null: ilimitado.

create table if not exists public.uso_ia (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  -- Primer día del mes (UTC).
  mes date not null,
  tokens integer not null default 0 check (tokens >= 0),
  usos integer not null default 0 check (usos >= 0),
  primary key (usuario_id, mes)
);

comment on table public.uso_ia is
  'Tokens de IA gastados por cuenta y por mes. Lo escribe solo ia_registrar.';

create table if not exists public.consumo_tokens (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  -- Sin FK: el historial sobrevive al inventario y al producto.
  inventario_id uuid,
  producto_id uuid,
  modo text not null check (modo in ('generar', 'mejorar')),
  modelo text not null default '',
  tokens_entrada integer not null default 0 check (tokens_entrada >= 0),
  tokens_salida integer not null default 0 check (tokens_salida >= 0),
  -- La misma llamada registrada dos veces (reintento) cuenta una sola.
  clave text not null unique check (char_length(clave) between 8 and 100),
  creado_en timestamptz not null default now()
);

create index if not exists consumo_tokens_usuario_idx
  on public.consumo_tokens (usuario_id, creado_en desc);

comment on table public.consumo_tokens is
  'Libro append-only de cada uso de la IA. Solo lo escribe ia_registrar (service key).';

alter table public.uso_ia enable row level security;
alter table public.consumo_tokens enable row level security;

drop policy if exists "ver mi uso de ia" on public.uso_ia;
create policy "ver mi uso de ia" on public.uso_ia for select to authenticated
  using (usuario_id = auth.uid());
-- consumo_tokens sin políticas: nadie lo lee ni lo escribe directo.

-- ---------------------------------------------------------------------------
-- 4. Funciones
-- ---------------------------------------------------------------------------

-- Cuánto le queda a una cuenta este mes. restantes null = ilimitado.
create or replace function public.ia_cuota(p_usuario uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  plan public.planes;
  este_mes date := date_trunc('month', now() at time zone 'utc')::date;
  usado record;
begin
  plan := public.plan_de(p_usuario);
  select coalesce(sum(u.tokens), 0)::integer as tokens, coalesce(sum(u.usos), 0)::integer as usos
    into usado
    from public.uso_ia u where u.usuario_id = p_usuario and u.mes = este_mes;
  return jsonb_build_object(
    'limite', plan.max_tokens_ia,
    'usados', usado.tokens,
    'usos', usado.usos,
    'restantes', case when plan.max_tokens_ia is null then null
                      else greatest(plan.max_tokens_ia - usado.tokens, 0) end,
    'mes', este_mes
  );
end;
$$;

-- Anota una llamada y suma al mes en un solo UPDATE. Idempotente por clave.
create or replace function public.ia_registrar(
  p_usuario uuid,
  p_inventario uuid,
  p_producto uuid,
  p_modo text,
  p_modelo text,
  p_entrada integer,
  p_salida integer,
  p_clave text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo bigint;
begin
  insert into public.consumo_tokens
    (usuario_id, inventario_id, producto_id, modo, modelo, tokens_entrada, tokens_salida, clave)
  values
    (p_usuario, p_inventario, p_producto, p_modo, coalesce(p_modelo, ''),
     greatest(coalesce(p_entrada, 0), 0), greatest(coalesce(p_salida, 0), 0), p_clave)
  on conflict (clave) do nothing
  returning id into nuevo;

  if nuevo is not null then
    insert into public.uso_ia as u (usuario_id, mes, tokens, usos)
    values (
      p_usuario,
      date_trunc('month', now() at time zone 'utc')::date,
      greatest(coalesce(p_entrada, 0), 0) + greatest(coalesce(p_salida, 0), 0),
      1
    )
    on conflict (usuario_id, mes) do update
      set tokens = u.tokens + excluded.tokens, usos = u.usos + 1;
  end if;

  return public.ia_cuota(p_usuario);
end;
$$;

-- Mi uso de este mes, para el aviso de la app.
create or replace function public.mi_uso_ia()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  return public.ia_cuota(auth.uid());
end;
$$;

revoke execute on function public.ia_cuota(uuid) from public, anon, authenticated;
revoke execute on function public.ia_registrar(uuid, uuid, uuid, text, text, integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.mi_uso_ia() from public, anon;

grant execute on function public.ia_cuota(uuid) to service_role;
grant execute on function public.ia_registrar(uuid, uuid, uuid, text, text, integer, integer, text)
  to service_role;
grant execute on function public.mi_uso_ia() to authenticated;

commit;

-- Verificación
select rol, ambito, usar_ia from public.roles order by ambito, rol;
select codigo, max_tokens_ia from public.planes order by orden;
