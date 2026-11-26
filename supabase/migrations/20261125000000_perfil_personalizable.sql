-- Perfil personalizable: cada cuenta puede cambiar su nombre, agregar su teléfono y
-- subir una foto de perfil.
--
-- - perfiles.telefono: opcional, como lo escribe la persona (con +, espacios o guiones).
-- - perfiles.avatar_path: ruta en el bucket "avatares" (<usuario_id>/<archivo>.jpg).
-- - El nombre ya se podía editar (policy "editar mi perfil"); se le agrega el mismo
--   largo que pide la app.
-- - Bucket "avatares", privado: cada uno sube, cambia y borra solo lo de su carpeta;
--   ve las fotos de quien puede ver en perfiles (él mismo y la gente con la que
--   comparte un inventario: la policy de perfiles se aplica dentro de la subconsulta).

begin;

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column if not exists telefono text,
  add column if not exists avatar_path text;

alter table public.perfiles
  add constraint perfiles_telefono_valido
    check (telefono is null or telefono ~ '^\+?[0-9 ()-]{7,20}$'),
  add constraint perfiles_nombre_largo
    check (char_length(btrim(nombre)) between 2 and 60) not valid,
  add constraint perfiles_avatar_propio
    check (avatar_path is null or avatar_path like id::text || '/%');

comment on column public.perfiles.telefono is
  'Teléfono opcional, como lo escribe la persona. Null si no lo cargó.';
comment on column public.perfiles.avatar_path is
  'Ruta en el bucket "avatares": <usuario_id>/<archivo>.jpg. Null si no tiene foto.';

-- ---------------------------------------------------------------------------
-- 2. Bucket privado para las fotos de perfil
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 2 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatares: ver los de perfiles visibles" on storage.objects for select to authenticated
  using (
    bucket_id = 'avatares'
    and exists (
      select 1 from public.perfiles p
      where p.id::text = (storage.foldername(name))[1]
    )
  );

create policy "avatares: subir el mío" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatares: reemplazar el mío" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatares: borrar el mío" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
