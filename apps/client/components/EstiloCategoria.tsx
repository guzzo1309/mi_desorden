import type { Categoria, FuenteCategoria } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { Image, Platform, View } from "react-native";
import { categorias as categoriasApi } from "@/api";
import { Icono } from "@/components/ui";
import { colorDe } from "@/lib/estiloCategoria";
import { iconoPorClave } from "@/lib/iconosCategoria";
import { useTema } from "@/lib/theme";

const FAMILIAS: Record<FuenteCategoria, string | undefined> = {
  redondeada: Platform.select({ ios: "ui-rounded", default: undefined }),
  serif: Platform.select({ ios: "ui-serif", android: "serif", default: "Georgia, serif" }),
  mono: Platform.select({
    ios: "ui-monospace",
    android: "monospace",
    default: "ui-monospace, Menlo, monospace",
  }),
  condensada: Platform.select({
    ios: "AvenirNextCondensed-DemiBold",
    android: "sans-serif-condensed",
    default: "'Arial Narrow', sans-serif-condensed, sans-serif",
  }),
};

/** La familia de letra para el título; undefined = la del sistema. */
export const familiaDe = (fuente: FuenteCategoria | null | undefined) =>
  fuente ? FAMILIAS[fuente] : undefined;

/** Estilo del título de una categoría (letra y color que eligió el owner). */
export function useEstiloTitulo(c: Pick<Categoria, "fuente" | "color">, colorBase?: string) {
  const t = useTema();
  return {
    color: c.color ? colorDe(c.color, t) : (colorBase ?? t.texto),
    fontFamily: familiaDe(c.fuente),
  };
}

/** URL firmada de una imagen del bucket "categorias". */
export function useUrlImagenCategoria(ruta: string | null | undefined) {
  return useQuery({
    queryKey: ["imagenCategoria", ruta],
    queryFn: () => categoriasApi.urlImagen(ruta!),
    enabled: !!ruta,
    staleTime: 12 * 60 * 60_000, // la URL firmada dura 24 h
    gcTime: 24 * 60 * 60_000,
  }).data;
}

/**
 * El ícono de una categoría: su imagen si el owner le puso una; si no, el ícono que
 * eligió, y si tampoco, la carpeta (abierta o cerrada). En el color del título.
 */
export function IconoCategoria({
  categoria,
  abierta,
  tam,
  colorBase,
  uriLocal,
}: {
  categoria: Pick<Categoria, "imagen_path" | "color" | "icono">;
  abierta?: boolean;
  tam: number;
  /** Color de la carpeta sin color elegido. */
  colorBase: string;
  /** Vista previa antes de guardar (null = sin imagen). */
  uriLocal?: string | null;
}) {
  const t = useTema();
  const previa = uriLocal !== undefined;
  const remota = useUrlImagenCategoria(previa ? null : categoria.imagen_path);
  const tieneImagen = previa ? !!uriLocal : !!categoria.imagen_path;
  const uri = previa ? uriLocal : remota;
  const lado = Math.round(tam * 1.5);
  if (tieneImagen) {
    return (
      <View
        style={{
          width: lado,
          height: lado,
          borderRadius: lado * 0.22,
          overflow: "hidden",
          backgroundColor: t.relleno,
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: lado, height: lado }} resizeMode="cover" />
        ) : null}
      </View>
    );
  }
  const elegido = iconoPorClave(categoria.icono);
  const color = categoria.color ? colorDe(categoria.color, t) : colorBase;
  if (elegido) {
    return <Icono sf={elegido.sf} ion={elegido.ion} size={tam} color={color} />;
  }
  return (
    <Icono
      sf={abierta ? "folder.fill" : "folder"}
      ion={abierta ? "folder-open" : "folder-outline"}
      size={tam}
      color={color}
    />
  );
}
