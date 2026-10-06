import type { Miembro, Rol } from "@mi-desorden/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Avatar,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Pildora,
  Segmentado,
  Vacio,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

const ROL_TEXTO: Record<Rol, string> = { dueño: "Dueño", editor: "Editor", lector: "Lector" };

export default function Accesos() {
  const t = useTema();
  const {
    inventarios,
    activo,
    seleccionarInventario,
    usuario,
    miRol,
    invitar,
    cambiarRol,
    quitarMiembro,
  } = useStore();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Exclude<Rol, "dueño">>("editor");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  if (!activo) {
    return (
      <Contenido>
        <Vacio
          sf="person.2"
          ion="people-outline"
          titulo="Sin inventarios"
          texto="Creá un inventario para compartirlo con tu equipo."
        />
      </Contenido>
    );
  }
  const soyDueño = miRol === "dueño";
  const enLinea = activo.miembros.filter((m) => m.en_linea).length;
  const emailValido = /^\S+@\S+\.\S+$/.test(email.trim());

  async function enviar() {
    if (!emailValido || !activo || enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      await invitar(activo.id, email, rol);
      setAviso({ texto: `Listo: ${email.trim().toLowerCase()} ya tiene acceso.`, error: false });
      setEmail("");
    } catch (e) {
      setAviso({ texto: (e as Error).message, error: true });
    } finally {
      setEnviando(false);
    }
  }

  const fallar = (e: Error) => setAviso({ texto: e.message, error: true });

  function quitar(m: Miembro) {
    if (!activo) return;
    confirmar(
      `¿Quitar a ${m.nombre}?`,
      `Deja de ver “${activo.nombre}” al instante.`,
      "Quitar acceso",
      () => {
        quitarMiembro(activo.id, m.usuario_id).catch(fallar);
        setAbierto(null);
      },
    );
  }

  return (
    <Contenido>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.carrusel}
        contentContainerStyle={s.pildoras}
      >
        {inventarios.map((inv) => (
          <Pildora
            key={inv.id}
            activa={inv.id === activo.id}
            onPress={() => seleccionarInventario(inv.id)}
          >
            {inv.nombre}
          </Pildora>
        ))}
        <Pildora onPress={() => router.push("/inventario-nuevo")}>＋ Nuevo</Pildora>
      </ScrollView>

      <Grupo
        titulo={`${activo.miembros.length} ${activo.miembros.length === 1 ? "persona" : "personas"} · ${enLinea} en línea`}
        sangria={68}
        pie={
          soyDueño
            ? "Tocá a alguien para cambiar su rol o quitarle el acceso."
            : `Tu rol en este inventario: ${ROL_TEXTO[miRol]}.`
        }
      >
        {activo.miembros.flatMap((m) => {
          const soyYo = m.usuario_id === usuario?.id;
          const editable = soyDueño && !soyYo && m.rol !== "dueño";
          const fila = (
            <Fila
              key={m.usuario_id}
              izquierda={<Avatar nombre={m.nombre} enLinea={m.en_linea} />}
              titulo={soyYo ? `${m.nombre} (vos)` : m.nombre}
              subtitulo={m.en_linea ? "Viendo ahora" : m.email}
              valor={ROL_TEXTO[m.rol]}
              chevron={editable}
              onPress={
                editable
                  ? () => setAbierto((a) => (a === m.usuario_id ? null : m.usuario_id))
                  : undefined
              }
            />
          );
          if (abierto !== m.usuario_id) return [fila];
          return [
            fila,
            <View key={`${m.usuario_id}-edit`} style={s.edicion}>
              <Segmentado<Exclude<Rol, "dueño">>
                valor={m.rol === "lector" ? "lector" : "editor"}
                onCambio={(r) => cambiarRol(activo.id, m.usuario_id, r).catch(fallar)}
                opciones={[
                  { valor: "lector", etiqueta: "Lector" },
                  { valor: "editor", etiqueta: "Editor" },
                ]}
              />
            </View>,
            <Fila
              key={`${m.usuario_id}-quitar`}
              titulo="Quitar acceso"
              destructiva
              onPress={() => quitar(m)}
            />,
          ];
        })}
      </Grupo>

      {soyDueño ? (
        <Grupo
          titulo="Invitar"
          pie={
            aviso?.texto ??
            "La persona tiene que tener cuenta. Los editores agregan y cambian productos; los lectores solo miran."
          }
          pieError={aviso?.error}
        >
          <CampoFila
            placeholder="correo@ejemplo.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onSubmitEditing={enviar}
          />
          <View style={s.edicion}>
            <Segmentado<Exclude<Rol, "dueño">>
              valor={rol}
              onCambio={setRol}
              opciones={[
                { valor: "lector", etiqueta: "Lector" },
                { valor: "editor", etiqueta: "Editor" },
              ]}
            />
          </View>
          <Fila
            titulo={enviando ? "Enviando…" : "Dar acceso"}
            tinte
            apagada={!emailValido || enviando}
            onPress={emailValido && !enviando ? enviar : undefined}
          />
        </Grupo>
      ) : (
        <Text style={[tipo.nota, { color: t.textoSec, textAlign: "center" }]}>
          Solo el dueño puede invitar gente.
        </Text>
      )}
    </Contenido>
  );
}

const s = StyleSheet.create({
  carrusel: { marginHorizontal: -16, flexGrow: 0 },
  pildoras: { gap: 8, paddingHorizontal: 16 },
  edicion: { paddingHorizontal: 16, paddingVertical: 12 },
});
