-- Ajustes antes de arrancar de cero.
--
-- 1. El email del perfil no se cambia desde la app. Antes "editar mi perfil"
--    dejaba cambiarlo, e invitar() busca al invitado por perfiles.email: alguien
--    podía ponerse el correo de otra persona (todavía sin cuenta) y quedarse con
--    sus invitaciones. El email sale de Auth al registrarse; el nombre sí se edita.
-- 2. Fuera columnas que la app ya no usa: productos.led (y el tipo led_color,
--    se sacaron los LEDs) y productos.categoria (texto de antes de categorias).

begin;

-- ---------------------------------------------------------------------------
-- 1. Email de solo lectura
-- ---------------------------------------------------------------------------

create function public.proteger_email_perfil()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, service role, triggers de Auth) no se restringe.
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'El correo no se cambia desde la app' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger al_cambiar_email_perfil
  before update of email on public.perfiles
  for each row execute function public.proteger_email_perfil();

-- ---------------------------------------------------------------------------
-- 2. Columnas viejas de productos
-- ---------------------------------------------------------------------------

alter table public.productos drop column if exists led;
alter table public.productos drop column if exists categoria;
drop type if exists public.led_color;

commit;
