import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { admin } from "@/api";
import { BotonPrincipal, CampoFila, Contenido, Grupo } from "@/components/ui";
import { leerLimite } from "@/lib/planes";
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

const aTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

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
  const [precio, setPrecio] = useState(aTexto(existente?.precio_mensual));
  const [activo, setActivo] = useState(existente?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limInv = leerLimite(maxInv);
  const limProd = leerLimite(maxProd);
  const limPers = leerLimite(maxPers);
  const precioTxt = precio.trim().replace(",", ".");
  const precioNum = precioTxt ? Number(precioTxt) : null;
  const precioValido = precioNum === null || (Number.isFinite(precioNum) && precioNum >= 0);
  const codigoFinal = existente ? existente.codigo : codigo || aCodigo(nombre);
  const valido =
    nombre.trim().length >= 2 &&
    /^[a-z0-9_]{2,30}$/.test(codigoFinal) &&
    limInv !== undefined &&
    limProd !== undefined &&
    limPers !== undefined &&
    precioValido &&
    !guardando;

  async function guardar() {
    if (!valido || limInv === undefined || limProd === undefined || limPers === undefined) return;
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
        precio_mensual: precioNum,
        activo,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "planes"] }),
        qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
      ]);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  const pie =
    limInv === undefined || limProd === undefined || limPers === undefined
      ? "Los límites son números enteros mayores que cero, o vacío para ilimitado."
      : !precioValido
        ? "El precio tiene que ser un número, por ejemplo 9,99."
        : "Dejá un límite vacío para que sea ilimitado.";

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Editar plan" : "Nuevo plan",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={[tipo.cuerpo, { color: t.tinte }]}>Cancelar</Text>
            </Pressable>
          ),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <Grupo titulo="Plan">
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
          <CampoFila
            etiqueta="Código"
            placeholder="pro"
            value={existente ? existente.codigo : codigo}
            editable={!existente}
            onChangeText={(v) => {
              setCodigo(v.toLowerCase());
              setCodigoEditado(true);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <CampoFila
            etiqueta="Descripción"
            placeholder="Opcional"
            value={descripcion}
            onChangeText={setDescripcion}
            maxLength={200}
          />
        </Grupo>

        <Grupo
          titulo="Límites"
          pie={pie}
          pieError={
            limInv === undefined || limProd === undefined || limPers === undefined || !precioValido
          }
        >
          <CampoFila
            etiqueta="Inventarios"
            placeholder="Ilimitado"
            value={maxInv}
            onChangeText={setMaxInv}
            keyboardType="number-pad"
          />
          <CampoFila
            etiqueta="Productos"
            placeholder="Ilimitado"
            value={maxProd}
            onChangeText={setMaxProd}
            keyboardType="number-pad"
          />
          <CampoFila
            etiqueta="Personas"
            placeholder="Ilimitado"
            value={maxPers}
            onChangeText={setMaxPers}
            keyboardType="number-pad"
          />
        </Grupo>

        <Grupo titulo="Precio" pie="Solo informativo: todavía no hay cobro.">
          <CampoFila
            etiqueta="Por mes"
            placeholder="Sin precio"
            value={precio}
            onChangeText={setPrecio}
            keyboardType="decimal-pad"
          />
        </Grupo>

        {existente ? (
          <Grupo
            pie={
              existente.codigo === "free"
                ? "Free es el plan de toda cuenta nueva: no se puede archivar."
                : "Un plan archivado no se puede asignar. Quienes lo tienen lo conservan."
            }
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 52,
                paddingHorizontal: 16,
              }}
            >
              <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>Activo</Text>
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

        <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
          {existente ? "Guardar cambios" : "Crear plan"}
        </BotonPrincipal>
      </Contenido>
    </>
  );
}
