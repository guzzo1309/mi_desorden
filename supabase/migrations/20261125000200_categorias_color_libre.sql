-- Color libre para el título de una categoría: además de las claves de la paleta
-- (que se adaptan al modo oscuro), el owner puede elegir cualquier color con el
-- círculo cromático. Se guarda como #RRGGBB.
--
-- Requiere 20261125000100_categorias_personalizables.

begin;

alter table public.categorias drop constraint if exists categorias_color_valido;

alter table public.categorias
  add constraint categorias_color_valido
    check (
      color is null
      or color in ('marca', 'kraft', 'rojo', 'verde', 'azul', 'violeta')
      or color ~ '^#[0-9A-Fa-f]{6}$'
    );

comment on column public.categorias.color is
  'Color del título: clave de la paleta (marca, kraft, rojo, verde, azul, violeta) o un #RRGGBB elegido a mano. Null = el de siempre.';

commit;
