/**
 * Diálogos de la web. En iOS y Android se usa Alert.alert; en el navegador
 * Alert no muestra botones, así que acá se arma una hoja propia con el DOM,
 * con los mismos colores de la app (claro u oscuro según el sistema).
 * Solo se llaman con Platform.OS === "web".
 */

export interface OpcionWeb {
  texto: string;
  onPress?: () => void;
  /** En rojo (eliminar, salir). */
  destructiva?: boolean;
  /** Se ve gris y no se puede tocar. */
  deshabilitada?: boolean;
  /** El botón de cerrar; va separado, abajo. */
  cancelar?: boolean;
  /** Ícono a la derecha, con el mismo nombre SF que en iOS (ver ICONOS). */
  icono?: string;
}

const CLARO = {
  fondo: "#FFFFFF",
  separador: "rgba(60, 60, 67, 0.18)",
  texto: "#1C1C1E",
  textoSec: "#8E8E93",
  tinte: "#FF9500",
  rojo: "#FF3B30",
  hover: "#F2F2F7",
};
const OSCURO = {
  fondo: "#2C2C2E",
  separador: "rgba(84, 84, 88, 0.6)",
  texto: "#FFFFFF",
  textoSec: "#98989F",
  tinte: "#FF9F0A",
  rojo: "#FF453A",
  hover: "#3A3A3C",
};

const colores = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? OSCURO : CLARO;

/** El último clic y lo que se tocó: los menús se abren pegados a ese botón. */
let ultimoClic: { x: number; y: number; t: number; caja: DOMRect | null } | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, [role="button"], [tabindex]');
      ultimoClic = {
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
        caja: el ? el.getBoundingClientRect() : null,
      };
    },
    true,
  );
}

/** Íconos de línea (24×24) para los menús, por nombre SF. */
const ICONOS: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  "plus.circle": "M12 8v8M8 12h8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  "folder.badge.plus":
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v5M9.5 13.5h5",
  pencil: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  "trash.fill": "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  "clock.arrow.circlepath": "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2",
  shippingbox: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "arrow.up.arrow.down": "M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
  plusminus: "M12 4v8M8 8h8M8 18h8",
  "rectangle.portrait.and.arrow.right":
    "M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8M11 12h10M17 8l4 4-4 4",
  "doc.text.viewfinder":
    "M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2M8 9h8M8 13h8M8 17h5",
  "crown.fill": "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
};

function svgIcono(nombre: string, color: string): SVGSVGElement | null {
  const d = ICONOS[nombre];
  if (!d) return null;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  for (const [k, v] of Object.entries({
    fill: "none",
    stroke: color,
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }))
    path.setAttribute(k, v);
  svg.appendChild(path);
  svg.style.flexShrink = "0";
  return svg;
}

