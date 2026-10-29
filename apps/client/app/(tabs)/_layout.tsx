import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useStore } from "@/lib/store";
import { useTema } from "@/lib/theme";

/**
 * Tab bar nativa: en iOS 26+ es Liquid Glass de sistema (y se achica al
 * scrollear), en Android es Material 3 y en web una barra simple.
 */
export default function TabsLayout() {
  const t = useTema();
  // Aviso a quien puede completarlos: productos nuevos de una factura.
  const { porRevisar } = useStore();
  return (
    <NativeTabs
      tintColor={t.tinte}
      minimizeBehavior="onScrollDown"
      labelStyle={{ color: t.textoSec }}
    >
      <NativeTabs.Trigger name="(inventario)">
        <NativeTabs.Trigger.Label>Inventario</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={!porRevisar.length}>
          {String(porRevisar.length)}
        </NativeTabs.Trigger.Badge>
        <NativeTabs.Trigger.Icon
          sf={{ default: "shippingbox", selected: "shippingbox.fill" }}
          md="inventory_2"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camara">
        <NativeTabs.Trigger.Label>Cámara</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "camera.viewfinder", selected: "camera.viewfinder" }}
          md="photo_camera"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(accesos)">
        <NativeTabs.Trigger.Label>Accesos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md="group"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(perfil)">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
