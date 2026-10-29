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

/** Dónde se hizo el último clic: los menús se abren al lado de lo que se tocó. */
let ultimoClic: { x: number; y: number; t: number } | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => (ultimoClic = { x: e.clientX, y: e.clientY, t: Date.now() }),
    true,
  );
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
 * Menú de acciones (el "•••", el selector de inventario): una lista que se
 * despliega al lado de donde se hizo clic. Se cierra al elegir, al hacer clic
 * afuera o con Escape. Si no se sabe dónde fue el clic, va centrado.
 */
export function menuWeb(titulo: string, opciones: OpcionWeb[]) {
  const clic = ultimoClic && Date.now() - ultimoClic.t < 1500 ? ultimoClic : null;
  if (!clic) return abrirHoja(titulo, undefined, opciones);

  const c = colores();
  const acciones = opciones.filter((o) => !o.cancelar);

  const capa = document.createElement("div");
  Object.assign(capa.style, { position: "fixed", inset: "0", zIndex: "99999" });

  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", titulo);
  Object.assign(menu.style, {
    position: "fixed",
    minWidth: "220px",
    maxWidth: "300px",
    padding: "6px",
    backgroundColor: c.fondo,
    borderRadius: "12px",
    border: `0.5px solid ${c.separador}`,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.22)",
    fontFamily: FUENTE,
    opacity: "0",
    transform: "scale(0.97)",
    transformOrigin: "top left",
    transition: "opacity 100ms ease-out, transform 100ms ease-out",
  });

  const cabecera = document.createElement("div");
  cabecera.textContent = titulo;
  Object.assign(cabecera.style, {
    padding: "6px 10px 8px",
    color: c.textoSec,
    fontSize: "12px",
    fontWeight: "600",
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
      Object.assign(raya.style, { height: "0.5px", background: c.separador, margin: "4px 6px" });
      menu.appendChild(raya);
    }
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.textContent = o.texto;
    b.disabled = !!o.deshabilitada;
    Object.assign(b.style, {
      display: "block",
      width: "100%",
      padding: "9px 10px",
      border: "none",
      borderRadius: "8px",
      background: "transparent",
      color: o.deshabilitada ? c.textoSec : o.destructiva ? c.rojo : c.texto,
      fontFamily: FUENTE,
      fontSize: "15px",
      textAlign: "left",
      cursor: o.deshabilitada ? "default" : "pointer",
      outline: "none",
    });
    if (!o.deshabilitada) {
      const marcar = (si: boolean) => (b.style.backgroundColor = si ? c.hover : "transparent");
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

  // Al lado del clic, sin salirse de la ventana (si no entra a la derecha, se abre a la izquierda).
  const { width, height } = menu.getBoundingClientRect();
  const margen = 8;
  let x = clic.x + 4;
  let y = clic.y + 4;
  if (x + width > window.innerWidth - margen) x = Math.max(margen, clic.x - width - 4);
  if (y + height > window.innerHeight - margen)
    y = Math.max(margen, window.innerHeight - height - margen);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.transformOrigin = `${x < clic.x ? "right" : "left"} top`;

  requestAnimationFrame(() => {
    menu.style.opacity = "1";
    menu.style.transform = "scale(1)";
  });
}

/** Confirmación: un botón en rojo con la acción y Cancelar. */
export function confirmarWeb(titulo: string, mensaje: string, accion: string, onSi: () => void) {
  abrirHoja(titulo, mensaje, [{ texto: accion, destructiva: true, onPress: onSi }]);
}

/** Un aviso con un solo botón. */
export function avisoWeb(titulo: string, mensaje: string) {
  abrirHoja(titulo, mensaje, [{ texto: "OK", cancelar: true }]);
}