/** "#FF9500" → "rgba(255,149,0,a)" para los fondos suaves. */
function conAlfa(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const FUENTE =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Abre una hoja centrada con título, mensaje opcional y una lista de botones.
 * Se cierra al tocar un botón, al tocar afuera o con Escape.
 */
function abrirHoja(titulo: string, mensaje: string | undefined, opciones: OpcionWeb[]) {
  const c = colores();
  const acciones = opciones.filter((o) => !o.cancelar);
  const cancelar = opciones.find((o) => o.cancelar) ?? { texto: "Cancelar", cancelar: true };

  const fondo = document.createElement("div");
  Object.assign(fondo.style, {
    position: "fixed",
    inset: "0",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: "99999",
    opacity: "0",
    transition: "opacity 120ms ease-out",
    fontFamily: FUENTE,
  });

  const hoja = document.createElement("div");
  hoja.setAttribute("role", "dialog");
  hoja.setAttribute("aria-modal", "true");
  hoja.setAttribute("aria-label", titulo);
  Object.assign(hoja.style, {
    width: "100%",
    maxWidth: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    transform: "scale(0.96)",
    transition: "transform 120ms ease-out",
  });

  const caja = (): HTMLDivElement => {
    const d = document.createElement("div");
    Object.assign(d.style, {
      backgroundColor: c.fondo,
      borderRadius: "14px",
      overflow: "hidden",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.25)",
    });
    return d;
  };

  function cerrar(despues?: () => void) {
    document.removeEventListener("keydown", alTeclado);
    fondo.remove();
    despues?.();
  }
  function alTeclado(e: KeyboardEvent) {
    if (e.key === "Escape") cerrar(cancelar.onPress);
  }

  function boton(o: OpcionWeb, primero: boolean): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.texto;
    b.disabled = !!o.deshabilitada;
    Object.assign(b.style, {
      display: "block",
      width: "100%",
      padding: "14px 16px",
      border: "none",
      borderTop: primero ? "none" : `0.5px solid ${c.separador}`,
      background: "transparent",
      color: o.deshabilitada ? c.textoSec : o.destructiva ? c.rojo : c.tinte,
      fontFamily: FUENTE,
      fontSize: "17px",
      fontWeight: o.cancelar ? "600" : "400",
      textAlign: "center",
      cursor: o.deshabilitada ? "default" : "pointer",
      outline: "none",
    });
    if (!o.deshabilitada) {
      b.onmouseenter = () => (b.style.backgroundColor = c.hover);
      b.onmouseleave = () => (b.style.backgroundColor = "transparent");
      b.onfocus = () => (b.style.backgroundColor = c.hover);
      b.onblur = () => (b.style.backgroundColor = "transparent");
      b.onclick = () => cerrar(o.onPress);
    }
    return b;
  }

  const principal = caja();
  const cabecera = document.createElement("div");
  Object.assign(cabecera.style, { padding: "16px 16px 14px", textAlign: "center" });
  const h = document.createElement("div");
  h.textContent = titulo;
  Object.assign(h.style, {
    color: mensaje ? c.texto : c.textoSec,
    fontSize: mensaje ? "17px" : "13px",
    fontWeight: "600",
  });
  cabecera.appendChild(h);
  if (mensaje) {
    const p = document.createElement("div");
    p.textContent = mensaje;
    Object.assign(p.style, {
      color: c.textoSec,
      fontSize: "13px",
      marginTop: "4px",
      lineHeight: "1.35",
      whiteSpace: "pre-line",
    });
    cabecera.appendChild(p);
  }
  principal.appendChild(cabecera);
  acciones.forEach((o) => principal.appendChild(boton(o, false)));
  hoja.appendChild(principal);

  const abajo = caja();
  abajo.appendChild(boton(cancelar, true));
  hoja.appendChild(abajo);

  fondo.appendChild(hoja);
  fondo.addEventListener("click", (e) => {
    if (e.target === fondo) cerrar(cancelar.onPress);
  });
  document.addEventListener("keydown", alTeclado);
  document.body.appendChild(fondo);

  requestAnimationFrame(() => {
    fondo.style.opacity = "1";
    hoja.style.transform = "scale(1)";
  });
  hoja.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
}

/**
 * Menú de acciones (el "•••", el selector de inventario): una tarjeta que se
 * despliega debajo del botón tocado, con una flechita que lo señala. Cada
 * opción lleva el texto a la izquierda y el ícono a la derecha, en el naranja
 * de la app (rojo si es destructiva). Se cierra al elegir, al hacer clic afuera
 * o con Escape; también se usa con las flechas del teclado.
 */
