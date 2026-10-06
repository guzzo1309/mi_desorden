import { createClient } from "@mi-desorden/core";
import { auth } from "./auth";
import { config } from "./config";

/** Cliente de la API de Nest. Manda el access token de Supabase en cada request. */
export const http = createClient(config.apiUrl, { token: auth.token });
