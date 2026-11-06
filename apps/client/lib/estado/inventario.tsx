import type {
  Categoria,
  CrearEmpleadoInput,
  Inventario,
  LineaFactura,
  Producto,
  ProductoInput,
  Rol,
} from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  categorias as categoriasApi,
  escucharInventario,
  escucharMisAccesos,
  inventarios as inventariosApi,
  miembros,
  productos as productosApi,
} from "@/api";
import { olvidarHuella } from "@/lib/huellas";
import { optimizarFoto } from "@/lib/optimizarFoto";
import { rutasDe } from "@/lib/fotos";
import { useRoles } from "@/lib/roles";
import { useSesion } from "./sesion";

/**
 * Inventarios, productos y categorías del usuario, con su caché (React Query) y
 * el realtime. Se reparte en dos contextos:
 *
 *   - datos: lo que se ve (cambia con cada producto o presencia).
 *   - acciones: lo que se hace (crear, editar, invitar…). Es estable: una
 *     pantalla que solo guarda un producto no se redibuja cuando otro cambia stock.
 *
 * No habla con el backend directamente: todo pasa por la carpeta api/.
 */

const SIN_PRODUCTOS: Producto[] = [];
const SIN_CATEGORIAS: Categoria[] = [];

function useEstadoInventario() {
  const qc = useQueryClient();
  const { usuario, activoId, enVivo, seleccionarInventario, olvidarActivo } = useSesion();
  const [presentes, setPresentes] = useState<Set<string>>(new Set());

  const uid = usuario?.id;
  const inventariosQ = useQuery({
    queryKey: ["inventarios", uid],
    enabled: !!uid,
    queryFn: inventariosApi.listar,
  });

  // La presencia llega por realtime; se mezcla aquí con lo que trae la base.
  const inventarios: Inventario[] = useMemo(
    () =>
      (inventariosQ.data ?? []).map((inv) => ({
        ...inv,
        miembros: inv.miembros.map((m) => ({
          ...m,
          en_linea: m.usuario_id === uid || presentes.has(m.usuario_id),
        })),
      })),
    [inventariosQ.data, presentes, uid],
  );

  const activo = inventarios.find((i) => i.id === activoId) ?? inventarios[0] ?? null;
  const miRol: Rol = activo?.miembros.find((m) => m.usuario_id === uid)?.rol ?? "lector";
  // Lo que puedo hacer en el inventario activo, según la tabla roles.
  const roles = useRoles();
  const p = roles.permisos(miRol);
  const permisos = useMemo(
    () => p,
    // roles.permisos devuelve un objeto nuevo en cada render: se compara por valor.
    [
      p.ver,
      p.ajustar_stock,
      p.editar_productos,
      p.gestionar_fotos,
      p.gestionar_accesos,
      p.eliminar_inventario,
    ],
  );

  const categoriasQ = useQuery({
    queryKey: ["categorias", activo?.id],
    enabled: !!activo,
    queryFn: () => categoriasApi.listar(activo!.id),
  });
  const refrescarCategorias = useCallback(
    (invId: string) => qc.invalidateQueries({ queryKey: ["categorias", invId] }),
    [qc],
  );

  const productosQ = useQuery({
    queryKey: ["productos", activo?.id],
    enabled: !!activo,
    queryFn: () => productosApi.listar(activo!.id),
  });

  const ponerProducto = useCallback(
    (prod: Producto) =>
      qc.setQueryData<Producto[]>(["productos", prod.inventario_id], (l) =>
        l
          ? l.some((x) => x.id === prod.id)
            ? l.map((x) => (x.id === prod.id ? prod : x))
            : [...l, prod]
          : [prod],
      ),
    [qc],
  );
  const sacarProducto = useCallback(
    (inventarioId: string, id: string) =>
      qc.setQueryData<Producto[]>(["productos", inventarioId], (l) =>
        l?.filter((x) => x.id !== id),
      ),
    [qc],
  );
  const refrescarInventarios = useCallback(() => {
    // Crear o borrar inventarios, productos o gente cambia lo que llevo usado del plan.
    void qc.invalidateQueries({ queryKey: ["miPlan"] });
    void qc.invalidateQueries({ queryKey: ["limites"] });
    void qc.invalidateQueries({ queryKey: ["historial"] });
    return qc.invalidateQueries({ queryKey: ["inventarios", uid] });
  }, [qc, uid]);

  // Cuando alguien me da acceso a un inventario, aparece sin tener que actualizar.
  useEffect(() => {
    if (!uid || !enVivo) return;
    return escucharMisAccesos(uid, () => void refrescarInventarios());
  }, [uid, enVivo, refrescarInventarios]);

  // Realtime del inventario activo.
  useEffect(() => {
    if (!activo || !uid || !enVivo) return;
    const invId = activo.id;
    const cortar = escucharInventario(invId, uid, {
      productoCreado: (prod) => {
        ponerProducto(prod);
        refrescarInventarios();
      },
      productoActualizado: ponerProducto,
      productoEliminado: (id) => {
        sacarProducto(invId, id);
        refrescarInventarios();
      },
      miembrosCambiaron: refrescarInventarios,
      categoriasCambiaron: () => void refrescarCategorias(invId),
      presentes: setPresentes,
    });
    return () => {
      cortar();
      setPresentes(new Set());
    };
  }, [
    activo?.id,
    uid,
    enVivo,
    ponerProducto,
    sacarProducto,
    refrescarInventarios,
    refrescarCategorias,
  ]);

  // Las URLs de todas las miniaturas del inventario, en un solo pedido: así las listas no
  // hacen una consulta por foto y las fotos aparecen juntas y rápido.
  useEffect(() => {
    const faltan = (productosQ.data ?? [])
      .map((x) => x.foto_path)
      .filter((r): r is string => !!r && !qc.getQueryData(["foto", r]));
    if (!faltan.length) return;
    let vigente = true;
    productosApi
      .urlsFotos(faltan)
      .then((urls) => {
        if (!vigente) return;
        for (const [ruta, url] of Object.entries(urls)) qc.setQueryData(["foto", ruta], url);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [productosQ.data, qc]);

  // Lo último que vieron las acciones: así pueden ser estables y no leer datos viejos.
  const vivo = useRef({ activo, productos: productosQ.data, usuario, uid, activoId });
  useEffect(() => {
    vivo.current = { activo, productos: productosQ.data, usuario, uid, activoId };
  });

  const refetchInventarios = inventariosQ.refetch;
  const refetchProductos = productosQ.refetch;
  const refetchCategorias = categoriasQ.refetch;

  const acciones = useMemo(() => {
    /**
     * Saca un inventario de la lista al instante (después de borrarlo o salir) y
     * después confirma con la base: no depende de que el refetch llegue a tiempo.
     */
    const sacarInventario = (invId: string) => {
      const { uid: id, activoId: actual } = vivo.current;
      qc.setQueryData<Inventario[]>(["inventarios", id], (l) => l?.filter((i) => i.id !== invId));
      qc.removeQueries({ queryKey: ["productos", invId] });
      if (actual === invId || !actual) olvidarActivo();
      void refrescarInventarios();
    };

    return {
      async crearInventario(nombre: string, lugar: string) {
        const id = await inventariosApi.crear(nombre, lugar);
        // Se agrega a la lista al instante (el trigger de la base me deja como owner)
        // y después se confirma con la base, sin depender de que el refetch llegue.
        const { usuario: yo, uid: miId } = vivo.current;
        if (yo) {
          const nuevo: Inventario = {
            id,
            nombre: nombre.trim(),
            lugar: lugar.trim(),
            creado_en: new Date().toISOString(),
            total_productos: 0,
            pendientes: [],
            miembros: [
              {
                usuario_id: yo.id,
                rol: "owner",
                nombre: yo.nombre,
                email: yo.email,
                en_linea: true,
              },
            ],
          };
          qc.setQueryData<Inventario[]>(["inventarios", miId], (l) =>
            l?.some((i) => i.id === id) ? l : [...(l ?? []), nuevo],
          );
        }
        seleccionarInventario(id);
        void refrescarInventarios();
      },

      /** Cambia el nombre y el lugar de un inventario (solo el owner). */
      async editarInventario(invId: string, nombre: string, lugar: string) {
        await inventariosApi.actualizar(invId, nombre, lugar);
        qc.setQueryData<Inventario[]>(["inventarios", vivo.current.uid], (l) =>
          l?.map((i) =>
            i.id === invId ? { ...i, nombre: nombre.trim(), lugar: lugar.trim() } : i,
          ),
        );
        void refrescarInventarios();
      },

      /** Crea o actualiza y devuelve el producto como quedó en la base. */
      async guardarProducto(productoId: string | null, input: ProductoInput): Promise<Producto> {
        if (productoId) {
          const guardado = await productosApi.actualizar(productoId, input);
          ponerProducto(guardado);
          return guardado;
        }
        const guardado = await productosApi.crear(vivo.current.activo!.id, input);
        ponerProducto(guardado);
        refrescarInventarios();
        return guardado;
      },

      /** Factura o Excel: carga todas las líneas juntas y devuelve cuántos se sumaron y cuántos son nuevos. */
      async cargarFactura(lineas: LineaFactura[]) {
        const { activo: inv } = vivo.current;
        if (!inv) throw new Error("No hay inventario abierto.");
        const cargados = await productosApi.cargarLote(inv.id, lineas);
        cargados.forEach((c) => ponerProducto(c.producto));
        refrescarInventarios();
        return {
          sumados: cargados.filter((c) => !c.nuevo).length,
          nuevos: cargados.filter((c) => c.nuevo).map((c) => c.producto),
        };
      },

      async eliminarProducto(productoId: string) {
        const { activo: inv, productos } = vivo.current;
        const producto = productos?.find((x) => x.id === productoId);
        await productosApi.eliminar({
          id: productoId,
          foto_path: producto?.foto_path ?? null,
          fotos_extra: producto?.fotos_extra ?? [],
        });
        if (inv) sacarProducto(inv.id, productoId);
        refrescarInventarios();
      },

      /** Foto principal del producto: base64 JPEG de la cámara. Devuelve el producto como quedó. */
      async subirFotoProducto(producto: Producto, base64: string): Promise<Producto> {
        const nuevo = await productosApi.subirFoto(producto, base64);
        ponerProducto(nuevo);
        // Misma ruta, foto nueva: se rehace solo su huella y se renueva la URL firmada.
        void olvidarHuella(producto.id, nuevo.foto_path ?? undefined);
        if (nuevo.foto_path) qc.invalidateQueries({ queryKey: ["foto", nuevo.foto_path] });
        return nuevo;
      },

      /** Otra foto del mismo producto (hasta 3 en total): el reconocimiento compara con todas. */
      async agregarFotoExtra(producto: Producto, base64: string): Promise<Producto> {
        const nuevo = await productosApi.agregarFotoExtra(producto, base64);
        ponerProducto(nuevo);
        return nuevo;
      },

      /** Quita una foto (principal o extra) y la deja de usar para reconocer. */
      async quitarFotoProducto(producto: Producto, ruta: string): Promise<Producto> {
        const nuevo = await productosApi.quitarFotoDe(producto, ruta);
        ponerProducto(nuevo);
        void olvidarHuella(producto.id, ruta);
        return nuevo;
      },

      /**
       * Achica las fotos pesadas del inventario, una por una, avisando el progreso. Una
       * que falle no frena las demás. Devuelve cuántas se optimizaron y cuántas fallaron.
       */
      async optimizarFotos(
        inventarioId: string,
        alAvanzar?: (hechas: number, total: number) => void,
      ) {
        const rutas = await productosApi.fotosPesadas(inventarioId);
        const optimizadas: string[] = [];
        let hechas = 0;
        let fallidas = 0;
        alAvanzar?.(0, rutas.length);
        for (const ruta of rutas) {
          try {
            await optimizarFoto(ruta);
            optimizadas.push(ruta);
            // Misma ruta, otro contenido: su huella se rehace la próxima vez que se abra la cámara.
            const dueno = vivo.current.productos?.find((x) => rutasDe(x).includes(ruta));
            if (dueno) void olvidarHuella(dueno.id, ruta);
          } catch {
            fallidas++;
          }
          alAvanzar?.(++hechas, rutas.length);
        }
        void qc.invalidateQueries({ queryKey: ["fotosPesadas", inventarioId] });
        // URL nueva (otro token) para cada foto: las miniaturas bajan la versión liviana.
        if (optimizadas.length) {
          const urls = await productosApi.urlsFotos(optimizadas).catch(() => ({}));
          for (const [ruta, url] of Object.entries(urls)) qc.setQueryData(["foto", ruta], url);
        }
        return { optimizadas: rutas.length - fallidas, fallidas };
      },

      /** Solo la cantidad (alcanza con el permiso ajustar_stock). */
      async ajustarStock(productoId: string, cantidad: number) {
        ponerProducto(await productosApi.ajustarStock(productoId, cantidad));
      },

      /** La cámara reconoció el producto y se corrigió (o confirmó) la cantidad. */
      async ajustarDesdeCamara(productoId: string, cantidad: number) {
        ponerProducto(await productosApi.ajustarDesdeCamara(productoId, cantidad));
      },

      /** El owner crea la cuenta de un empleado (contraseña temporal) y lo agrega a sus inventarios. */
      async agregarEmpleado(input: CrearEmpleadoInput) {
        const resultado = await miembros.agregarEmpleado(input);
        await refrescarInventarios();
        return resultado;
      },

      async cancelarInvitacion(invId: string, email: string) {
        await miembros.cancelarInvitacion(invId, email);
        await refrescarInventarios();
      },

      /** Crea una categoría (o subcategoría) en el inventario activo y la devuelve. */
      async crearCategoria(nombre: string, padreId: string | null): Promise<Categoria> {
        const { activo: inv } = vivo.current;
        if (!inv) throw new Error("No hay inventario abierto.");
        const nueva = await categoriasApi.crear(inv.id, nombre, padreId);
        qc.setQueryData<Categoria[]>(["categorias", inv.id], (l) =>
          l?.some((c) => c.id === nueva.id) ? l : [...(l ?? []), nueva],
        );
        void refrescarCategorias(inv.id);
        return nueva;
      },

      async renombrarCategoria(id: string, nombre: string) {
        const c = await categoriasApi.renombrar(id, nombre);
        qc.setQueryData<Categoria[]>(["categorias", c.inventario_id], (l) =>
          l?.map((x) => (x.id === c.id ? c : x)),
        );
        void refrescarCategorias(c.inventario_id);
      },

      /** Solo vacía: la base no deja borrar una categoría con productos o subcategorías. */
      async eliminarCategoria(id: string) {
        const { activo: inv } = vivo.current;
        if (!inv) return;
        await categoriasApi.eliminar(id);
        qc.setQueryData<Categoria[]>(["categorias", inv.id], (l) => l?.filter((c) => c.id !== id));
        void refrescarCategorias(inv.id);
      },

      async cambiarRol(invId: string, usuarioId: string, rol: Exclude<Rol, "owner">) {
        await miembros.cambiarRol(invId, usuarioId, rol);
        await refrescarInventarios();
      },

      async eliminarInventario(invId: string) {
        await inventariosApi.eliminar(invId);
        sacarInventario(invId);
      },

      /** Dejar un inventario ajeno (la base deja que cualquiera se quite a sí mismo). */
      async salirDeInventario(invId: string) {
        const { uid: miId } = vivo.current;
        if (!miId) return;
        await miembros.quitar(invId, miId);
        sacarInventario(invId);
      },

      async quitarMiembro(invId: string, usuarioId: string) {
        await miembros.quitar(invId, usuarioId);
        await refrescarInventarios();
      },

      async refrescar() {
        await Promise.all([refetchInventarios(), refetchProductos(), refetchCategorias()]);
      },
    };
  }, [
    qc,
    ponerProducto,
    sacarProducto,
    refrescarInventarios,
    refrescarCategorias,
    seleccionarInventario,
    olvidarActivo,
    refetchInventarios,
    refetchProductos,
    refetchCategorias,
  ]);

  /**
   * Productos que entraron con una factura y esperan categoría y foto. Solo se
   * le avisa a quien puede completarlos: a los demás les llega vacío.
   */
  const porRevisar = useMemo(
    () =>
      permisos.editar_productos && permisos.gestionar_fotos
        ? (productosQ.data ?? []).filter((x) => x.por_revisar)
        : SIN_PRODUCTOS,
    [productosQ.data, permisos],
  );

  const datos = useMemo(
    () => ({
      porRevisar,
      inventarios,
      activo,
      miRol,
      /** Permisos de mi rol en el inventario activo. */
      permisos,
      productosActivos: productosQ.data ?? SIN_PRODUCTOS,
      categoriasActivas: categoriasQ.data ?? SIN_CATEGORIAS,
      cargando:
        inventariosQ.isLoading || (!!activo && (productosQ.isLoading || categoriasQ.isLoading)),
      errorCarga: inventariosQ.error ?? productosQ.error ?? categoriasQ.error,
      refrescando: inventariosQ.isRefetching || productosQ.isRefetching,
    }),
    [
      porRevisar,
      inventarios,
      activo,
      miRol,
      permisos,
      productosQ.data,
      categoriasQ.data,
      inventariosQ.isLoading,
      productosQ.isLoading,
      categoriasQ.isLoading,
      inventariosQ.error,
      productosQ.error,
      categoriasQ.error,
      inventariosQ.isRefetching,
      productosQ.isRefetching,
    ],
  );

  return { datos, acciones };
}

type Estado = ReturnType<typeof useEstadoInventario>;
const ContextoDatos = createContext<Estado["datos"] | null>(null);
const ContextoAcciones = createContext<Estado["acciones"] | null>(null);

export function InventarioProvider({ children }: { children: React.ReactNode }) {
  const { datos, acciones } = useEstadoInventario();
  return (
    <ContextoAcciones.Provider value={acciones}>
      <ContextoDatos.Provider value={datos}>{children}</ContextoDatos.Provider>
    </ContextoAcciones.Provider>
  );
}

/** Lo que se ve: inventarios, productos, categorías, permisos. */
export function useInventario() {
  const valor = useContext(ContextoDatos);
  if (!valor) throw new Error("useInventario fuera de <InventarioProvider>");
  return valor;
}

/** Lo que se hace sobre el inventario. Estable: no redibuja al cambiar los datos. */
export function useAcciones() {
  const valor = useContext(ContextoAcciones);
  if (!valor) throw new Error("useAcciones fuera de <InventarioProvider>");
  return valor;
}
