import { SetMetadata } from "@nestjs/common";

export const ES_PUBLICO = "es_publico";

/** Saca la ruta (o el controller) del guard de sesión. Úsalo solo a propósito. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
