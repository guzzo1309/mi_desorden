/**
 * HTML del correo de invitación y de la página puente que abre la app. Mismo
 * estilo que las plantillas de Supabase (supabase/templates).
 */

const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "A", "A y B", "A, B y C". */
export function enLista(nombres: string[]) {
  return nombres.length < 2
    ? (nombres[0] ?? "")
    : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

export interface DatosInvitacion {
  quien: string;
  inventarios: string[];
  /** Sin cuenta todavía: el correo le pide registrarse con esta dirección. */
  pendiente: boolean;
  email: string;
  enlace: string;
}

export function asuntoInvitacion({ quien, inventarios }: DatosInvitacion) {
  return inventarios.length === 1
    ? `${quien} te dio acceso a “${inventarios[0]}”`
    : `${quien} te dio acceso a ${inventarios.length} inventarios`;
}

export function textoInvitacion(d: DatosInvitacion) {
  const lista = enLista(d.inventarios.map((n) => `“${n}”`));
  return [
    `${d.quien} te dio acceso a ${lista} en mi_desorden.`,
    d.pendiente
      ? `Crea tu cuenta con este correo (${d.email}) y vas a verlo apenas confirmes.`
      : "Ya lo tienes en la app.",
    `Abrir: ${d.enlace}`,
  ].join("\n\n");
}

export function htmlInvitacion(d: DatosInvitacion) {
  const quien = escapar(d.quien);
  const lista = enLista(
    d.inventarios.map((n) => `<strong class="texto" style="color:#000000;">${escapar(n)}</strong>`),
  );
  const accion = d.pendiente ? "Crear mi cuenta" : "Abrir en la app";
  const detalle = d.pendiente
    ? `Crea tu cuenta con <strong class="texto" style="color:#000000;">${escapar(d.email)}</strong> y lo vas a ver apenas confirmes el correo.`
    : "Ya lo tienes en tu lista. Toca el botón para abrirlo.";
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapar(asuntoInvitacion(d))}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .fondo { background-color: #000000 !important; }
        .tarjeta { background-color: #1c1c1e !important; }
        .texto { color: #ffffff !important; }
        .suave { color: #98989f !important; }
      }
      @media (max-width: 480px) { .tarjeta { padding: 32px 24px !important; } }
    </style>
  </head>
  <body class="fondo" style="margin:0; padding:0; background-color:#f2f2f7; -webkit-font-smoothing:antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${quien} compartió su inventario con tú.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="fondo" style="background-color:#f2f2f7;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td align="center" valign="middle" width="64" height="64" style="width:64px; height:64px; background-color:#ff9500; border-radius:16px; font-size:32px; line-height:64px;">📦</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td class="tarjeta" style="background-color:#ffffff; border-radius:24px; padding:40px 36px; font-family:${FUENTE};">
                <h1 class="texto" style="margin:0 0 8px; font-size:26px; line-height:32px; font-weight:700; letter-spacing:-0.4px; color:#000000; text-align:center;">
                  ${quien} compartió su inventario
                </h1>
                <p class="suave" style="margin:0 0 12px; font-size:16px; line-height:24px; color:#6e6e73; text-align:center;">
                  Te dio acceso a ${lista} en <strong class="texto" style="color:#000000;">mi_desorden</strong>.
                </p>
                <p class="suave" style="margin:0 0 32px; font-size:15px; line-height:22px; color:#6e6e73; text-align:center;">${detalle}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
                  <td align="center" style="border-radius:999px; background-color:#ff9500;">
                    <a href="${escapar(d.enlace)}" target="_blank" style="display:inline-block; padding:15px 36px; font-size:17px; line-height:22px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:999px;">${accion}</a>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 0; font-family:${FUENTE};">
                <p class="suave" style="margin:0 0 6px; font-size:12px; line-height:18px; color:#8e8e93; text-align:center;">
                  Te llegó porque ${quien} escribió ${escapar(d.email)} al compartir. Si no esperabas esto, ignoralo.
                </p>
                <p class="suave" style="margin:0; font-size:12px; line-height:18px; color:#8e8e93; text-align:center;">mi_desorden · tu inventario, contado por la cámara</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Página que abre el enlace del correo. Los clientes de correo no siempre
 * abren esquemas propios (midesorden://), así que el botón del mail apunta aquí
 * (https) y esta página salta a la app.
 */
export function htmlAbrir(deepLink: string) {
  const enlace = escapar(deepLink);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta http-equiv="refresh" content="0; url=${enlace}" />
    <title>Abrir mi_desorden</title>
    <style>
      body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f2f2f7; font-family:${FUENTE}; color:#000; text-align:center; }
      main { padding:32px 24px; max-width:360px; }
      .icono { width:64px; height:64px; margin:0 auto 20px; border-radius:16px; background:#ff9500; font-size:32px; line-height:64px; }
      h1 { margin:0 0 8px; font-size:24px; letter-spacing:-0.4px; }
      p { margin:0 0 28px; color:#6e6e73; font-size:15px; line-height:22px; }
      a { display:inline-block; padding:15px 36px; border-radius:999px; background:#ff9500; color:#fff; font-size:17px; font-weight:600; text-decoration:none; }
      @media (prefers-color-scheme: dark) { body { background:#000; color:#fff; } p { color:#98989f; } }
    </style>
  </head>
  <body>
    <main>
      <div class="icono">📦</div>
      <h1>Abriendo mi_desorden…</h1>
      <p>Si no se abre sola, toca el botón. Necesitas tener la app instalada.</p>
      <a href="${enlace}">Abrir la app</a>
    </main>
  </body>
</html>`;
}
