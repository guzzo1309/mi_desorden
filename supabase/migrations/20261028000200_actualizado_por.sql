alter table public.productos add column if not exists actualizado_por uuid;

alter table public.productos drop constraint if exists productos_actualizado_por_fk;
alter table public.productos add constraint productos_actualizado_por_fk
  foreign key (actualizado_por) references public.perfiles (id) on delete set null;

drop trigger if exists al_actualizar_producto on public.productos;
drop trigger if exists al_tocar_producto on public.productos;
drop function if exists public.tocar_producto() cascade;

create function public.tocar_producto()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  new.actualizado_en := now();
  -- coalesce: un update sin JWT (script, servicio) no borra el autor anterior.
  new.actualizado_por := coalesce(auth.uid(), new.actualizado_por);
  return new;
end;
$fn$;

create trigger al_tocar_producto
  before insert or update on public.productos
  for each row execute function public.tocar_producto();