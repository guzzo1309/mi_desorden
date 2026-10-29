# Supabase

Proyecto: `mi_desorden` (https://eotdzgsisxfqyqbxwqna.supabase.co).

## Aplicar las migraciones

Sin CLI: abrí **SQL Editor** en el dashboard, pegá cada archivo de `migrations/` en orden y ejecutalo.

Con CLI:

```bash
brew install supabase/tap/supabase
supabase link --project-ref eotdzgsisxfqyqbxwqna
supabase db push
```

## Qué crea

| Tabla | Para qué |
|-------|----------|
| `perfiles` | Nombre y correo de cada cuenta. Se crea sola al registrarse |
| `inventarios` | Cada inventario. Quien lo crea queda como dueño |
| `roles` | Roles y sus permisos (una columna por permiso). De inventario: `owner`, `editor`, `lector`; de plataforma: `admin` (KPIs, tiers; va en `perfiles.rol_id` y se asigna solo desde el SQL Editor). Solo lectura |
| `miembros` | Quién tiene acceso a qué inventario y con qué rol (apunta a `roles`) |
| `productos` | Stock, estante y color de LED de cada producto |

Carga masiva: `cargar_productos(inv, lineas)` recibe las líneas de una factura o un Excel (`[{ nombre, cantidad }]`) y las aplica en una sola transacción: suma la cantidad a los productos que ya existen (mismo nombre) y crea los que faltan. Solo dueño y editores.

Fotos de productos (bucket `productos`): las ven todos los miembros, pero solo el dueño las sube, cambia o borra (Storage y `productos.foto_path`).

Productos nuevos de una factura quedan con `por_revisar = true` hasta que el dueño les pone categoría y foto.

RLS: cada usuario ve solo los inventarios donde es miembro. Las políticas preguntan por permisos con `puede(inventario, permiso)`: el owner hace todo; el editor ajusta stock, edita productos, categorías y facturas; el lector solo mira. Solo el owner invita (`invitar`), cambia roles y saca fotos. `productos` y `miembros` están en la publicación de Realtime.

## Auth

La app confirma el correo de dos formas (`apps/client/app/(auth)/confirmar.tsx` y `callback.tsx`):

1. **Enlace** → vuelve a la app en `midesorden://callback?code=…` (flujo PKCE) y se canjea por la sesión.
2. **Código del correo** → se escribe en la app; sirve si el correo se abre en otro dispositivo.

Configuración en el dashboard:

- **Authentication → URL Configuration → Redirect URLs**: agregar `midesorden://**` (development build y app instalada) y `exp://**` (Expo Go). Sin esto, Supabase manda el enlace a la Site URL y no vuelve a la app.
- **Authentication → Emails → Confirm signup**: asunto `Tu código para mi_desorden` y como cuerpo el HTML de [`templates/confirmar-cuenta.html`](templates/confirmar-cuenta.html). Trae el código del correo (este proyecto usa 8 dígitos) (`{{ .Token }}`) y el botón con el enlace (`{{ .ConfirmationURL }}`), y se adapta a modo oscuro.
- **Authentication → Emails → Reset password**: asunto `Tu código para cambiar la contraseña` y como cuerpo [`templates/recuperar-clave.html`](templates/recuperar-clave.html). La app (`app/(auth)/recuperar.tsx`) usa el código con `verifyOtp` tipo `recovery` y después `updateUser`; el enlace vuelve por `midesorden://callback` con `type=recovery` y pide solo la clave nueva.
- **Confirm email** puede quedar prendido: la app maneja el "revisá tu correo", el reenvío (1 por minuto) y el login de una cuenta sin confirmar.
