-- Mensajes de la base en tuteo (español de Venezuela), no en voseo.
--
-- Varias funciones y triggers levantan errores que la app muestra tal cual
-- ("No tenés permiso…", "Pasá a otro plan…"). En vez de copiar cada función de
-- nuevo, este script lee la definición de las que todavía tienen voseo, cambia
-- solo esas frases y la vuelve a crear (CREATE OR REPLACE conserva dueño y permisos).
--
-- Se puede correr más de una vez: lo que ya está en tuteo no se toca.

begin;

do $$
declare
  f record;
  nueva text;
  par text[];
  -- (voseo, tuteo)
  pares text[][] := array[
    ['No tenés permiso', 'No tienes permiso'],
    ['No podés dar', 'No puedes dar'],
    ['No podés suspender', 'No puedes suspender'],
    ['No sos miembro', 'No eres miembro'],
    ['Ya tenés ese plan', 'Ya tienes ese plan'],
    ['Pasá a otro plan', 'Pasa a otro plan'],
    ['Pedile al owner', 'Pídele al owner'],
    ['Cambiá de plan', 'Cambia de plan']
  ];
  cuantas int := 0;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    nueva := f.def;
    foreach par slice 1 in array pares loop
      nueva := replace(nueva, par[1], par[2]);
    end loop;
    if nueva <> f.def then
      execute nueva;
      cuantas := cuantas + 1;
    end if;
  end loop;
  raise notice 'Funciones actualizadas: %', cuantas;
end $$;

commit;

-- Verificación: tiene que dar 0 filas (ninguna función conserva voseo).
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  -- Solo funciones normales: pg_get_functiondef falla con las de agregación (ej. array_agg).
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~ '(No tenés|No podés|No sos|Ya tenés|Pasá a|Pedile al|Cambiá de)';
