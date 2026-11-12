-- Hasta 6 fotos por producto: la principal (foto_path) y hasta 5 extras.
--
-- Con 3 desde ángulos distintos ya se reconoce bien; las demás son para productos
-- parecidos entre sí o que se guardan en sitios con otra luz. La app recomienda 3
-- y deja sumar más si el owner quiere (apps/client/lib/fotos.ts: MAX_FOTOS).
--
-- Requiere 20261029000800_fotos_extra.

begin;

alter table public.productos
  drop constraint if exists productos_fotos_extra_check;

alter table public.productos
  add constraint productos_fotos_extra_check check (cardinality(fotos_extra) <= 5);

comment on column public.productos.fotos_extra is
  'Hasta 5 fotos más para reconocer el producto (rutas en el bucket productos). foto_path es la principal.';

commit;
