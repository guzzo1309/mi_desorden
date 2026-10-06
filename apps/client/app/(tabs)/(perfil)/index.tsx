import Constants from "expo-constants";
import { router } from "expo-router";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Avatar, Contenido, Fila, Grupo, IconoCelda } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

export default function Perfil() {
  const t = useTema();
  const { usuario, inventarios, seleccionarInventario, enVivo, setEnVivo, cerrarSesion } =
    useStore();

  if (!usuario) return null;

  return (
    <Contenido>
      <View style={s.heroe}>
        <Avatar nombre={usuario.nombre} tam={88} />
        <Text style={[tipo.titulo2, { color: t.texto }]}>{usuario.nombre}</Text>
        <Text style={[tipo.subtitulo, { color: t.textoSec }]}>{usuario.email}</Text>
      </View>

      <Grupo titulo="Mis inventarios" sangria={58}>
        {inventarios.map((inv) => {
          const n = inv.total_productos;
          return (
            <Fila
              key={inv.id}
              izquierda={<IconoCelda sf="shippingbox.fill" ion="cube" fondo={t.tinte} />}
              titulo={inv.nombre}
              subtitulo={`${n} productos · ${inv.miembros.length} ${inv.miembros.length === 1 ? "persona" : "personas"}`}
              chevron
              onPress={() => {
                seleccionarInventario(inv.id);
                router.navigate("/");
              }}
            />
          );
        })}
      </Grupo>

      <Grupo
        titulo="Preferencias"
        sangria={58}
        pie="Cuando está activa, ves al instante los cambios que hace tu equipo en el inventario."
      >
        <Fila
          izquierda={<IconoCelda sf="dot.radiowaves.left.and.right" ion="radio" fondo={t.verde} />}
          titulo="Actualización en vivo"
          derecha={
            <Switch value={enVivo} onValueChange={setEnVivo} trackColor={{ true: t.verde }} />
          }
        />
      </Grupo>

      <Grupo titulo="Acerca de">
        <Fila titulo="API" valor={process.env.EXPO_PUBLIC_API_URL ?? "localhost:3000"} />
        <Fila titulo="Versión" valor={Constants.expoConfig?.version ?? "—"} />
      </Grupo>

      <Grupo>
        <Fila
          titulo="Cerrar sesión"
          destructiva
          onPress={() =>
            confirmar(
              "¿Cerrar sesión?",
              "Tus inventarios quedan guardados en tu cuenta.",
              "Cerrar sesión",
              () => void cerrarSesion(),
            )
          }
        />
      </Grupo>
    </Contenido>
  );
}

const s = StyleSheet.create({
  heroe: { alignItems: "center", gap: 6, paddingTop: 8 },
});
