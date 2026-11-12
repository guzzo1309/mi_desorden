# Identidad Visual y Sistema de Diseño — mi_desorden

Este documento define el sistema de identidad visual, tokens de color y lineamientos de diseño para el fork de `mi_desorden`.

---

## 1. Racional de Diseño

`mi_desorden` es una aplicación de inventario compartido impulsada por la cámara para entornos como estantes, depósitos y comercios pequeños. El sistema de color está diseñado para funcionar en tres contextos críticos:
1. **El visor de la cámara:** Fondos oscuros (`#0F1115`), alta legibilidad en estanterías poco iluminadas y un marco de escaneo de alto contraste.
2. **Las listas de inventario:** Interfaz limpia con tonos neutros relajados para lectura prolongada sin saturar la vista.
3. **Sincronización en tiempo real:** Un color de señalización propio para las actualizaciones en vivo de Supabase Realtime, evitando confusiones con acciones primarias o de éxito.

---

## 2. Paleta de Colores

### Primario — Desorden Blue
Color base de la marca, usado en botones primarios, pestañas activas y enlaces.

| Token | Valor Hex | Uso |
|---|---|---|
| `primary[900]` | `#0B1F3A` | Texto oscuro de alto contraste |
| `primary[700]` | `#1D4ED8` | Botones primarios (modo claro), pestañas activas, enlaces |
| `primary[500]` | `#3B82F6` | Botones primarios (modo oscuro), hover/pressed, focus rings |
| `primary[100]` | `#DBEAFE` | Filas seleccionadas, chips, badges sutiles |

### Acento — Scan Amber
Exclusivo para la experiencia de cámara y reconocimiento. Nunca se confunde con botones estándar.

| Token | Valor Hex | Uso |
|---|---|---|
| `accent[600]` | `#D97706` | Esquinas del marco del visor, disparador |
| `accent[400]` | `#FBBF24` | Pulso animado de escaneo, visor en modo oscuro |
| `accent[100]` | `#FEF3C7` | Fondo del badge de reconocimiento |

### Señal en Vivo — Realtime Teal
Distintivo para que las alertas y el pulso en vivo no colisionen con las acciones primarias (azul) ni el éxito (verde).

| Token | Valor Hex | Uso |
|---|---|---|
| `live[600]` | `#0D9488` | Punto de conexión en vivo, toasts de actualización |
| `live[100]` | `#CCFBF1` | Fondo de aviso en tiempo real |

### Neutros — Shelf Gray
Escala de grises balanceada para superficies OLED y fondos claros.

| Token | Valor Hex | Uso |
|---|---|---|
| `neutral[950]` | `#0F1115` | Fondo modo oscuro y visor de cámara |
| `neutral[800]` | `#1F2329` | Superficies de tarjetas en modo oscuro |
| `neutral[200]` | `#E5E7EB` | Bordes, separadores y divisores en modo claro |
| `neutral[50]` | `#F9FAFB` | Fondo de la aplicación en modo claro |
| `neutral[900]` | `#111827` | Texto principal en modo claro |

### Semánticos
| Token | Valor Hex | Uso |
|---|---|---|
| `semantic.success` | `#16A34A` | Confirmación "Producto agregado" |
| `semantic.warning` | `#CA8A04` | Avisos de stock bajo y advertencias |
| `semantic.error` | `#DC2626` | Fallos de reconocimiento, errores de red |

---

## 3. Arquitectura del Código

Los tokens residen en el paquete compartido `@mi-desorden/core`:
- `packages/core/src/theme/colors.ts`: Fuente de verdad (`palette`, `lightTheme`, `darkTheme`, `Palette`, `Theme`).
- `packages/core/src/index.ts`: Exporta los tokens para consumo en cualquier app del monorepo.
- `apps/client/lib/theme.ts`: Hook `useTema()` que mapea los tokens a la experiencia React Native / Expo, respetando el `useColorScheme()`.
