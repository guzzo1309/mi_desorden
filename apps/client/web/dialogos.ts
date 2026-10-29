/**
 * Diálogos de la web. En iOS y Android se usa Alert.alert; en el navegador
 * Alert no muestra botones, así que acá van las versiones con window y el DOM.
 * Solo se llaman con Platform.OS === "web".
 */

export interface OpcionWeb {
  texto: string;
  onPress?: () => void;
  cancelar?: boolean;
}

/** Sí / no. */
export function confirmarWeb(titulo: string, mensaje: string): boolean {
  return window.confirm(`${titulo}\n\n${mensaje}`);
}

/** Un aviso con un solo botón. */
export function avisoWeb(titulo: string, mensaje: string) {
  window.alert(`${titulo}\n\n${mensaje}`);
}

/** Menú numerado con window.prompt (para los menús de acciones). */
export function menuPromptWeb(titulo: string, opciones: OpcionWeb[]) {
  const lista = opciones.map((o, i) => `${i + 1}. ${o.texto}`).join("\n");
  const seleccion = window.prompt(`${titulo}\n\nSelecciona una opción:\n${lista}`);
  if (!seleccion) return;
  opciones[parseInt(seleccion, 10) - 1]?.onPress?.();
}

/** Menú flotante con botones (selector de inventario). */
export function menuFlotanteWeb(titulo: string, opciones: OpcionWeb[]) {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "99999",
  });

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "20px",
    minWidth: "280px",
    maxWidth: "360px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontFamily: "sans-serif",
  });

  const h = document.createElement("h3");
  h.innerText = titulo;
  Object.assign(h.style, {
    margin: "0 0 10px 0",
    fontSize: "18px",
    textAlign: "center",
    color: "#1c1c1e",
  });
  modal.appendChild(h);

  for (const o of opciones) {
    const btn = document.createElement("button");
    btn.innerText = o.texto;
    Object.assign(btn.style, {
      padding: "12px 16px",
      border: "none",
      borderRadius: "10px",
      backgroundColor: o.cancelar ? "#f2f2f7" : "#f0f4ff",
      color: o.cancelar ? "#8e8e93" : "#007aff",
      fontWeight: "600",
      fontSize: "15px",
      cursor: "pointer",
      textAlign: "left",
    });
    btn.onclick = () => {
      document.body.removeChild(overlay);
      o.onPress?.();
    };
    modal.appendChild(btn);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
