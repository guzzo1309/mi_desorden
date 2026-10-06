# Arquitectura

**Documentación:** [Índice](README.md)

```
┌──────────────────────────┐   auth · inventarios · productos   ┌──────────────────┐
│  apps/client (Expo)      │ ─────────────────────────────────> │  Supabase        │
│  cámara del teléfono     │ <───────── Realtime ────────────── │  Postgres + RLS  │
└────────────┬─────────────┘                                    └──────────────────┘
             │ Bearer <access token de Supabase>
             ▼
┌──────────────────────────┐
│  apps/api (NestJS)       │  detecciones · /auth/me · health
│  Vercel, /api/v1         │
└──────────────────────────┘
```

## Workspaces

| Workspace | Qué es |
|-----------|--------|
| `apps/api` | NestJS sobre Bun, modular (ver abajo). Guarda las detecciones de la cámara del teléfono. Swagger en `/api/v1/docs`. |
| `apps/client` | Expo + Expo Router. Tabs nativas (Liquid Glass en iOS 26+): inventario, cámara, accesos, perfil. Auth, inventarios y productos contra Supabase con Realtime. |
| `packages/core` | Tipos (`Detection`, `Producto`, `Inventario`…) y el cliente HTTP que usa el cliente Expo. |

## Estructura del cliente

```
apps/client
├── api/            ÚNICA conexión con el backend
│   ├── config.ts       URLs y claves públicas (Doppler)
│   ├── supabase.ts     cliente de Supabase (solo se usa dentro de api/)
│   ├── http.ts         cliente de la API de Nest, con el access token de Supabase
│   ├── auth.ts         registro, login, sesión
│   ├── inventarios.ts · productos.ts · miembros.ts   datos (Supabase + RLS)
│   ├── detecciones.ts  lo que reconoce la cámara (API de Nest)
│   ├── realtime.ts     cambios en vivo + presencia
│   ├── errores.ts      errores del backend → mensajes para mostrar
│   └── index.ts        lo único que importa el resto: `import { productos } from "@/api"`
├── lib/store.tsx   estado y caché (React Query); usa api/, no sabe de Supabase
├── app/            pantallas (Expo Router)
└── components/     UI
```

Regla: fuera de `api/` no se importa `@supabase/supabase-js` ni se hace `fetch`.

## Estructura de la API

```
apps/api/src
├── server.ts            arranque local (bun dev)
├── serverless.ts        handler para Vercel: arranca Nest una vez y lo reutiliza
├── app.setup.ts         arma la app con utils/ (lo comparten server, serverless y tests)
├── core.module.ts       raíz: ConfigModule + módulos
├── utils/               funciones planas que usan varios módulos
│   ├── cors.ts              lista blanca de orígenes (403 si no está)
│   ├── seguridad.ts         helmet + trust proxy
│   ├── pipes.ts · filters.ts · swagger.ts   lo global de Nest
│   ├── paginado.ts          paginar() → { items, total }
│   ├── fecha.ts             ahoraIso()
│   └── request.ts           ipDe(req)
├── shared/              lo que vive dentro de Nest: config/env, auth (guard de sesión), guards, filters
└── modules/
    ├── health/          GET /health
    └── detections/      controller · service · repository · dto
```

Cada módulo separa HTTP (controller), lógica (service) y datos (repository). Para pasar a Supabase solo cambian los repositories.

## Deploy (Vercel, igual que canchapp)

Proyecto de Vercel con **Root Directory = `apps/api`**. `vercel.json` usa `framework: null` y funciones propias en `apps/api/api/`:

| Función | Qué hace |
|---------|----------|
| `api/index.ts` | `GET /` y `/api`: responde sin cargar Nest |
| `api/v1/health/liveness.ts` | Probe liviano sin Nest, para un monitor de uptime externo |
| `api/v1/health/index.ts` | `GET /api/v1/health` pasando por Nest |
| `api/[[...path]].ts` | Todo `/api/v1/*` por rewrite → `dist/serverless.js` |