export function menuWeb(titulo: string, opciones: OpcionWeb[]) {
  const clic = ultimoClic && Date.now() - ultimoClic.t < 1500 ? ultimoClic : null;
  if (!clic) return abrirHoja(titulo, undefined, opciones);

  const c = colores();
  const acciones = opciones.filter((o) => !o.cancelar);
  const FLECHA = 8;

  const capa = document.createElement("div");
  Object.assign(capa.style, { position: "fixed", inset: "0", zIndex: "99999" });

  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", titulo);
  Object.assign(menu.style, {
    position: "fixed",
    minWidth: "240px",
    maxWidth: "320px",
    padding: "8px 0",
    backgroundColor: c.fondo,
    borderRadius: "16px",
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.06)",
    fontFamily: FUENTE,
    opacity: "0",
    transform: "translateY(-4px)",
    transition: "opacity 120ms ease-out, transform 120ms ease-out",
  });

  // La flechita: un cuadrado girado, del mismo color que la tarjeta.
  const flecha = document.createElement("div");
  Object.assign(flecha.style, {
    position: "absolute",
    width: `${FLECHA * 2}px`,
    height: `${FLECHA * 2}px`,
    backgroundColor: c.fondo,
    transform: "rotate(45deg)",
    borderRadius: "3px",
    boxShadow: "-2px -2px 4px rgba(0, 0, 0, 0.04)",
  });
  menu.appendChild(flecha);

  const cabecera = document.createElement("div");
  cabecera.textContent = titulo;
  Object.assign(cabecera.style, {
    position: "relative",
    padding: "6px 20px 10px",
    color: c.textoSec,
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.3px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });
  menu.appendChild(cabecera);

  function cerrar(despues?: () => void) {
    document.removeEventListener("keydown", alTeclado);
    capa.remove();
    despues?.();
  }
  function alTeclado(e: KeyboardEvent) {
    const botones = [...menu.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    const i = botones.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") return cerrar();
    const paso = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!paso || !botones.length) return;
    e.preventDefault();
    botones[(i + paso + botones.length) % botones.length]?.focus();
  }

  acciones.forEach((o, i) => {
    // Raya antes de lo destructivo (eliminar, salir), como en el menú de iOS.
    if (o.destructiva && i > 0) {
      const raya = document.createElement("div");
      Object.assign(raya.style, { height: "0.5px", background: c.separador, margin: "6px 20px" });
      menu.appendChild(raya);
    }
    const color = o.deshabilitada ? c.textoSec : o.destructiva ? c.rojo : c.tinte;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.disabled = !!o.deshabilitada;
    Object.assign(b.style, {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "24px",
      width: "100%",
      padding: "13px 20px",
      border: "none",
      borderLeft: "3px solid transparent",
      background: "transparent",
      color,
      fontFamily: FUENTE,
      fontSize: "16px",
      fontWeight: "500",
      textAlign: "left",
      cursor: o.deshabilitada ? "default" : "pointer",
      outline: "none",
      transition: "background-color 80ms, border-color 80ms",
    });
    const texto = document.createElement("span");
    texto.textContent = o.texto;
    b.appendChild(texto);
    const icono = o.icono ? svgIcono(o.icono, color) : null;
    if (icono) b.appendChild(icono);

    if (!o.deshabilitada) {
      const base = o.destructiva ? c.rojo : c.tinte;
      const marcar = (si: boolean) => {
        b.style.backgroundColor = si ? conAlfa(base, 0.08) : "transparent";
        b.style.borderLeftColor = si ? base : "transparent";
      };
      b.onmouseenter = () => marcar(true);
      b.onmouseleave = () => marcar(false);
      b.onfocus = () => marcar(true);
      b.onblur = () => marcar(false);
      b.onclick = () => cerrar(o.onPress);
    }
    menu.appendChild(b);
  });

  capa.appendChild(menu);
  capa.addEventListener("pointerdown", (e) => {
    if (e.target === capa) cerrar();
  });
  document.addEventListener("keydown", alTeclado);
  document.body.appendChild(capa);

  // Debajo del botón y sin salirse de la ventana.
  // Si no entra abajo, va arriba (y la flecha pasa al borde de abajo).
  const ancla = clic.caja ?? new DOMRect(clic.x, clic.y, 0, 0);
  const { width, height } = menu.getBoundingClientRect();
  const margen = 8;
  const centroAncla = ancla.left + ancla.width / 2;
  // Si el botón está a la izquierda, el menú se alinea a su borde izquierdo; si no, al derecho.
  let x =
    centroAncla < window.innerWidth / 2
      ? ancla.left - 12
      : Math.min(ancla.right + 12, window.innerWidth - margen) - width;
  x = Math.min(x, window.innerWidth - margen - width);
  x = Math.max(margen, x);
  const abajo = ancla.bottom + FLECHA + 6 + height <= window.innerHeight - margen;
  const y = abajo ? ancla.bottom + FLECHA + 6 : Math.max(margen, ancla.top - FLECHA - 6 - height);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  const fx = Math.min(Math.max(centroAncla - x - FLECHA, 16), width - 16 - FLECHA * 2);
  flecha.style.left = `${fx}px`;
  flecha.style[abajo ? "top" : "bottom"] = `${-FLECHA + 1}px`;
  if (!abajo) {
    flecha.style.boxShadow = "2px 2px 4px rgba(0, 0, 0, 0.04)";
    menu.style.transform = "translateY(4px)";
  }

  requestAnimationFrame(() => {
    menu.style.opacity = "1";
    menu.style.transform = "translateY(0)";
  });
  menu.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
}

/** Confirmación: un botón en rojo con la acción y Cancelar. */
export function confirmarWeb(titulo: string, mensaje: string, accion: string, onSi: () => void) {
  abrirHoja(titulo, mensaje, [{ texto: accion, destructiva: true, onPress: onSi }]);
}

/** Un aviso con un solo botón. */
export function avisoWeb(titulo: string, mensaje: string) {
  abrirHoja(titulo, mensaje, [{ texto: "OK", cancelar: true }]);
}
