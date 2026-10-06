# Inicio rápido

**Documentación:** [Índice](README.md)

## 1. Dependencias

```bash
bun install
```

## 2. Variables de entorno (Doppler)

Las variables viven en Doppler, proyecto `mi_desroden`. Los scripts `dev`, `ios`, `android` y `start` corren con `doppler run --`.

```bash
doppler login
doppler setup          # elegí el config: a qué entorno le pega la app
```

- `dev_personal` / `dev`: la app usa la API de tu máquina (`bun dev` la levanta).
- `stg` / `prd`: la app usa la API de Vercel. La API local también arranca, pero la app no la usa.

`bun dev` corre primero `bun run dev:setup`, que muestra el config, la API y el Supabase que vas a usar, y frena si algo no sirve (URL de API fuera de la lista blanca, URL de Supabase que no es https). El cliente corre con `doppler run --mount .env -- expo start -c`: el `-c` limpia la caché de Metro, si no, al cambiar de entorno quedarían en el bundle las `EXPO_PUBLIC_*` del anterior.

| Variable | Quién la usa | Valor |
|----------|--------------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | client | `https://eotdzgsisxfqyqbxwqna.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_KEY` | client | Supabase → API Keys → **publishable** (nunca la secret) |
| `EXPO_PUBLIC_APP_ENV` | client | `development` (dev, dev_personal), `staging` (stg), `production` (prd). Define qué APIs acepta la app |
| `EXPO_PUBLIC_API_URL` | client | `http://localhost:3000/api/v1` (o la IP de tu máquina en un teléfono físico; en stg/prd, `https://<deploy>.vercel.app/api/v1`) |
| `PORT` | api | `3000` |
| `SUPABASE_URL` | api | Opcional: si no está, usa `EXPO_PUBLIC_SUPABASE_URL`. Con ella verifica los tokens de la app |
| `CORS_ORIGIN` | api | Lista blanca de orígenes del navegador, separados por coma. Vacío en desarrollo = `*`; en producción `*` está prohibido y, vacío, solo entra la propia URL de Vercel |

Sin acceso a Doppler: copiá los `.env.example` a `.env` y usá `bun run dev:local` dentro de cada app.

## 3. Levantar API y cliente

```bash
bun dev
```

API en `http://localhost:3000/api/v1` (Swagger en `/api/v1/docs`), Expo en `http://localhost:8081`.

Probar que responde:

```bash
curl http://localhost:3000/api/v1/health
```

Registrar una detección como lo hace la app (necesita un access token de Supabase, por ejemplo el de `GET /api/v1/auth/me` desde Swagger):

```bash
curl -X POST http://localhost:3000/api/v1/detections \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"etiqueta":"caja","confianza":0.91}'
```

## 4. Probar en el teléfono

Con Expo Go (SDK 57) escaneá el QR de `bun run client`. En un teléfono físico, `EXPO_PUBLIC_API_URL` tiene que apuntar a la IP de tu máquina (`http://192.168.x.x:3000/api/v1`), no a `localhost`.
