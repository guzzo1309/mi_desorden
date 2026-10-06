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
| `miembros` | Quién tiene acceso a qué inventario y con qué rol (`dueño`, `editor`, `lector`) |
| `productos` | Stock, estante y color de LED de cada producto |

RLS: cada usuario ve solo los inventarios donde es miembro; editan dueño y editores; solo el dueño invita (`invitar_miembro`) y cambia roles. `productos` y `miembros` están en la publicación de Realtime.

## Auth

Para la demo conviene apagar **Authentication → Sign In / Providers → Email → Confirm email**; si queda prendido, la app pide revisar el correo después de registrarse.
