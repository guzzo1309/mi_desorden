import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ActivityIndicator, View } from "react-native";
import { useStore } from "@/lib/store";
import { useTema } from "@/lib/theme";

/**
 * Tab bar nativa: en iOS 26+ es Liquid Glass de sistema (y se achica al
 * scrollear), en Android es Material 3 y en web una barra simple.
 */
export default function TabsLayout() {
  const t = useTema();
  // Aviso a quien puede completarlos: productos nuevos de una factura.
  const { porRevisar, esAdmin, cargandoRol } = useStore();
  // Hasta saber si es admin no se arma la barra: evita ver un instante las pestañas del otro rol.
  if (cargandoRol) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.fondo,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <NativeTabs
      tintColor={t.tinte}
      minimizeBehavior="onScrollDown"
      labelStyle={{ color: t.textoSec }}
    >
      {/* Admin de MI DESORDEN: ve la plataforma, no inventarios. Los demás, al revés. */}
      <NativeTabs.Trigger name="(resumen)" hidden={!esAdmin}>
        <NativeTabs.Trigger.Label>Resumen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="monitoring"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(usuarios)" hidden={!esAdmin}>
        <NativeTabs.Trigger.Label>Usuarios</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.3", selected: "person.3.fill" }}
          md="groups"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(inventario)" hidden={esAdmin}>
        <NativeTabs.Trigger.Label>Inventario</NativeTabs.Trigger.Label>
        {/* Sin pendientes no se renderiza: `hidden` dejaba el "0" a la vista en iOS. */}
        {porRevisar.length ? (
          <NativeTabs.Trigger.Badge>{String(porRevisar.length)}</NativeTabs.Trigger.Badge>
        ) : null}
        <NativeTabs.Trigger.Icon
          sf={{ default: "shippingbox", selected: "shippingbox.fill" }}
          md="inventory_2"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camara" hidden={esAdmin}>
        <NativeTabs.Trigger.Label>Cámara</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "camera.viewfinder", selected: "camera.viewfinder" }}
          md="photo_camera"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(accesos)" hidden={esAdmin}>
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
