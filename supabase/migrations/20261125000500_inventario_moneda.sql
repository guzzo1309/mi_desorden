-- Moneda del inventario: en qué se cargan los precios de sus productos (dólar o
-- euro). La cambia quien edita el inventario (el owner, por las políticas de
-- inventarios). Requiere 20261125000400_precios_producto.

begin;

alter table public.inventarios
  add column if not exists moneda text not null default 'USD';

alter table public.inventarios
  add constraint inventarios_moneda_valida check (moneda in ('USD', 'EUR'));

comment on column public.inventarios.moneda is
  'Moneda de los precios de sus productos: USD o EUR.';

commit;
