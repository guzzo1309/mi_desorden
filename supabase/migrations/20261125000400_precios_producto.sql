-- Precios de un producto, opcionales: lo que costó (compra) y a cuánto se vende
-- (venta), por unidad. Null = no se cargó. Los cambia quien puede editar
-- productos (las políticas de productos ya lo cubren).

begin;

alter table public.productos
  add column if not exists precio_compra numeric(14, 2),
  add column if not exists precio_venta numeric(14, 2);

alter table public.productos
  add constraint productos_precio_compra_valido
    check (precio_compra is null or precio_compra >= 0),
  add constraint productos_precio_venta_valido
    check (precio_venta is null or precio_venta >= 0);

comment on column public.productos.precio_compra is
  'Precio de compra por unidad, opcional. Null = no se cargó.';
comment on column public.productos.precio_venta is
  'Precio de venta por unidad, opcional. Null = no se cargó.';

commit;
