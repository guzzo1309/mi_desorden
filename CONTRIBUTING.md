# Guía de contribución

## Estrategia de ramas

| Rama | Uso |
|------|-----|
| **develop** | Integración diaria. Rama por defecto. Acá se fusionan features y fixes. |
| **staging** | Pre-producción / QA. Código listo para validar. |
| **production** | Producción. Solo código liberado. |

Flujo: `develop` → (PR) → `staging` → (PR) → `production`.

- Ramas nuevas siempre desde `develop` (`feature/xxx`, `fix/xxx`).
- PRs hacia `develop`.
- Los releases se promueven de develop a staging y de staging a production.

Detalle en [docs/BRANCHING.md](docs/BRANCHING.md).

## Cómo contribuir

1. Cloná el repo (la rama por defecto es `develop`)
   ```bash
   git clone https://github.com/guzzo1309/mi_desorden.git
   cd mi_desorden
   ```
2. Configurá el entorno — ver [docs/QUICKSTART.md](docs/QUICKSTART.md).
3. Creá una rama (`feature/xxx` o `fix/xxx`).
4. Desarrollá, commiteá y pusheá — que pasen lint, typecheck y test.
5. Abrí un PR hacia `develop` y completá la plantilla.

## Commits

Conventional commits con el mensaje en español:

```
feat(api): endpoint para listar detecciones
fix(client): la cámara no pedía permiso en Android
chore(ci): cachear dependencias de Bun
```

Ámbitos: `api`, `client`, `core`, `ci`, `docs`.

## Comandos

`bun install` · `bun dev` · `bun run lint` · `bun run typecheck` · `bun run test` · `bun run build`

## CI

En cada PR y en cada push a `develop`, `staging` o `production` corren lint, typecheck y test.
