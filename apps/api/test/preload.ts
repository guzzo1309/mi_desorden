import "reflect-metadata";
import { sesion } from "./sesion";

// Cada test igual sobrescribe ConfigService con lo que necesita; esto es solo
// para que el import de CoreModule no falle sin Doppler.
Object.assign(process.env, { NODE_ENV: "test", ...sesion.env });
