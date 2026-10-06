# Roadmap

**Documentación:** [Índice](README.md)

## Fase 0 — Estructura ✅

- [x] Monorepo Bun + Turborepo
- [x] API en NestJS con deploy serverless en Vercel
- [x] Cliente Expo con tabs nativas
- [x] CI y ramas develop / staging / production

## Fase 1 — MVP de inventario ✅

- [x] Registro e inicio de sesión (Supabase Auth)
- [x] Inventarios compartidos con roles (dueño, editor, lector)
- [x] Productos con stock, estante y color de LED
- [x] Cambios en vivo y presencia (Realtime)
- [x] Vista de cámara con permisos (reconocimiento simulado)

## Fase 2 — Reconocimiento con el teléfono

- [ ] Decidir dónde corre el modelo ([DECISIONES.md](DECISIONES.md))
- [ ] Dataset de los productos de la demo
- [ ] Primera clasificación de punta a punta desde la cámara
- [ ] Guardar las detecciones en Supabase (hoy la API las tiene en memoria)

## Fase 3 — Producto

- [ ] API de producción separada (hoy prd usa la de Vercel, igual que stg)
- [ ] Push cuando un producto baja del mínimo
- [ ] Historial de detecciones por inventario en la app
