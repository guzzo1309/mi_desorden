-- Carga masiva de productos (factura o Excel).
--
-- cargar_productos() recibe las líneas que la app leyó de la factura y las
-- aplica en una sola transacción:
--   - si el producto ya existe en el inventario (mismo nombre, sin importar
--     mayúsculas ni espacios), le suma la cantidad;
--   - si no existe, lo crea sin categoría.
-- Si una línea falla no queda nada a medias.
--
-- Es security invoker: corre con los permisos de quien llama, así que las
-- políticas de productos siguen mandando (solo dueño y editores escriben).

create function public.cargar_productos(inv uuid, lineas jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  linea record;
  fila public.productos;
  existente uuid;
  resultado jsonb := '[]'::jsonb;
begin
  if public.rol_en(inv) is null or public.rol_en(inv) not in ('dueño', 'editor') then
    raise exception 'No tenés permiso para cargar productos en este inventario'
      using errcode = '42501';
  end if;
  if jsonb_typeof(lineas) is distinct from 'array' or jsonb_array_length(lineas) = 0 then
    raise exception 'La factura no tiene productos' using errcode = '22023';
  end if;
  if jsonb_array_length(lineas) > 200 then
    raise exception 'Máximo 200 productos por factura' using errcode = '22023';
  end if;

  -- Las líneas repetidas en la misma factura se suman antes de tocar la tabla.
  for linea in
    select min(trim(l ->> 'nombre')) as nombre, sum((l ->> 'cantidad')::integer) as cantidad
    from jsonb_array_elements(lineas) as l
    group by lower(trim(l ->> 'nombre'))
  loop
    if linea.nombre is null or char_length(linea.nombre) not between 1 and 120 then
      raise exception 'Hay un producto sin nombre o con un nombre muy largo' using errcode = '22023';
    end if;
    if linea.cantidad is null or linea.cantidad <= 0 then
      raise exception 'La cantidad de “%” tiene que ser mayor que cero', linea.nombre
        using errcode = '22023';
    end if;

    select id into existente from public.productos
    where inventario_id = inv and lower(trim(nombre)) = lower(linea.nombre)
    order by creado_en
    limit 1;

    if existente is not null then
      update public.productos
      set cantidad = cantidad + linea.cantidad, fuente = 'manual'
      where id = existente
      returning * into fila;
      resultado := resultado || jsonb_build_object('producto', to_jsonb(fila), 'nuevo', false);
    else
      insert into public.productos (inventario_id, nombre, cantidad, fuente)
      values (inv, linea.nombre, linea.cantidad, 'manual')
      returning * into fila;
      resultado := resultado || jsonb_build_object('producto', to_jsonb(fila), 'nuevo', true);
    end if;
  end loop;

  return resultado;
end;
$$;

revoke execute on function public.cargar_productos(uuid, jsonb) from public, anon;
grant execute on function public.cargar_productos(uuid, jsonb) to authenticated;
