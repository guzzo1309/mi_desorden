-- El administrador (dueño) tiene que subir la foto de cada producto nuevo que
-- entró con una factura: un producto por_revisar deja de estar pendiente
-- recién cuando tiene categoría Y foto. (Antes alcanzaba con la categoría.)

create or replace function public.revisar_producto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.por_revisar and new.categoria_id is not null and new.foto_path is not null then
    new.por_revisar := false;
  end if;
  return new;
end;
$$;
