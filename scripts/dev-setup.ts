/**
 * Muestra a qué entorno le vas a pegar y frena si la config no sirve.
 * Lo corre `bun dev` antes de levantar todo; el entorno se elige con `doppler setup`.
 *
 * Uso: bun run dev:setup   (equivale a: doppler run -- bun scripts/dev-setup.ts)
 */
import { ambienteDe, resolverApiUrl } from "../apps/client/api/permitidas";

const env = process.env;
const verde = (s: string) => `\x1b[32m${s}\x1b[0m`;
const rojo = (s: string) => `\x1b[31m${s}\x1b[0m`;
const gris = (s: string) => `\x1b[90m${s}\x1b[0m`;
const negrita = (s: string) => `\x1b[1m${s}\x1b[0m`;

const errores: string[] = [];

if (!env.DOPPLER_CONFIG) {
  console.error(rojo("✖ No hay config de Doppler para este directorio."));
  console.error("  Corré: doppler setup   (proyecto mi_desroden, y elegí el entorno)");
  process.exit(1);
}

const ambiente = ambienteDe(env.EXPO_PUBLIC_APP_ENV);
let apiUrl = "";
try {
  apiUrl = resolverApiUrl(ambiente, env.EXPO_PUBLIC_API_URL);
} catch (e) {
  errores.push((e as Error).message);
}

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL ?? "";
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl.replace(/\/$/, ""))) {
  // Sin imprimir el valor: si es la cadena de Postgres, trae la contraseña.
  errores.push("EXPO_PUBLIC_SUPABASE_URL falta o no es la URL https del proyecto");
}
if (!env.EXPO_PUBLIC_SUPABASE_KEY) errores.push("Falta EXPO_PUBLIC_SUPABASE_KEY");

const apiLocal = apiUrl.startsWith("http://");

console.log();
console.log(negrita("  mi_desorden · entorno"));
console.log(
  `  Doppler    ${env.DOPPLER_PROJECT} / ${negrita(env.DOPPLER_CONFIG)} ${gris(`(${env.DOPPLER_ENVIRONMENT})`)}`,
);
console.log(`  App        ${ambiente}`);
console.log(
  `  API        ${apiUrl || rojo("no permitida")} ${apiUrl ? gris(apiLocal ? "← la de tu máquina (bun dev la levanta)" : "← desplegada") : ""}`,
);
console.log(`  Supabase   ${supabaseUrl.startsWith("https://") ? supabaseUrl : rojo("inválida")}`);
console.log(gris("  Para cambiar de entorno: doppler setup"));
console.log();

if (errores.length) {
  for (const e of errores) console.error(rojo(`  ✖ ${e}`));
  console.error();
  process.exit(1);
}
console.log(verde("  ✔ Listo") + "\n");
