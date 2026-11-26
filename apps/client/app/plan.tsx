import type { Periodo, Plan } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ComponentProps, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { admin } from "@/api";
import { TarjetaPlan } from "@/components/TarjetaPlan";
import {
  BotonCabecera,
  CampoFila,
  Contenido,
  Grupo,
  Icono,
  IconoCelda,
  tocar,
} from "@/components/ui";
import { ahorroAnual, dinero, leerLimite } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

/** "Plan Pro" → "plan_pro": el código estable que se genera al crear. */
const aCodigo = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

const aTexto = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : String(n).replace(".", ",");

/** "9,99" → 9.99; vacío → null; algo que no es número → NaN. */
const leerMonto = (txt: string) => {
  const limpio = txt.trim().replace(",", ".");
  return limpio ? Number(limpio) : null;
};

export default function PlanForm() {
  const t = useTema();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: planes } = useQuery({ queryKey: ["admin", "planes"], queryFn: admin.planes });
  const existente = id ? planes?.find((p) => p.id === id) : undefined;

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [codigo, setCodigo] = useState(existente?.codigo ?? "");
  const [codigoEditado, setCodigoEditado] = useState(false);
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? "");
  const [maxInv, setMaxInv] = useState(aTexto(existente?.max_inventarios));
  const [maxProd, setMaxProd] = useState(aTexto(existente?.max_productos));
  const [maxPers, setMaxPers] = useState(aTexto(existente?.max_personas));
  const [maxCat, setMaxCat] = useState(aTexto(existente?.max_categorias));
  const [precio, setPrecio] = useState(aTexto(existente?.precio_mensual));
  const [precioAnual, setPrecioAnual] = useState(aTexto(existente?.precio_anual));
  const [activo, setActivo] = useState(existente?.activo ?? true);
  const [vista, setVista] = useState<Periodo>("mensual");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limInv = leerLimite(maxInv);
  const limProd = leerLimite(maxProd);
  const limPers = leerLimite(maxPers);
  const limCat = leerLimite(maxCat);
  const limitesValidos =
    limInv !== undefined && limProd !== undefined && limPers !== undefined && limCat !== undefined;
  const precioNum = leerMonto(precio);
  const anualNum = leerMonto(precioAnual);
  const montoValido = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0);
  const precioValido = montoValido(precioNum) && montoValido(anualNum);
  // Sugerencia para el anual: 12 meses con 20 % menos.
  const anualSugerido =
    precioNum && Number.isFinite(precioNum) ? Math.round(precioNum * 12 * 0.8 * 100) / 100 : null;
  const codigoFinal = existente ? existente.codigo : codigo || aCodigo(nombre);
  const valido =
    nombre.trim().length >= 2 &&
    /^[a-z0-9_]{2,30}$/.test(codigoFinal) &&
    limitesValidos &&
    precioValido &&
    !guardando;

  // Vista previa: la misma tarjeta que ve quien compra, con lo que se va escribiendo.
  const ordenados = [...(planes ?? [])].sort((a, b) => a.orden - b.orden);
  const nivel = existente ? Math.max(0, ordenados.indexOf(existente)) : ordenados.length;
  const borrador: Plan = {
    id: existente?.id ?? "nuevo",
    codigo: codigoFinal,
    nombre: nombre.trim() || "Nuevo plan",
    descripcion: descripcion.trim(),
    max_inventarios: limInv ?? null,
    max_productos: limProd ?? null,
    max_personas: limPers ?? null,
    max_categorias: limCat ?? null,
    precio_mensual: precioValido ? precioNum : null,
    precio_anual: precioValido ? anualNum : null,
    activo,
    orden: existente?.orden ?? ordenados.length,
  };
  const ahorro = precioValido ? ahorroAnual(borrador) : null;

  async function guardar() {
    if (
      !valido ||
      limInv === undefined ||
      limProd === undefined ||
      limPers === undefined ||
      limCat === undefined
    )
      return;
    setGuardando(true);
    setError(null);
    try {
      await admin.guardarPlan({
        id: existente?.id,
        codigo: codigoFinal,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        max_inventarios: limInv,
        max_productos: limProd,
        max_personas: limPers,
        max_categorias: limCat,
        precio_mensual: precioNum,
        precio_anual: anualNum,
        activo,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "planes"] }),
        qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
        qc.invalidateQueries({ queryKey: ["planes", "disponibles"] }),
      ]);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  const pieLimites = !limitesValidos
    ? "Los límites son números enteros mayores que cero, o vacío para ilimitado."
    : "Deja un límite vacío para que sea ilimitado (∞).";

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Editar plan" : "Nuevo plan",
          headerLeft: () => <BotonCabecera texto="Volver" atras onPress={() => router.back()} />,
          headerRight: () =>
            guardando ? (
              <ActivityIndicator style={{ paddingHorizontal: 16 }} />
            ) : (
              <BotonCabecera
                texto={existente ? "Guardar" : "Crear"}
                fuerte
                apagado={!valido}
                onPress={guardar}
              />
            ),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {/* Vista previa en vivo */}
        <View style={s.previa}>
          {/* La tarjeta trae 6 pt de aro (borde + padding): se compensa para que la cara
              quede del mismo ancho que los grupos de abajo. */}
          <View style={{ marginHorizontal: -6 }}>
            <TarjetaPlan plan={borrador} nivel={nivel} periodo={vista} />
          </View>
          <View style={s.previaPie}>
            <Text style={[tipo.leyenda, s.previaTitulo, { color: t.textoSec }]}>
              ASÍ LO VEN TUS USUARIOS
            </Text>
            <View style={[s.selector, { backgroundColor: t.relleno }]} accessibilityRole="tablist">
              {(["mensual", "anual"] as const).map((p) => {
                const elegido = vista === p;
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: elegido }}
                    onPress={() => (tocar(), setVista(p))}
                    style={[s.opcion, elegido && { backgroundColor: t.celda }]}
                  >
                    <Text
                      style={[
                        tipo.leyenda,
                        { color: elegido ? t.texto : t.textoSec, fontWeight: "600" },
                      ]}
                    >
                      {p === "mensual" ? "Mes" : "Año"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Grupo titulo="Identidad">
          <CampoFila
            etiqueta="Nombre"
            placeholder="Pro"
            value={nombre}
            onChangeText={(v) => {
              setNombre(v);
              if (!existente && !codigoEditado) setCodigo(aCodigo(v));
            }}
            autoFocus={!existente}
            maxLength={40}
          />
          <View style={s.fila}>
            <Text style={[tipo.cuerpo, { color: t.texto, width: 110 }]}>Código</Text>
            {existente ? (
              <View style={s.codigoFijo}>
                <Text style={[s.mono, { color: t.textoSec }]}>{existente.codigo}</Text>
                <Icono sf="lock.fill" ion="lock-closed" size={13} color={t.textoTer} />
              </View>
            ) : (
              <Entrada
                placeholder="pro"
                value={codigo}
                onChangeText={(v) => {
                  setCodigo(v.toLowerCase());
                  setCodigoEditado(true);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                style={s.mono}
              />
            )}
          </View>
          <CampoFila
            etiqueta="Descripción"
            placeholder="Opcional"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            maxLength={200}
          />
        </Grupo>

        <Grupo titulo="Límites" pie={pieLimites} pieError={!limitesValidos} sangria={58}>
          <FilaLimite
            sf="archivebox.fill"
            ion="archive"
            color={t.tinte}
            titulo="Inventarios"
            valor={maxInv}
            onCambio={setMaxInv}
          />
          <FilaLimite
            sf="square.grid.2x2.fill"
            ion="grid"
            color={t.violeta}
            titulo="Categorías"
            detalle="por inventario"
            valor={maxCat}
            onCambio={setMaxCat}
          />
          <FilaLimite
            sf="shippingbox.fill"
            ion="cube"
            color={t.azul}
            titulo="Productos"
            detalle="por inventario"
            valor={maxProd}
            onCambio={setMaxProd}
          />
          <FilaLimite
            sf="person.2.fill"
            ion="people"
            color={t.verde}
            titulo="Personas"
            detalle="por inventario"
            valor={maxPers}
            onCambio={setMaxPers}
          />
        </Grupo>

        <Grupo
          titulo="Precio"
          pie={
            !precioValido
              ? "Los precios tienen que ser números, por ejemplo 9,99."
              : "Las compras son de prueba: no se cobra nada. Sin precio, el plan es gratis."
          }
          pieError={!precioValido}
        >
          <FilaPrecio titulo="Por mes" valor={precio} onCambio={setPrecio} placeholder="Gratis" />
          <FilaPrecio
            titulo="Por año"
            valor={precioAnual}
            onCambio={setPrecioAnual}
            placeholder={anualSugerido ? aTexto(anualSugerido) : "12 meses"}
            chip={
              ahorro ? (
                <View style={[s.chip, { backgroundColor: `${t.verde}26` }]}>
                  <Text style={[tipo.leyenda, { color: t.verde, fontWeight: "700" }]}>
                    −{ahorro} %
                  </Text>
                </View>
              ) : null
            }
          />
          {anualSugerido && !precioAnual.trim() ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => (tocar(), setPrecioAnual(aTexto(anualSugerido)))}
              style={({ pressed }) => [s.fila, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icono sf="sparkles" ion="sparkles" size={16} color={t.tinte} />
              <Text style={[tipo.cuerpo, { color: t.tinte, flex: 1 }]}>
                Usar {dinero(anualSugerido)} al año (−20 %)
              </Text>
            </Pressable>
          ) : null}
        </Grupo>

        {existente ? (
          <Grupo
            pie={
              existente.codigo === "free"
                ? "Free es el plan de toda cuenta nueva: no se puede archivar."
                : "Un plan archivado no se puede comprar. Quienes lo tienen lo conservan."
            }
          >
            <View style={s.fila}>
              <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>
                {activo ? "A la venta" : "Archivado"}
              </Text>
              <Switch
                value={activo}
                onValueChange={setActivo}
                disabled={existente.codigo === "free"}
                trackColor={{ true: t.verde }}
              />
            </View>
          </Grupo>
        ) : null}

        {error ? (
          <Text style={[tipo.nota, { color: t.rojo, paddingHorizontal: 16 }]}>{error}</Text>
        ) : null}
      </Contenido>
    </>
  );
}

/** Campo sin etiqueta, alineado a la derecha, para las filas de esta pantalla. */
function Entrada({ style, ...props }: TextInputProps) {
  const t = useTema();
  return (
    <TextInput
      placeholderTextColor={t.textoTer}
      selectionColor={t.tinte}
      style={[
        tipo.cuerpo,
        { flex: 1, minWidth: 0, color: t.texto, paddingVertical: 0 },
        Platform.OS === "web" && ({ outlineStyle: "none" } as object),
        style,
      ]}
      {...props}
    />
  );
}

function FilaLimite({
  sf,
  ion,
  color,
  titulo,
  detalle,
  valor,
  onCambio,
}: {
  sf: ComponentProps<typeof Icono>["sf"];
  ion: ComponentProps<typeof Icono>["ion"];
  color: string;
  titulo: string;
  detalle?: string;
  valor: string;
  onCambio: (v: string) => void;
}) {
  const t = useTema();
  return (
    <View style={s.fila}>
      <IconoCelda sf={sf} ion={ion} fondo={color} />
      <View style={{ flex: 1 }}>
        <Text style={[tipo.cuerpo, { color: t.texto }]}>{titulo}</Text>
        {detalle ? <Text style={[tipo.leyenda, { color: t.textoSec }]}>{detalle}</Text> : null}
      </View>
      <Entrada
        placeholder="∞"
        value={valor}
        onChangeText={onCambio}
        keyboardType="number-pad"
        accessibilityLabel={`${titulo}, vacío es ilimitado`}
        style={[s.numero, { flex: 0, width: 90, color: t.texto }]}
      />
    </View>
  );
}

function FilaPrecio({
  titulo,
  valor,
  onCambio,
  placeholder,
  chip,
}: {
  titulo: string;
  valor: string;
  onCambio: (v: string) => void;
  placeholder: string;
  chip?: ReactNode;
}) {
  const t = useTema();
  return (
    <View style={s.fila}>
      <Text style={[tipo.cuerpo, { color: t.texto }]}>{titulo}</Text>
      {chip}
      <View style={s.monto}>
        <Text style={[s.numero, { color: valor.trim() ? t.texto : t.textoTer }]}>$</Text>
        <Entrada
          placeholder={placeholder}
          value={valor}
          onChangeText={onCambio}
          keyboardType="decimal-pad"
          accessibilityLabel={`Precio ${titulo.toLowerCase()} en dólares`}
          style={[s.numero, { flex: 0, minWidth: 40, maxWidth: 120 }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  previa: { gap: 12, marginBottom: 28 },
  previaPie: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  previaTitulo: { letterSpacing: 1.5, fontWeight: "600" },
  selector: { flexDirection: "row", borderRadius: 10, padding: 2, gap: 2 },
  opcion: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  numero: {
    fontSize: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  monto: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  codigoFijo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 15,
  },
});
