import { rangoDe, type UsoUsuario } from "@mi-desorden/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  kpis, liberarFotos, memoria, serieProductos, trafico, usoPorUsuario,
} from "@/api/admin";
import { useTema } from "@/lib/theme";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const AHORA = new Date().getFullYear();
const ANIOS = [AHORA, AHORA - 1, AHORA - 2];

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

export default function Admin() {
  const t = useTema();
  const qc = useQueryClient();
  const [anio, setAnio] = useState(AHORA);
  const [mes, setMes] = useState<number | null>(null);
  const [usuario, setUsuario] = useState<string | undefined>();

  const { desde, hasta } = rangoDe(anio, mes);
  const clave = ["admin", anio, mes, usuario] as const;

  const k = useQuery({ queryKey: [...clave, "kpis"], queryFn: () => kpis(desde, hasta, usuario) });
  const traf = useQuery({ queryKey: [...clave, "traf"], queryFn: () => trafico(desde, hasta, usuario) });
  const serie = useQuery({ queryKey: [...clave, "serie"], queryFn: () => serieProductos(desde, hasta, usuario) });
  const equipo = useQuery({ queryKey: ["admin", "usuarios", anio, mes], queryFn: () => usoPorUsuario(desde, hasta) });
  const mem = useQuery({ queryKey: ["admin", "memoria"], queryFn: memoria });

  const liberar = useMutation({
    mutationFn: liberarFotos,
    // Invalidar el prefijo cubre kpis, tráfico y serie de todos los filtros.
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });

  if (k.isLoading) return <View style={e.centro}><ActivityIndicator color={t.tinte} /></View>;
  if (k.isError) {
    return (
      <View style={e.centro}>
        <Text style={{ color: t.textoSec, textAlign: "center" }}>
          {String((k.error as Error).message).includes("42501")
            ? "Solo administradores pueden ver el panel."
            : "No se pudo cargar el panel."}
        </Text>
      </View>
    );
  }

  const d = k.data!;
  const traficoHoras = traf.data ?? [];
  const serieDias = serie.data ?? [];
  const maxHora = Math.max(...traficoHoras.map((p) => p.usos), 1);
  const maxDia = Math.max(...serieDias.map((p) => p.productos), 1);

  return (
    <ScrollView contentContainerStyle={e.cuerpo}>
      <Filtros
        anio={anio} setAnio={setAnio} mes={mes} setMes={setMes}
        usuario={usuario} setUsuario={setUsuario} equipo={equipo.data ?? []}
      />

      <View style={e.grilla}>
        <Kpi etiqueta="Usuarios activos" valor={d.usuarios_activos} destacado />
        <Kpi etiqueta="Usuarios nuevos" valor={d.usuarios_nuevos} />
        <Kpi etiqueta="Usuarios totales" valor={d.usuarios_total} />
        <Kpi etiqueta="Inventarios" valor={d.inventarios} />
        <Kpi etiqueta="Productos registrados" valor={d.productos} />
        <Kpi etiqueta="Productos movidos" valor={d.productos_movidos} />
        <Kpi etiqueta="Requests a la API" valor={d.usos} />
        <Kpi etiqueta="Con error" valor={d.usos_con_error} alerta={(d.usos_con_error ?? 0) > 0} />
        <Kpi etiqueta="Memoria usada" texto={mb(d.memoria_bytes ?? 0)} />
        <Kpi etiqueta="Invitaciones" valor={d.invitaciones} />
      </View>

      <Text style={[e.titulo, { color: t.textoSec }]}>Tránsito por hora</Text>
      {traficoHoras.length ? (
        <View style={e.chart}>
          {traficoHoras.map((p) => (
            <View key={p.hora} style={[e.barra, { height: `${(p.usos / maxHora) * 100}%`, backgroundColor: t.tinte }]} />
          ))}
        </View>
      ) : (
        <Text style={[e.vacio, { color: t.textoSec }]}>Sin datos en el período.</Text>
      )}

      <Text style={[e.titulo, { color: t.textoSec }]}>Productos registrados por día</Text>
      {serieDias.length ? (
        <View style={e.chart}>
          {serieDias.map((p) => (
            <View key={p.dia} style={[e.barra, { height: `${(p.productos / maxDia) * 100}%`, backgroundColor: "#4A9EFF" }]} />
          ))}
        </View>
      ) : (
        <Text style={[e.vacio, { color: t.textoSec }]}>Sin datos en el período.</Text>
      )}

      <Text style={[e.titulo, { color: t.textoSec }]}>Uso por usuario</Text>
      {(equipo.data ?? []).map((u) => (
        <Pressable
          key={u.usuario_id}
          onPress={() => setUsuario(u.usuario_id)}
          style={e.fila}
        >
          <Text style={e.nombre} numberOfLines={1}>
            {u.email}{u.es_admin ? " · admin" : ""}
          </Text>
          <Text style={{ color: t.textoSec, fontSize: 11 }}>
            {u.usos} req · {u.errores} err · {u.productos} prod · {u.movidos} mov
          </Text>
        </Pressable>
      ))}

      <Text style={[e.titulo, { color: t.textoSec }]}>Memoria por usuario</Text>
      {(mem.data ?? []).map((m) => (
        <View key={m.usuario_id} style={e.fila}>
          <Text style={e.nombre} numberOfLines={1}>{m.email}</Text>
          <Text style={{ color: t.textoSec, fontSize: 11 }}>{mb(m.bytes)} · {m.archivos} arch.</Text>
          <Pressable
            onPress={() => liberar.mutate(m.usuario_id)}
            disabled={liberar.isPending}
            style={[e.boton, liberar.isPending && { opacity: 0.5 }]}
          >
            <Text style={e.botonTexto}>Liberar</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function Filtros(p: {
  anio: number; setAnio: (n: number) => void;
  mes: number | null; setMes: (n: number | null) => void;
  usuario?: string; setUsuario: (s?: string) => void;
  equipo: UsoUsuario[];
}) {
  const t = useTema();
  return (
    <View style={{ gap: 8 }}>
      <View style={e.filaChips}>
        {ANIOS.map((a) => (
          <Chip key={a} activo={p.anio === a} onPress={() => p.setAnio(a)}>{String(a)}</Chip>
        ))}
      </View>
      <View style={e.filaChips}>
        <Chip activo={p.mes === null} onPress={() => p.setMes(null)}>Todo el año</Chip>
        {MESES.map((m, i) => (
          <Chip key={m} activo={p.mes === i + 1} onPress={() => p.setMes(i + 1)}>{m.slice(0, 3)}</Chip>
        ))}
      </View>
      <View style={e.filaChips}>
        <Chip activo={!p.usuario} onPress={() => p.setUsuario(undefined)}>Todos</Chip>
        {p.equipo.slice(0, 6).map((u) => (
          <Chip key={u.usuario_id} activo={p.usuario === u.usuario_id} onPress={() => p.setUsuario(u.usuario_id)}>
            {u.email.split("@")[0]}
          </Chip>
        ))}
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.textoSec, opacity: 0.2 }} />
    </View>
  );
}

function Chip(p: { activo: boolean; onPress: () => void; children: string }) {
  const t = useTema();
  return (
    <Pressable
      onPress={p.onPress}
      style={[e.chip, { borderColor: p.activo ? t.tinte : "#2A2A30" }, p.activo && { backgroundColor: t.tinte }]}
    >
      <Text style={{ fontSize: 11, color: p.activo ? "#14100C" : t.textoSec }}>{p.children}</Text>
    </Pressable>
  );
}

function Kpi(p: { etiqueta: string; valor?: number; texto?: string; destacado?: boolean; alerta?: boolean }) {
  return (
    <View style={[e.kpi, p.destacado && e.kpiDest, p.alerta && e.kpiAlerta]}>
      <Text style={e.kpiEt}>{p.etiqueta}</Text>
      <Text style={[e.kpiVal, p.destacado && { color: "#FF9A4D" }, p.alerta && { color: "#F87171" }]}>
        {p.texto ?? p.valor ?? 0}
      </Text>
    </View>
  );
}

const e = StyleSheet.create({
  cuerpo: { padding: 16, gap: 12 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  filaChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: { width: "31%", borderWidth: 1, borderColor: "#2A2A30", borderRadius: 12, padding: 11 },
  kpiDest: { borderColor: "#FF7A1A55" },
  kpiAlerta: { borderColor: "#F8717155" },
  kpiEt: { color: "#9A9AA5", fontSize: 9.5, textTransform: "uppercase" },
  kpiVal: { color: "#ECECEF", fontSize: 20, fontWeight: "700", marginTop: 5 },
  titulo: { fontSize: 12, marginTop: 14, textTransform: "uppercase" },
  vacio: { fontSize: 12, paddingVertical: 6 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 90 },
  barra: { flex: 1, minHeight: 2, borderRadius: 2 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#2A2A30" },
  nombre: { color: "#ECECEF", fontSize: 12, flex: 1 },
  boton: { backgroundColor: "#26262B", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  botonTexto: { color: "#C9C9D1", fontSize: 10.5 },
});