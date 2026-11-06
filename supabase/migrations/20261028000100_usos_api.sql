create table if not exists public.usos_api (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.perfiles (id) on delete set null,
  inventario_id uuid references public.inventarios (id) on delete set null,
  ruta text not null,
  metodo text not null,
  estado integer not null,
  duracion_ms integer not null,
  ip text,
  creado_en timestamptz not null default now()
);

create index if not exists usos_api_creado_idx on public.usos_api (creado_en desc);
create index if not exists usos_api_usuario_idx on public.usos_api (usuario_id, creado_en desc);

alter table public.usos_api enable row level security;

revoke all on public.usos_api from anon;
grant select, insert on public.usos_api to authenticated;

drop policy if exists "admin lee los usos" on public.usos_api;
create policy "admin lee los usos" on public.usos_api
  for select to authenticated using (public.es_admin());

drop policy if exists "registro mi propio uso" on public.usos_api;
create policy "registro mi propio uso" on public.usos_api
  for insert to authenticated with check (usuario_id = auth.uid());