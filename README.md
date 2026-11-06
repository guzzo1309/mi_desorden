# mi_desorden

Inventario compartido que se cuenta con la **cámara del teléfono**: apuntás a la estantería, la app reconoce los productos y el inventario se actualiza en vivo para todo tu equipo.

> Estado: **MVP**. Cuentas, inventarios compartidos, roles, fotos y tiempo real andan. El reconocimiento corre en el teléfono con Apple Vision — solo iOS por ahora, Android pendiente. Las detecciones de la API todavía viven en memoria. Ver [docs/DECISIONES.md](docs/DECISIONES.md).

## Arquitectura

```text
mi_desorden/
├── apps/
│   ├── client/                 Expo (React Native) — la app
│   │   ├── app/                rutas y pantallas (Expo Router)
│   │   ├── api/                única capa que habla con el backend
│   │   ├── components/         componentes de interfaz reutilizables
│   │   ├── lib/                estado, utilidades y lógica del cliente
│   │   └── modules/reconocer/  módulo nativo iOS (Apple Vision)
│   └── api/                    NestJS sobre Bun — serverless en Vercel
│       ├── src/modules/        auth, detections, invitaciones, health
│       ├── src/shared/         config, guard de sesión, filtros
│       ├── src/utils/          cors, paginado, swagger
│       └── test/               pruebas e2e
├── packages/core/              tipos y cliente HTTP compartidos
├── supabase/
│   ├── migrations/             esquema SQL (inventarios, fotos, invitaciones, categorías)
│   └── templates/              plantillas HTML de los correos
└── docs/                       arquitectura, decisiones, roadmap
```

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo | Bun workspaces + Turborepo (TUI) |
| App | Expo (React Native) + Expo Router + TanStack Query, cámara con `expo-camera` |
| Reconocimiento | Módulo nativo propio en iOS (`apps/client/modules/reconocer`) con Apple Vision, sin red |
| Datos y auth | Supabase (Postgres con RLS, Auth, Realtime) |
| API | NestJS sobre Bun, deploy serverless en Vercel |
| Compartido | `packages/core` — tipos y cliente HTTP |
| Env vars | Doppler (proyecto `mi_desroden`, ver [QUICKSTART](docs/QUICKSTART.md)) |

## Requisitos

- [Bun](https://bun.sh)
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) (las variables de entorno viven ahí)
- Expo Go SDK 57 en el teléfono, o Xcode / Android Studio para un build de desarrollo

## Setup

```bash
bun install
doppler login
doppler setup   # proyecto mi_desroden → elegí el entorno al que le vas a pegar
```

| Config | La app usa |
|--------|------------|
| `dev_personal` / `dev` | La API de tu máquina (`localhost:3000`), que levanta `bun dev` |
| `stg` / `prd` | La API desplegada en Vercel (`mi-desorden.vercel.app`) |

Para cambiar de entorno, `doppler setup` de nuevo. `bun dev` te muestra antes de arrancar a qué API y a qué Supabase le estás pegando, y frena si la config no sirve.

Después, aplicá las migraciones de `supabase/migrations/` en el SQL Editor, **en orden de fecha**. Sin ellas la app no carga los inventarios. Los `.env.example` de `apps/api` y `apps/client` sirven de referencia, pero la fuente de verdad es Doppler.

## Levantar el proyecto

```bash
bun dev              # api (:3000) + client (:8081) en el TUI de Turbo
bun run api          # solo la API
bun run client       # solo el cliente Expo
bun run dev:telefono # como bun dev, pero la app le pega a la API de tu máquina por IP
```

## Scripts

| Comando | Qué hace |
|---------|----------|
| `bun dev` | Muestra el entorno (`dev:setup`) y levanta API + cliente |
| `bun run dev:setup` | Solo el chequeo del entorno elegido en Doppler |
| `bun run dev:telefono` | Desarrollo contra un teléfono físico en la red local |
| `bun run build` | Build de todas las apps |
| `bun run lint` | ESLint en todo el monorepo |
| `bun run typecheck` | `tsc --noEmit` por workspace |
| `bun run test` | `bun test` por workspace |
| `bun run client:ios` / `client:android` | Build de desarrollo en simulador o emulador |
| `bun run ports:free` | Libera los puertos 3000 y 8081 |

## Ramas

`develop` (por defecto) → `staging` → `production`. Detalle en [docs/BRANCHING.md](docs/BRANCHING.md).

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Decisiones](docs/DECISIONES.md)
- [Roadmap](docs/ROADMAP.md)
- [Inicio rápido](docs/QUICKSTART.md)
- [Ramas](docs/BRANCHING.md)