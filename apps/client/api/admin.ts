import type {
  EventoUsuario, KpisPlataforma, MemoriaUsuario, PuntoDia, PuntoHora, UsoUsuario,
} from "@mi-desorden/core";
import { supabase } from "./supabase";

/** true solo si la RPC confirma que soy admin. Un error de red es false. */
export async function soyAdmin() {
  const { data, error } = await supabase.rpc("es_admin");
  if (error) return false;
  return Boolean(data);
}

export async function kpis(desde: string, hasta: string, usuario?: string) {
  const { data, error } = await supabase.rpc("kpis_plataforma", {
    p_desde: desde, p_hasta: hasta, p_usuario: usuario ?? null,
  });
  if (error) throw error;
  return data as KpisPlataforma;
}

export async function trafico(desde: string, hasta: string, usuario?: string) {
  const { data, error } = await supabase.rpc("trafico_por_hora", {
    p_desde: desde, p_hasta: hasta, p_usuario: usuario ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PuntoHora[];
}

export async function serieProductos(desde: string, hasta: string, usuario?: string) {
  const { data, error } = await supabase.rpc("serie_productos", {
    p_desde: desde, p_hasta: hasta, p_usuario: usuario ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PuntoDia[];
}

export async function usoPorUsuario(desde: string, hasta: string) {
  const { data, error } = await supabase.rpc("uso_por_usuario", {
    p_desde: desde, p_hasta: hasta,
  });
  if (error) throw error;
  return (data ?? []) as UsoUsuario[];
}

export async function memoria() {
  const { data, error } = await supabase.rpc("memoria_por_usuario");
  if (error) throw error;
  return (data ?? []) as MemoriaUsuario[];
}

export async function eventosDe(usuario: string, desde: string, hasta: string) {
  const { data, error } = await supabase.rpc("eventos_usuario", {
    p_usuario: usuario, p_desde: desde, p_hasta: hasta, p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []) as EventoUsuario[];
}

export async function liberarFotos(usuario: string) {
  const { data, error } = await supabase.rpc("liberar_fotos", { p_usuario: usuario });
  if (error) throw error;
  return data as number;
}
