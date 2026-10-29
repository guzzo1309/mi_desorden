-- Varias fotos por producto: la principal (foto_path) y hasta 2 más (fotos_extra).
--
-- El reconocimiento compara la foto de la cámara contra la huella de cada foto
-- del producto y se queda con la más parecida: con 2 o 3 fotos desde distintos
-- ángulos acierta bastante más que con una sola.
--
-- foto_path sigue siendo la principal (la miniatura de las listas). Las extras
-- van en fotos_extra, como rutas del bucket `productos` (primera carpeta = id del
-- inventario, así las políticas de Storage de siempre alcanzan).
--
-- Requiere 20261028000100_roles_permisos (proteger_foto).

begin;

alter table public.productos
  add column fotos_extra text[] not null default '{}'
    check (cardinality(fotos_extra) <= 2);

comment on column public.productos.fotos_extra is
  'Hasta 2 fotos más para reconocer el producto (rutas en el bucket productos). foto_path es la principal.';

-- Las fotos extra, igual que la principal, solo las cambia quien tiene gestionar_fotos.
create or replace function public.proteger_foto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
    and (new.foto_path is distinct from old.foto_path
         or new.fotos_extra is distinct from old.fotos_extra)
    and not public.puede(new.inventario_id, 'gestionar_fotos')
  then
    raise exception 'Tu rol no puede cambiar las fotos de los productos' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists al_cambiar_foto on public.productos;
create trigger al_cambiar_foto
  before update of foto_path, fotos_extra on public.productos
  for each row execute function public.proteger_foto();

commit;

-- Verificación: la columna existe y todos los productos arrancan con 0 extras.
select count(*) as productos, count(*) filter (where cardinality(fotos_extra) > 0) as con_extras
from public.productos;
