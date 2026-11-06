# web/

Lo que es **solo de la versión web** de la app. El resto del código (pantallas,
estado, API) es el mismo para iPhone, Android y web: Expo lo compila para los tres.

| Archivo          | Qué es                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `TabsLayout.tsx` | Barra de pestañas de la web (arriba / al costado en pantallas anchas). En el teléfono se usan las tabs nativas. |
| `dialogos.ts`    | Confirmaciones, avisos y menús con `window` y el DOM (en el navegador `Alert.alert` no muestra botones).        |
| `SinCamara.tsx`  | Lo que se ve en Cámara y Fotos en la web: la cámara se usa desde el celular.                                    |
| `swiftui.ts`     | Piezas vacías de SwiftUI (solo existe en iPhone).                                                               |

Expo Router y Metro eligen la versión web por la extensión `.web`, que tiene que
estar junto al archivo original. Por eso quedan dos archivos de una línea que
solo apuntan acá:

- `app/(tabs)/_layout.web.tsx` → `web/TabsLayout.tsx`
- `components/swiftui.web.ts` → `web/swiftui.ts`

## Correr la web

```bash
cd apps/client
bunx expo start --web       # en el navegador, con recarga en vivo
bunx expo export -p web     # build estático en dist/
```
