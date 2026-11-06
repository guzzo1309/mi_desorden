import type { Solicitud } from "@mi-desorden/core";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { mensajeError } from "@/api";
import { Icono, tocar } from "@/components/ui";
import { Separador, Tarjeta } from "@/components/vistas";
import { haceCuanto } from "@/lib/fecha";
import { useInventario, useSesion, useSolicitudes } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/**
 * Solicitudes pendientes del inventario activo.
 * - Owner y editores: todas, con Aceptar / Rechazar.
 * - Lector: las suyas, con Retirar.
 */
export function Solicitudes() {
  const t = useTema();
  const { usuario } = useSesion();
  const { activo, productosActivos } = useInventario();
  const { solicitudes: lista, resuelvo } = useSolicitudes();
  if (!lista.length) return null;

  const nombreProducto = (s: Solicitud) =>
    productosActivos.find((p) => p.id === s.producto_id)?.nombre ?? "un producto que ya no está";
  const quien = (s: Solicitud) =>
    s.creado_por === usuario?.id
      ? "Tú"
      : (activo?.miembros.find((m) => m.usuario_id === s.creado_por)?.nombre ?? "Alguien");
  const texto = (s: Solicitud) =>
    s.tipo === "agregar"
      ? `Agregar “${s.detalle}”`
      : s.tipo === "eliminar"
        ? `Eliminar “${nombreProducto(s)}”`
        : `Poner ${s.cantidad} de “${nombreProducto(s)}”`;

  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.titulo, { color: t.textoSec }]}>
        {resuelvo
          ? `Solicitudes (${lista.length})`
          : lista.length === 1
            ? "Tu pedido pendiente"
            : "Tus pedidos pendientes"}
      </Text>
      <Tarjeta>
        {lista.map((sol, i) => (
          <View key={sol.id}>
            {i > 0 ? <Separador /> : null}
            <FilaSolicitud
              solicitud={sol}
              texto={texto(sol)}
              subtitulo={[
                quien(sol),
                haceCuanto(sol.creado_en),
                sol.tipo !== "agregar" ? sol.detalle : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              resuelvo={resuelvo}
            />
          </View>
        ))}
      </Tarjeta>
    </View>
  );
}

function FilaSolicitud({
  solicitud,
  texto,
  subtitulo,
  resuelvo,
}: {
  solicitud: Solicitud;
  texto: string;
  subtitulo: string;
  resuelvo: boolean;
}) {
  const t = useTema();
  const { resolver: resolverSolicitud, retirar: retirarSolicitud } = useSolicitudes();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hacer(accion: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e));
      setOcupado(false);
    }
  }

  const aceptar = () =>
    hacer(async () => {
      await resolverSolicitud(solicitud, true);
      // "agregar": quien acepta termina de cargar el producto.
      if (solicitud.tipo === "agregar") {
        router.push({
          pathname: "/producto",
          params: { nombre: solicitud.detalle.split(" · ")[0] },
        });
      }
    });

  const icono =
    solicitud.tipo === "agregar"
      ? { sf: "plus.circle" as const, ion: "add-circle-outline" as const }
      : solicitud.tipo === "eliminar"
        ? { sf: "trash" as const, ion: "trash-outline" as const }
        : { sf: "plusminus" as const, ion: "swap-vertical" as const };

  return (
    <View style={s.fila}>
      <Icono sf={icono.sf} ion={icono.ion} size={20} color={t.tinte} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={2}>
          {texto}
        </Text>
        <Text style={[tipo.nota, { color: error ? t.rojo : t.textoSec }]} numberOfLines={2}>
          {error ?? subtitulo}
        </Text>
      </View>
      {ocupado ? (
        <ActivityIndicator />
      ) : resuelvo ? (
        <View style={s.botones}>
          <Boton
            etiqueta="Rechazar"
            color={t.textoSec}
            onPress={() => hacer(() => resolverSolicitud(solicitud, false))}
          />
          <Boton etiqueta="Aceptar" color={t.tinte} fuerte onPress={aceptar} />
        </View>
      ) : (
        <Boton
          etiqueta="Retirar"
          color={t.rojo}
          onPress={() => hacer(() => retirarSolicitud(solicitud.id))}
        />
      )}
    </View>
  );
}

function Boton({
  etiqueta,
  color,
  fuerte,
  onPress,
}: {
  etiqueta: string;
  color: string;
  fuerte?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => ({
        opacity: pressed ? 0.5 : 1,
        paddingHorizontal: 6,
        paddingVertical: 4,
      })}
    >
      <Text style={[tipo.subtitulo, { color, fontWeight: fuerte ? "600" : "400" }]}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  titulo: { fontSize: 13, paddingHorizontal: 16 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 60 },
  botones: { flexDirection: "row", gap: 4 },
});
