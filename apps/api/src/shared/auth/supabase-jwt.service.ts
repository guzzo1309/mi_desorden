import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import type { Env } from "../config/env";
import type { UsuarioSesion } from "./usuario.decorator";

type ClaimsSupabase = JWTPayload & {
  email?: string;
  role?: string;
  aal?: string;
  session_id?: string;
};

/**
 * Verifica los access tokens que emite Supabase Auth, sin llamar a Supabase en
 * cada request: con las claves públicas del proyecto (JWKS, se cachean) o, en
 * proyectos legacy, con el JWT secret (HS256).
 */
@Injectable()
export class SupabaseJwtService {
  private readonly emisor: string;
  private readonly clave: Parameters<typeof jwtVerify>[1];
  private readonly algoritmos: string[];

  constructor(config: ConfigService<Env, true>) {
    const url = config.get("SUPABASE_URL", { infer: true });
    const secreto = config.get("SUPABASE_JWT_SECRET", { infer: true });

    this.emisor = `${url}/auth/v1`;
    if (secreto) {
      this.clave = new TextEncoder().encode(secreto);
      this.algoritmos = ["HS256"];
    } else {
      this.clave = createRemoteJWKSet(new URL(`${this.emisor}/.well-known/jwks.json`), {
        cacheMaxAge: 10 * 60_000,
        cooldownDuration: 30_000,
        timeoutDuration: 5_000,
      });
      this.algoritmos = ["ES256", "RS256"];
    }
  }

  /** Tira si el token no es válido, venció, es de otro proyecto o no es de un usuario logueado. */
  async verificar(token: string): Promise<UsuarioSesion> {
    const { payload } = await jwtVerify<ClaimsSupabase>(token, this.clave as never, {
      issuer: this.emisor,
      audience: "authenticated",
      algorithms: this.algoritmos,
      clockTolerance: 5,
      requiredClaims: ["sub", "exp"],
    });

    // La anon/publishable key también es un JWT válido del proyecto: no es una sesión.
    if (payload.role !== "authenticated") {
      throw new Error("El token no es de un usuario logueado");
    }

    return {
      id: payload.sub!,
      email: payload.email ?? null,
      aal: payload.aal ?? null,
      sesion_id: payload.session_id ?? null,
      expira_en: new Date(payload.exp! * 1000).toISOString(),
    };
  }
}
