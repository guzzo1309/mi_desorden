-- Ícono de categoría: además de una foto, el owner puede elegir uno de los íconos
-- de la app (caja, herramientas, bebidas…). Se guarda la clave del ícono; la app
-- sabe cómo dibujarlo. Si la categoría tiene foto, se ve la foto.
--
-- Requiere 20261125000100_categorias_personalizables.

begin;

alter table public.categorias add column if not exists icono text;

alter table public.categorias
  add constraint categorias_icono_valido check (icono is null or icono ~ '^[a-z_]{2,30}$');

comment on column public.categorias.icono is
  'Clave de un ícono de la app (p. ej. herramientas). Null = carpeta. Si hay imagen_path, se ve la imagen.';

-- El ícono, como la imagen, la letra y el color, lo cambia solo el owner.
create or replace function public.proteger_estilo_categoria()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, service role) no se restringe.
  if auth.uid() is null or public.es_owner(new.inventario_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.imagen_path is not null or new.fuente is not null or new.color is not null
      or new.icono is not null
    then
      raise exception 'Solo el owner del inventario puede personalizar las categorías'
        using errcode = '42501';
    end if;
  elsif new.imagen_path is distinct from old.imagen_path
    or new.fuente is distinct from old.fuente
    or new.color is distinct from old.color
    or new.icono is distinct from old.icono
  then
    raise exception 'Solo el owner del inventario puede personalizar las categorías'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

commit;
