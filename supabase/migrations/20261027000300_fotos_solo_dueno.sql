-- Solo el administrador del inventario (el dueño) saca, cambia o borra las
-- fotos de los productos. Editores y lectores las siguen viendo.
--
-- Se cierra en los dos lados: el bucket "productos" de Storage y la columna
-- productos.foto_path (un editor podía apuntarla a otro archivo o vaciarla).

-- ---------------------------------------------------------------------------
-- Storage: subir, reemplazar y borrar → solo el dueño de la carpeta
-- ---------------------------------------------------------------------------

create function public.es_dueno_carpeta(ruta text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros
    where inventario_id::text = split_part(ruta, '/', 1)
      and usuario_id = auth.uid()
      and rol = 'dueño'
  )
$$;

revoke execute on function public.es_dueno_carpeta(text) from public, anon;
grant execute on function public.es_dueno_carpeta(text) to authenticated;

drop policy "productos: subir fotos" on storage.objects;
drop policy "productos: reemplazar fotos" on storage.objects;
drop policy "productos: borrar fotos" on storage.objects;

create policy "productos: el dueño sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.es_dueno_carpeta(name));

create policy "productos: el dueño reemplaza fotos" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.es_dueno_carpeta(name))
  with check (bucket_id = 'productos' and public.es_dueno_carpeta(name));

-- Si un editor borra un producto con foto, el archivo queda en el bucket
-- (no rompe nada; el dueño o un mantenimiento lo puede limpiar).
create policy "productos: el dueño borra fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.es_dueno_carpeta(name));

-- ---------------------------------------------------------------------------
-- productos.foto_path: solo el dueño la cambia
-- ---------------------------------------------------------------------------

create function public.proteger_foto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, service role) no se restringe.
  if auth.uid() is not null
    and new.foto_path is distinct from old.foto_path
    and public.rol_en(new.inventario_id) is distinct from 'dueño'
  then
    raise exception 'Solo el dueño del inventario puede sacarle fotos a los productos'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger al_cambiar_foto
  before update of foto_path on public.productos
  for each row execute function public.proteger_foto();
