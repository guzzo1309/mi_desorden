import Constants from "expo-constants";
import { router } from "expo-router";
import { Animated, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { config } from "@/api";
import { MenuPuntos } from "@/components/menus";
import { PlanUso } from "@/components/PlanUso";
import { Icono, IconoCelda, tocar } from "@/components/ui";
import {
  Seccion,
  Separador,
  Tarjeta,
  useEntrada,
  useMenuInventario,
  Vista,
} from "@/components/vistas";
import { confirmar } from "@/lib/confirmar";
import { iniciales } from "@/lib/fecha";
import { useLimitesInventario, useMiPedido, useMiPlan } from "@/lib/miPlan";
import { resumenLimites, textoPrecio } from "@/lib/planes";
import { NOMBRE_ROL } from "@/lib/roles";
import { useInventario, useSesion } from "@/lib/store";
import { useTema, fuenteMarca } from "@/lib/theme";

export default function Perfil() {
  const t = useTema();
  const { usuario, seleccionarInventario, enVivo, setEnVivo, cerrarSesion, esAdmin } = useSesion();
  const { inventarios, activo } = useInventario();
  const entrada = useEntrada(5);
  const menu = useMenuInventario();
  const { data: plan } = useMiPlan();
  const { data: pedido } = useMiPedido();
  const { data: limites } = useLimitesInventario(activo?.id);

  if (!usuario) return null;
  const activoEsMio = activo?.miembros.find((m) => m.usuario_id === usuario.id)?.rol === "owner";

  function salir() {
    tocar();
    confirmar(
      "¿Cerrar sesión?",
      "Vas a tener que volver a iniciar sesión para entrar.",
      "Cerrar sesión",
      () => void cerrarSesion(),
    );
  }

  const host = config.apiUrl.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "");

  return (
    <Vista gap={22} titulo={usuario.nombre}>
      <Animated.View style={entrada(0)}>
        <Tarjeta>
          <View
            style={s.cuenta}
            accessible
            accessibilityLabel={`${usuario.nombre}, ${usuario.email}`}
          >
            <View style={[s.avatar, { backgroundColor: t.tinte }]}>
              <Text style={[s.avatarTexto, { color: t.sobreTinte }]}>
                {iniciales(usuario.nombre)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[s.nombre, { color: t.texto }]} numberOfLines={1}>
                {usuario.nombre}
              </Text>
              <Text style={[s.filaSub, { color: t.textoSec }]} numberOfLines={1}>
                {usuario.email}
              </Text>
              {esAdmin ? (
                <Text style={[s.filaSub, { color: t.tinte, fontWeight: "600" }]}>
                  Admin de MI DESORDEN
                </Text>
              ) : null}
            </View>
          </View>
        </Tarjeta>
      </Animated.View>

      {/* El admin gestiona la plataforma: si no tiene inventarios propios, no se le ofrece crear uno. */}
      {esAdmin && !inventarios.length ? null : (
        <Seccion titulo="Mis inventarios" style={entrada(1)}>
          <Tarjeta>
            {inventarios.length ? (
              inventarios
                .map((inv, i) => {
                  const miRol = inv.miembros.find((m) => m.usuario_id === usuario.id)?.rol;
                  const owner = miRol === "owner";
                  const abrir = () => {
                    tocar();
                    seleccionarInventario(inv.id);
                    router.navigate("/");
                  };
                  return (
                    <View key={inv.id}>
                      {i > 0 ? <Separador sangria={60} /> : null}
                      <View style={[s.fila, { minHeight: 64 }]}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${inv.nombre}. ${miRol ? NOMBRE_ROL[miRol] : ""}`}
                          onPress={abrir}
                          style={({ pressed }) => [s.abrir, pressed && { opacity: 0.6 }]}
                        >
                          <IconoCelda sf="shippingbox.fill" ion="cube" fondo={t.tinte} />
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <Text style={[s.filaTitulo, { color: t.texto }]} numberOfLines={1}>
                              {inv.nombre}
                            </Text>
                            <Text style={[s.filaSub, { color: t.textoSec }]} numberOfLines={1}>
                              {miRol ? `${NOMBRE_ROL[miRol]} · ` : ""}
                              {inv.total_productos}{" "}
                              {inv.total_productos === 1 ? "producto" : "productos"}
                              {" · "}
                              {inv.miembros.length}{" "}
                              {inv.miembros.length === 1 ? "persona" : "personas"}
                            </Text>
                          </View>
                          {inv.id === activo?.id ? (
                            <Icono
                              sf="checkmark"
                              ion="checkmark"
                              size={17}
                              color={t.tinte}
                              weight="semibold"
                            />
                          ) : null}
                        </Pressable>
                        <MenuPuntos
                          titulo={inv.nombre}
                          grupos={
                            owner
                              ? [
                                  [
                                    {
                                      etiqueta: "Editar inventario",
                                      sf: "pencil",
                                      onPress: () =>
                                        router.push({
                                          pathname: "/inventario-nuevo",
                                          params: { id: inv.id },
                                        }),
                                    },
                                    {
                                      etiqueta: "Ver historial",
                                      sf: "clock.arrow.circlepath",
                                      onPress: () => {
                                        seleccionarInventario(inv.id);
                                        router.push("/historial");
                                      },
                                    },
                                  ],
                                  [
                                    {
                                      etiqueta: "Eliminar inventario",
                                      sf: "trash",
                                      destructiva: true,
                                      onPress: () => menu(inv),
                                    },
                                  ],
                                ]
                              : [
                                  [
                                    {
                                      etiqueta: "Salir del inventario",
                                      sf: "rectangle.portrait.and.arrow.right",
                                      destructiva: true,
                                      onPress: () => menu(inv),
                                    },
                                  ],
                                ]
                          }
                        />
                      </View>
                    </View>
                  );
                })
                .concat(
                  <View key="nuevo">
                    <Separador sangria={60} />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => (tocar(), router.push("/inventario-nuevo"))}
                      style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
                    >
                      <View style={s.mas}>
                        <Icono sf="plus" ion="add" size={18} color={t.tinte} weight="semibold" />
                      </View>
                      <Text style={[s.filaTitulo, { color: t.tinte }]}>Nuevo inventario</Text>
                    </Pressable>
                  </View>,
                )
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
        <Seccion
          titulo="Tu plan"
          pie={
            pedido
              ? `Pediste el plan ${pedido.plan}: te avisamos cuando el admin lo revise.`
              : `${textoPrecio(plan.precio_mensual)}. ${plan.descripcion || resumenLimites(plan)}`
          }
          style={entrada(2)}
        >
          <PlanUso
            plan={plan.nombre}
            usos={[
              {
                etiqueta: "Inventarios",
                usados: plan.inventarios_usados,
                max: plan.max_inventarios,
              },
              // Productos y personas cuentan por inventario: los del que tienes abierto.
              ...(limites && activoEsMio
                ? [
                    {
                      etiqueta: "Productos",
                      usados: limites.productos,
                      max: limites.max_productos,
                    },
                    { etiqueta: "Personas", usados: limites.personas, max: limites.max_personas },
                  ]
                : []),
            ]}
            onCambiar={() => (tocar(), router.push("/pedir-plan"))}
          />
        </Seccion>
      ) : null}

      <Seccion
        titulo="Preferencias"
        pie="Ves al instante lo que cambia tu equipo."
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
              // En iOS 26 el switch mide más de lo que RN reserva y tocaba el borde.
              style={{ marginRight: 6 }}
            />
          </View>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Acerca de" style={entrada(3)}>
        <Tarjeta>
          {__DEV__ ? (
            <>
              <View style={s.dato}>
                <Text style={[s.filaTitulo, { color: t.texto }]}>API</Text>
                <Text
                  style={[s.filaTitulo, { color: t.textoSec, flexShrink: 1 }]}
                  numberOfLines={1}
                >
                  {host}
                </Text>
              </View>
              <Separador />
            </>
          ) : null}
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
          onPress={salir}
          style={({ pressed }) => [s.salir, { backgroundColor: pressed ? t.celdaAlta : t.celda }]}
        >
          <Text style={[s.salirTexto, { color: t.rojo }]}>Cerrar sesión</Text>
        </Pressable>
      </Animated.View>
    </Vista>
  );
}

const s = StyleSheet.create({
  cuenta: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { fontSize: 22, fontWeight: "600", fontFamily: fuenteMarca },
  nombre: { fontSize: 20, fontWeight: "700", fontFamily: fuenteMarca, letterSpacing: -0.3 },
  mas: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  abrir: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 14 },
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
