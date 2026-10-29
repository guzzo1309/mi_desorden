# Decisiones

**Documentación:** [Índice](README.md)

## Tomadas

| Decisión | Por qué |
|----------|---------|
| Monorepo Bun + Turborepo | Mismo esquema que nexo y wave: un `bun dev` levanta todo |
| NestJS (antes Elysia) | La API va a crecer por módulos (detecciones, después reconocimiento): Nest da la estructura modular, DI y validación con DTOs. Corre sobre Bun |
| Cámara del teléfono en vez de ESP32 | No hace falta hardware propio: cualquier teléfono del equipo cuenta el inventario. Se sacó el firmware, el módulo de dispositivos y `DEVICE_TOKEN` (queda en el historial de git) |
| `packages/core` con los tipos | Que el cliente y la API no se desincronicen |
| Ramas develop / staging / production | Mismo flujo que canchapp y nexo |
| Supabase para auth e inventario | Lo de siempre: auth, Postgres con RLS y Realtime sin servidor propio. Esquema en `supabase/migrations/` |
| La app habla directo con Supabase | RLS decide qué ve cada uno. La API queda para lo que no puede correr en el teléfono (reconocimiento, procesos de fondo) |

## Pendientes

### 1. Dónde corre el reconocimiento

**Decidido (oct 2026): en el teléfono, con Apple Vision.** Gratis, sin red y la foto no sale del teléfono. Se sacaron los LEDs.

- `VNGenerateImageFeaturePrint`: la foto se compara con la foto de cada producto (las huellas se guardan en el teléfono, `lib/huellas.ts`).
- `VNRecognizeText`: lee la etiqueta (marca, nombre, tamaño) y la compara con el nombre del producto.
- `lib/reconocer.ts` combina las dos señales y decide: reconocido, "¿cuál es?" o producto nuevo (con la misma foto como referencia).
- Módulo nativo propio en `apps/client/modules/reconocer` (solo iOS por ahora; Android quedaría con ML Kit).
- Alternativa descartada por ahora: IA en la nube (Gemini/Claude). Reconoce más cosas, pero necesita red, tiene costo o cuotas y la foto sale del teléfono.

Lo de abajo queda como contexto de la decisión.

| Opción | A favor | En contra |
|--------|---------|-----------|
| **En el teléfono** (TFLite / Core ML) | Sin red, latencia baja, no sale ninguna foto del teléfono | Modelo chico, pesa en la app, hay que mantener iOS y Android |
| **En el servidor** | Modelos grandes (YOLO, ONNX), se actualiza sin publicar la app | Necesita red, subir frames, más latencia y costo |
| **Híbrido** | El teléfono detecta el LED / el recuadro y el servidor clasifica solo ese recorte | Más código de los dos lados |

Antes de esto, la cámara elegía al azar un producto con el LED seleccionado (simulado).

### 2. Base de datos de la API

El inventario ya vive en Supabase. Falta que `DetectionsRepository` deje la memoria y escriba en Supabase, con la service key del lado del servidor.

### 3. Dónde guardar las imágenes

Si se manda el recorte del frame: Supabase Storage, S3, o nada (solo la etiqueta).

## Planes y límites

- El plan es de la cuenta owner: los límites cuentan los inventarios que creó y lo que hay en ellos (productos, personas = miembros + invitaciones pendientes). Los empleados invitados no gastan de su propio plan.
- Los planes son datos (`planes`), no constantes: un límite `null` es ilimitado, y se archivan, no se borran. La asignación va en `suscripciones` con historial (una vigente por cuenta); hoy la hace el admin a mano.
- Los límites los aplican triggers de la base (código `53400`), con un `for update` sobre el perfil del owner para que dos altas simultáneas no se cuelen. Bajar el límite de un plan no borra datos: solo frena las altas nuevas.
- Las acciones del admin quedan en `admin_log` (append-only).
- Tokens de uso: diferidos. Hoy no hay nada que los gaste (la cámara y las facturas se resuelven en el teléfono). Cuando exista una función en la nube: libro `consumo_tokens` append-only, cuota mensual con un único `UPDATE` atómico y clave de idempotencia, registrados solo desde la API con la service key.