> **Sin previews**: `ignoreCommand` en `vercel.json` cancela todo deploy con `VERCEL_ENV=preview`. Hay un solo proyecto de Supabase (producción), así que un preview de una rama `feature/*` usaría los datos reales. Solo despliega `develop` (Production en Vercel).

> Sin `crons` en `vercel.json`: el plan Hobby solo permite crons diarios y uno más frecuente hace fallar el deploy entero. Para mantener la función tibia, usar un monitor externo (UptimeRobot, Better Stack) contra `/api/v1/health/liveness`.

`bun run build` empaqueta `src/serverless.ts` en `dist/serverless.js` (CommonJS para Node). Variables en Vercel: `SUPABASE_URL` (o `EXPO_PUBLIC_SUPABASE_URL`, la URL **https**) y, si hace falta, `CORS_ORIGIN`. `ENABLE_SWAGGER=true` para ver `/api/v1/docs` fuera de desarrollo.

## Endpoints

| Método | Ruta | Para qué |
|--------|------|----------|
| GET | `/api/v1/health` | Healthcheck |
| GET | `/api/v1/auth/me` | La sesión según el token (requiere Bearer) |
| GET | `/api/v1/detections` | Mis detecciones (filtra por `inventario_id`) |
| POST | `/api/v1/detections` | La app registra lo que reconoció la cámara |

## Persistencia

- **App** → Supabase directo (auth, inventarios, productos) con RLS y Realtime. Esquema en `supabase/migrations/`.
- **API** → todavía en memoria (`DetectionsRepository`): se pierde al reiniciar. El paso siguiente es que esos repositories escriban en Supabase (ver [DECISIONES.md](DECISIONES.md)).

## Autenticación

La app manda `Authorization: Bearer <access_token de Supabase>`; lo valida `SesionGuard`, global.

`SesionGuard` (en `apps/api/src/shared/auth/`):

- Verifica el JWT **localmente** con las claves públicas del proyecto (`/auth/v1/.well-known/jwks.json`, ES256, cacheadas 10 min). Si el proyecto usara JWT legacy, se configura `SUPABASE_JWT_SECRET` y verifica HS256.
- Exige emisor del proyecto, `aud = authenticated` y `role = authenticated` (la anon key no pasa).
- Responde siempre lo mismo ante un token malo: no se filtra qué falló.
- Cuenta tokens inválidos por IP: con `AUTH_MAX_FALLOS` (10) dentro de `AUTH_BLOQUEO_MIN` (15) la IP recibe `429` con `Retry-After`. En memoria: con varias instancias, pasar a Redis.
- Si no se pueden bajar las claves, devuelve `503` y no cuenta como intento fallido.

Además, global: `helmet` (headers de seguridad) y `@nestjs/throttler` (120 requests/min por IP).

### Listas blancas

- **App → API** (`apps/client/api/permitidas.ts`): según `EXPO_PUBLIC_APP_ENV`, la app solo acepta ciertas URLs de API y si no, no arranca.
  - `staging`: solo `https://mi-desorden.vercel.app/api/v1` (o el alias `mi-desorden-guzzo1309s-projects.vercel.app`). Ni previews, ni http, ni otros dominios.
  - `development`: `http://` a localhost o IP de la red local, en `/api/v1`.
  - `production`: ninguna todavía.
- **API → navegadores** (CORS, `apps/api/src/utils/cors.ts`): un `Origin` fuera de `CORS_ORIGIN` recibe **403**. Requests sin `Origin` (app móvil, curl) no se ven afectadas.

Rutas sin sesión, marcadas con `@Publico()`: solo `GET /api/v1/health`. `GET /api/v1/auth/me` devuelve la sesión del token.

> En Vercel (`VERCEL=1`) se activa `trust proxy`, así `req.ip` es la del cliente y no la del proxy.
