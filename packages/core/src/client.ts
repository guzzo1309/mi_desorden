import type {
  CrearEmpleadoInput,
  Detection,
  DetectionInput,
  Paginado,
  ResultadoEmpleado,
  UsuarioSesion,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** El mensaje que mandó la API, ya pensado para mostrarse (cuando lo hay). */
    readonly detalle?: string,
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
    if (!res.ok) {
      const cuerpo = (await res.json().catch(() => null)) as { message?: unknown } | null;
      const detalle = typeof cuerpo?.message === "string" ? cuerpo.message : undefined;
      throw new ApiError(`${init?.method ?? "GET"} ${path} → ${res.status}`, res.status, detalle);
    }
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
    /** El owner crea la cuenta de un empleado con una contraseña temporal y lo agrega a sus inventarios. */
    crearEmpleado: (input: CrearEmpleadoInput) =>
      request<ResultadoEmpleado>("/empleados", { method: "POST", body: JSON.stringify(input) }),
  };
}

export type Client = ReturnType<typeof createClient>;
