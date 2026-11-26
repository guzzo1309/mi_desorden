-- Resumen del admin: las cuentas cerca del límite de categorías también aparecen
-- en "cerca_limite" (recurso 'categorias', con el inventario donde pasa).
--
-- Copia admin_resumen de 20261029000300_admin_gestion con una rama más.
-- Requiere 20261125000600_limite_categorias.

begin;

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

          select p.id, p.nombre, p.email, pl.nombre, 'categorias', i.nombre,
                 (select count(*) from public.categorias x where x.inventario_id = i.id),
                 pl.max_categorias
          from public.inventarios i
          join public.perfiles p on p.id = i.creado_por
          cross join lateral public.plan_de(p.id) pl
          where pl.max_categorias is not null

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

commit;
