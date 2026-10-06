# mi_desorden

Inventario compartido que se cuenta con la **cámara del teléfono**: apuntás a la estantería, la app reconoce los productos y el inventario se actualiza en vivo para todo tu equipo.

> Estado: **MVP**. Vistas, cuentas, inventarios compartidos y tiempo real andan. El reconocimiento todavía está simulado — falta decidir dónde corre el modelo (ver [docs/DECISIONES.md](docs/DECISIONES.md)).

## Arquitectura

```
client (Expo, cámara del teléfono)  ──Supabase──>  auth, inventarios, productos (RLS + Realtime)
          apps/client               ──HTTP────>  api (NestJS en Vercel)  →  detecciones
                                                      apps/api
                         packages/core (tipos + cliente HTTP)
```

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo | Bun workspaces + Turborepo (TUI) |
| App | Expo (React Native) + Expo Router + TanStack Query, cámara con `expo-camera` |
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

## Levantar el proyecto

```bash
bun dev        # api (:3000) + client (:8081) en el TUI de Turbo
bun run api    # solo la API
bun run client # solo el cliente Expo
```

## Scripts

| Comando | Qué hace |
|---------|----------|
| `bun dev` | Muestra el entorno (`dev:setup`) y levanta API + cliente |
| `bun run dev:setup` | Solo el chequeo del entorno elegido en Doppler |
| `bun run build` | Build de todas las apps |
| `bun run lint` | ESLint en todo el monorepo |
| `bun run typecheck` | `tsc --noEmit` por workspace |
| `bun run test` | `bun test` por workspace |

## Ramas

`develop` (por defecto) → `staging` → `production`. Detalle en [docs/BRANCHING.md](docs/BRANCHING.md).

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Decisiones pendientes](docs/DECISIONES.md)
- [Roadmap](docs/ROADMAP.md)
- [Inicio rápido](docs/QUICKSTART.md)
- [Ramas](docs/BRANCHING.md)
