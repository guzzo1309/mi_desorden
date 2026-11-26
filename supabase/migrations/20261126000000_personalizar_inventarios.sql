-- Personalización de catálogos (inventarios) por el administrador/owner:
-- imagen representativa, tipo de fuente y color del título (máximo uno de cada uno).

alter table public.inventarios
  add column if not exists foto_path text
    check (foto_path is null or foto_path ~ '^[0-9a-f-]{36}/portada\.jpg$'),
  add column if not exists fuente_titulo text
    check (fuente_titulo is null or fuente_titulo in ('sistema', 'redondeada', 'serif', 'monoespaciada')),
  add column if not exists color_titulo text
    check (color_titulo is null or color_titulo ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.inventarios.foto_path is
  'Ruta en el bucket "productos": <inventario_id>/portada.jpg. Null si no tiene imagen representativa.';
comment on column public.inventarios.fuente_titulo is
  'Fuente elegida para el título del catálogo (máximo una). Null usa la predeterminada.';
comment on column public.inventarios.color_titulo is
  'Color hex (#RRGGBB) elegido para el título del catálogo (máximo uno). Null usa el del tema.';
