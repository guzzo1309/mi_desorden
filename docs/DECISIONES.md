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

## Historial y pedidos de plan

- `movimientos` lo escribe un trigger sobre `productos` (alta, stock, edición, baja), nunca la app: ni un empleado puede falsearlo. Solo lo ve el owner (`puede(inv, 'gestionar_accesos')`). El historial sobrevive al producto (sin FK) y se borra con el inventario. Todavía no hay retención: crece con el uso.
- `inventarios.creado_por` no se puede cambiar (trigger): la política de UPDATE no limita columnas y, sin esto, un owner podría pasar su inventario a otra cuenta para esquivar el límite del plan.
- Pedidos de plan (`pedidos_plan`): un solo pendiente por cuenta (un nuevo pedido reemplaza al anterior), el owner puede cancelarlo, y el admin lo aprueba (cambia el plan con `admin_asignar_plan`) o lo rechaza. Si el admin cambia el plan a mano al pedido, el pedido se cierra solo. Mientras no haya cobro, este es el camino para pasar de plan.

## Cuentas de empleados con contraseña temporal

- El owner **agrega** a su gente (ya no se invita por correo): crea la cuenta con correo y una contraseña temporal, elige el rol (editor o lector) y le pasa los datos. Reemplaza al flujo de invitación por correo desde la app; la base (`invitar`, `invitaciones`) y el endpoint de aviso siguen existiendo.
- La cuenta la crea la API de Nest (`POST /empleados`) con la **service key** (`SUPABASE_SERVICE_ROLE_KEY`, solo en el servidor, nunca en la app). Pero agregar al inventario lo hace la propia persona que llama, con su token, vía `invitar()`: el rol de owner, el límite del plan y el rol asignable los valida la base como siempre. Si no se pudo agregar a ningún inventario, la cuenta recién creada se borra (no quedan cuentas huérfanas).
- Si el correo ya tenía cuenta, solo se lo agrega: su contraseña no se toca.
- La marca de "contraseña temporal" va en `app_metadata` (la escribe solo el servidor) y el trigger de registro anota el hash en `claves_temporales`, una tabla privada sin políticas. `clave_cambiada()` solo limpia la marca si el hash actual es distinto: no se puede saltear llamando a la función sin cambiar la contraseña. Mientras la marca esté, la app solo deja ver la pantalla de elegir contraseña.
- Límite conocido: el owner conoce la contraseña temporal hasta que la persona entra y la cambia. Todavía no hay forma de que el owner resetee la contraseña de un empleado: si la olvida, usa "Olvidé mi contraseña".

## Varias fotos por producto

- Un producto tiene hasta 3 fotos: la principal (`foto_path`, la miniatura de las listas) y 2 extras (`fotos_extra`, rutas en el bucket). Con 2 o 3 fotos desde distintos ángulos el reconocimiento acierta más que con una.
- El reconocimiento no cambió en lo nativo: cada foto tiene su huella y se pasan todas al módulo (`producto#n`); en JS se toma la distancia más chica de cada producto (`lib/referencias.ts`). Las huellas se guardan por ruta (`huellas2`), así que cambiar una foto solo rehace esa.
- Quitar la principal sube la primera extra a principal (las rutas no cambian: no hay que mover archivos). Las extras las cambia solo quien tiene `gestionar_fotos`, igual que la principal (trigger `proteger_foto`).
- En un producto nuevo las fotos quedan pendientes en el teléfono (`lib/fotoPendiente.ts`) y se suben al guardar.

## Reconocimiento: aislar el objeto y aprender de las correcciones

- Antes de calcular la huella visual se aísla el objeto del fondo con la máscara de primer plano de Vision (iOS 17+; en iOS 16 o si no hay un objeto claro se usa la imagen entera). Referencias y foto nueva pasan por lo mismo, así se compara objeto contra objeto. El objeto se pone sobre un gris neutro y, si lo aislado es una mota (menos del 4 % de la imagen), se descarta.
- El módulo expone `huellaVersion` (hoy 2). La caché de huellas del teléfono se llama `huellas-v<versión>`: al cambiar cómo se calcula, las viejas se ignoran y se rehacen solas.
- La cámara ofrece guardar la foto como referencia (viene tildado) cuando el modelo dudó y alguien eligió el producto, o cuando el producto tiene menos de 2 fotos, y solo si quien la sacó puede manejar fotos y hay lugar (máximo 3).

