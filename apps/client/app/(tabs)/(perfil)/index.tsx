import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { config } from "@/api";
import { Icono, IconoCelda, tocar } from "@/components/ui";
import {
  Seccion,
  Separador,
  Tarjeta,
  useEntrada,
  useMenuInventario,
  Vista,
} from "@/components/vistas";
import { iniciales } from "@/lib/fecha";
import { useMiPlan } from "@/lib/miPlan";
import { resumenLimites, textoLimite, textoPrecio } from "@/lib/planes";
import { useInventario, useSesion } from "@/lib/store";
import { useTema } from "@/lib/theme";

export default function Perfil() {
  const t = useTema();
  const { usuario, seleccionarInventario, enVivo, setEnVivo, cerrarSesion, esAdmin } = useSesion();
  const { inventarios } = useInventario();
  const entrada = useEntrada(5);
  const menu = useMenuInventario();
  const { data: plan } = useMiPlan();
  // Cerrar sesión pide un segundo toque en 3 s (sin alerta), como el diseño.
  const [seguro, setSeguro] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!usuario) return null;

  function salir() {
    tocar();
    if (seguro) {
      if (timer.current) clearTimeout(timer.current);
      void cerrarSesion();
      return;
    }
    setSeguro(true);
    timer.current = setTimeout(() => setSeguro(false), 3000);
  }

  const host = config.apiUrl.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "");

  return (
    <Vista gap={22}>
      <Animated.View style={[s.heroe, entrada(0)]}>
        <View style={[s.avatar, { backgroundColor: t.tinte, shadowColor: t.tinte }]}>
          <Text style={s.avatarTexto}>{iniciales(usuario.nombre)}</Text>
        </View>
        <Text style={[s.nombre, { color: t.texto }]}>{usuario.nombre}</Text>
        <Text style={[s.email, { color: t.textoSec }]}>{usuario.email}</Text>
        {esAdmin ? (
          <Text style={[s.etiquetaAdmin, { color: t.tinte, borderColor: t.tinte }]}>
            Admin de MI DESORDEN
          </Text>
        ) : null}
      </Animated.View>

      {/* El admin gestiona la plataforma: si no tiene inventarios propios, no se le ofrece crear uno. */}
      {esAdmin && !inventarios.length ? null : (
        <Seccion
          titulo="Mis inventarios"
          pie={
            inventarios.length
              ? "Mantené presionado un inventario para eliminarlo o salir."
              : undefined
          }
          style={entrada(1)}
        >
          <Tarjeta>
            {inventarios.length ? (
              inventarios.map((inv, i) => (
                <View key={inv.id}>
                  {i > 0 ? <Separador sangria={60} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      tocar();
                      seleccionarInventario(inv.id);
                      router.navigate("/");
                    }}
                    onLongPress={() => menu(inv)}
                    delayLongPress={400}
                    accessibilityHint="Mantené presionado para eliminarlo o salir"
                    style={({ pressed }) => [
                      s.fila,
                      { minHeight: 60 },
                      pressed && { backgroundColor: t.relleno },
                    ]}
                  >
                    <IconoCelda sf="shippingbox.fill" ion="cube" fondo={t.tinte} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[s.filaTitulo, { color: t.texto }]} numberOfLines={1}>
                        {inv.nombre}
                      </Text>
                      <Text style={[s.filaSub, { color: t.textoSec }]} numberOfLines={1}>
                        {inv.total_productos} productos · {inv.miembros.length}{" "}
                        {inv.miembros.length === 1 ? "persona" : "personas"}
                      </Text>
                    </View>
                    <Icono
                      sf="chevron.right"
                      ion="chevron-forward"
                      size={13}
                      color={t.textoTer}
                      weight="semibold"
                    />
                  </Pressable>
                </View>
              ))
            ) : (
              <Pressable
                onPress={() => router.push("/inventario-nuevo")}
                style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
              >
                <Text style={[s.filaTitulo, { color: t.tinte }]}>Crear un inventario</Text>
              </Pressable>
            )}
          </Tarjeta>
        </Seccion>
      )}

      {/* El admin no tiene límites que mostrar: su trabajo es la plataforma. */}
      {plan && !esAdmin ? (
        <Seccion titulo="Tu plan" pie={plan.descripcion || resumenLimites(plan)} style={entrada(2)}>
          <Tarjeta>
            <View style={[s.dato, { minHeight: 56 }]}>
              <Text style={[s.filaTitulo, { color: t.texto }]}>{plan.nombre}</Text>
              <Text style={[s.filaTitulo, { color: t.textoSec }]}>
                {textoPrecio(plan.precio_mensual)}
              </Text>
            </View>
            <Separador />
            <View style={s.dato}>
              <Text style={[s.filaTitulo, { color: t.texto }]}>Inventarios</Text>
              <Text
                style={[
                  s.filaTitulo,
                  {
                    color:
                      plan.max_inventarios !== null &&
                      plan.inventarios_usados >= plan.max_inventarios
                        ? t.tinte
                        : t.textoSec,
                  },
                ]}
              >
                {plan.max_inventarios === null
                  ? `${plan.inventarios_usados} (${textoLimite(null).toLowerCase()})`
                  : `${plan.inventarios_usados} de ${plan.max_inventarios}`}
              </Text>
            </View>
          </Tarjeta>
        </Seccion>
      ) : null}

      <Seccion
        titulo="Preferencias"
        pie="Cuando está activa, ves al instante los cambios que hace tu equipo en el inventario."
        style={entrada(2)}
      >
        <Tarjeta>
          <View style={[s.fila, { minHeight: 56 }]}>
            <IconoCelda sf="dot.radiowaves.left.and.right" ion="radio" fondo={t.verde} />
            <Text style={[s.filaTitulo, { color: t.texto, flex: 1 }]}>Actualización en vivo</Text>
            <Switch
              value={enVivo}
              onValueChange={(v) => (tocar(), setEnVivo(v))}
              trackColor={{ true: t.verde }}
            />
          </View>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Acerca de" style={entrada(3)}>
        <Tarjeta>
          <View style={s.dato}>
            <Text style={[s.filaTitulo, { color: t.texto }]}>API</Text>
            <Text style={[s.filaTitulo, { color: t.textoSec, flexShrink: 1 }]} numberOfLines={1}>
              {host}
            </Text>
          </View>
          <Separador />
          <View style={s.dato}>
            <Text style={[s.filaTitulo, { color: t.texto }]}>Versión</Text>
            <Text style={[s.filaTitulo, { color: t.textoSec }]}>
              {Constants.expoConfig?.version ?? "—"}
            </Text>
          </View>
        </Tarjeta>
      </Seccion>

      <Animated.View style={entrada(4)}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={seguro ? "Tocá de nuevo para cerrar la sesión" : undefined}
          onPress={salir}
          style={({ pressed }) => [s.salir, { backgroundColor: pressed ? t.celdaAlta : t.celda }]}
        >
          <Text style={[s.salirTexto, { color: t.rojo }]}>
            {seguro ? "¿Seguro? Tocá de nuevo" : "Cerrar sesión"}
          </Text>
        </Pressable>
      </Animated.View>
    </Vista>
  );
}

const s = StyleSheet.create({
  heroe: { alignItems: "center", gap: 4, paddingTop: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  avatarTexto: { color: "#fff", fontSize: 34, fontWeight: "600" },
  nombre: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  email: { fontSize: 15 },
  etiquetaAdmin: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 8,
  },
  filaTitulo: { fontSize: 17, letterSpacing: -0.4 },
  filaSub: { fontSize: 13 },
  dato: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  salir: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  salirTexto: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
});
