import type { Detection, DetectionInput, Paginado, UsuarioSesion } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientOptions {
  /** Devuelve el access token de la sesión (Supabase). Sin token, solo andan las rutas públicas. */
  token?: () => Promise<string | null | undefined> | string | null | undefined;
}

/** Cliente HTTP de la API. Lo usan el cliente Expo y los scripts. */
export function createClient(baseUrl: string, options: ClientOptions = {}) {
  const url = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await options.token?.();
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) throw new ApiError(`${init?.method ?? "GET"} ${path} → ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  return {
    me: () => request<UsuarioSesion>("/auth/me"),
    /** Mis detecciones; con inventarioId, solo las de ese inventario. */
    detections: (inventarioId?: string) =>
      request<Paginado<Detection>>(
        inventarioId
          ? `/detections?inventario_id=${encodeURIComponent(inventarioId)}`
          : "/detections",
      ),
    crearDeteccion: (input: DetectionInput) =>
      request<Detection>("/detections", { method: "POST", body: JSON.stringify(input) }),
    /** Correo a alguien que un owner o admin acaba de invitar (la invitación ya está hecha en Supabase). */
    avisarInvitacion: (email: string, inventarios: string[]) =>
      request<{ enviado: boolean; pendiente: boolean }>("/invitaciones/aviso", {
        method: "POST",
        body: JSON.stringify({ email, inventarios }),
      }),
  };
}

export type Client = ReturnType<typeof createClient>;
