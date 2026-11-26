import { useQuery } from "@tanstack/react-query";
import { Image, Text, View } from "react-native";
import { perfil } from "@/api";
import { iniciales } from "@/lib/fecha";
import { useTema, fuenteMarca } from "@/lib/theme";

/** Foto de perfil; sin foto (o mientras baja), las iniciales sobre el color de la marca. */
export function AvatarPerfil({
  nombre,
  ruta,
  tam = 56,
  fondo,
}: {
  nombre: string;
  ruta: string | null | undefined;
  tam?: number;
  /** Color detrás de las iniciales (por defecto, el de la marca, con su texto encima). */
  fondo?: string;
}) {
  const t = useTema();
  const { data: url } = useQuery({
    queryKey: ["avatar", ruta],
    queryFn: () => perfil.urlFoto(ruta!),
    enabled: !!ruta,
    staleTime: 12 * 60 * 60_000, // la URL firmada dura 24 h
    gcTime: 24 * 60 * 60_000,
  });
  return (
    <View
      style={{
        width: tam,
        height: tam,
        borderRadius: tam / 2,
        overflow: "hidden",
        backgroundColor: fondo ?? t.tinte,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: t.sobreTinte,
          fontSize: tam * 0.4,
          fontWeight: "600",
          fontFamily: fuenteMarca,
        }}
      >
        {iniciales(nombre)}
      </Text>
      {ruta && url ? (
        <Image
          source={{ uri: url }}
          style={{ position: "absolute", width: tam, height: tam }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}
