
begin;

alter table public.productos
  add column if not exists marca text not null default ''
    check (char_length(marca) <= 80),
  add column if not exists codigo text not null default ''
    check (char_length(codigo) <= 80),
  add column if not exists especificaciones jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(especificaciones) = 'array'
      and jsonb_array_length(especificaciones) <= 20
    );

commit;