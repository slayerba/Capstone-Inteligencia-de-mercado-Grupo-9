"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  SelectorIdioma,
  tr,
  useIdioma,
} from "@/lib/i18n";
import { parsearArchivoProductos } from "@/lib/importar-productos";
import styles from "./dashboard.module.css";

type Perfil = {
  email?: string;
  empresaId?: string | null;
  rol?: string;
  estado?: string;
};

type Empresa = {
  id: string;
  nombre: string;
  estado?: string;
};

type Competidor = {
  id: string;
  nombre: string;
  tipo?: string;
  estado?: string;
};

type Producto = {
  id: string;
  nombre: string;
  categoria?: string;
  competidorId: string;
  precio?: number | null;
  estado?: string;
};

// Carga competidores y productos de UNA empresa.
// La usan tanto los usuarios normales (su propia empresa)
// como el superadmin (la empresa que elija en el selector).
async function obtenerDatosEmpresa(empresaId: string) {
  const competidoresQuery = query(
    collection(db, "competidores"),
    where("empresaId", "==", empresaId)
  );

  const competidoresSnap = await getDocs(competidoresQuery);

  const competidores: Competidor[] = competidoresSnap.docs.map(
    (documento) => ({
      id: documento.id,
      nombre: documento.data().nombre ?? documento.id,
      tipo: documento.data().tipo,
      estado: documento.data().estado,
    })
  );

  const listasProductos = await Promise.all(
    competidores.map(async (competidor) => {
      const productosQuery = query(
        collection(db, "productos"),
        where("competidorId", "==", competidor.id)
      );

      const productosSnap = await getDocs(productosQuery);

      return productosSnap.docs.map((documento) => ({
        id: documento.id,
        nombre: documento.data().nombre ?? documento.id,
        categoria: documento.data().categoria,
        competidorId: documento.data().competidorId,
        precio: documento.data().precio ?? null,
        estado: documento.data().estado,
      })) as Producto[];
    })
  );

  return { competidores, productos: listasProductos.flat() };
}

export default function DashboardPage() {
  const router = useRouter();
  const { idioma, cambiarIdioma } = useIdioma();
  const t = (es: string, en: string) =>
    tr(idioma, es, en);

  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("");
  const [competidores, setCompetidores] = useState<Competidor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [error, setError] = useState("");

  const [nombreCompetidor, setNombreCompetidor] = useState("");
  const [tipoCompetidor, setTipoCompetidor] = useState("empresa");
  const [guardandoCompetidor, setGuardandoCompetidor] = useState(false);
  const [mensajeCompetidor, setMensajeCompetidor] = useState("");

  const [nombreProducto, setNombreProducto] = useState("");
  const [categoriaProducto, setCategoriaProducto] = useState("");
  const [precioProducto, setPrecioProducto] = useState("");
  const [competidorProducto, setCompetidorProducto] = useState("");
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [mensajeProducto, setMensajeProducto] = useState("");

  const [importandoCsv, setImportandoCsv] = useState(false);
  const [mensajeCsv, setMensajeCsv] = useState("");

  const [seccionActiva, setSeccionActiva] = useState<
    "resumen" | "competidores" | "productos" | "importacion"
  >("resumen");

  const [busquedaCompetidor, setBusquedaCompetidor] = useState("");
  const [filtroEstadoCompetidor, setFiltroEstadoCompetidor] =
    useState("todos");
  const [paginaCompetidores, setPaginaCompetidores] = useState(1);

  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [filtroEstadoProducto, setFiltroEstadoProducto] =
    useState("todos");
  const [paginaProductos, setPaginaProductos] = useState(1);

  const REGISTROS_POR_PAGINA = 8;

  const [editandoCompetidorId, setEditandoCompetidorId] = useState("");
  const [nombreCompetidorEdicion, setNombreCompetidorEdicion] = useState("");
  const [tipoCompetidorEdicion, setTipoCompetidorEdicion] = useState("");
  const [accionCompetidorId, setAccionCompetidorId] = useState("");

  const [editandoProductoId, setEditandoProductoId] = useState("");
  const [nombreProductoEdicion, setNombreProductoEdicion] = useState("");
  const [categoriaProductoEdicion, setCategoriaProductoEdicion] = useState("");
  const [precioProductoEdicion, setPrecioProductoEdicion] = useState("");
  const [competidorProductoEdicion, setCompetidorProductoEdicion] = useState("");
  const [accionProductoId, setAccionProductoId] = useState("");

  const esSuperadmin = perfil?.rol === "superadmin";
  const puedeGestionarCompetidores =
    perfil?.rol === "admin" || esSuperadmin;
  const puedeGestionarProductos =
    perfil?.rol === "admin" || esSuperadmin;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUsuario(user);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        const datosPerfil = userSnap.data() as Perfil;
        const perfilEsSuperadmin = datosPerfil.rol === "superadmin";

        if (
          datosPerfil.estado !== "activo" ||
          !datosPerfil.rol ||
          (!perfilEsSuperadmin && !datosPerfil.empresaId)
        ) {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        setPerfil(datosPerfil);

        if (perfilEsSuperadmin) {
          // El superadmin ve todas las empresas de la plataforma
          // y elige cuál revisar.
          const empresasSnap = await getDocs(collection(db, "empresas"));

          const listaEmpresas: Empresa[] = empresasSnap.docs.map(
            (documento) => ({
              id: documento.id,
              nombre: documento.data().nombre ?? documento.id,
              estado: documento.data().estado,
            })
          );

          setEmpresas(listaEmpresas);

          if (listaEmpresas.length > 0) {
            const primera = listaEmpresas[0].id;
            setEmpresaSeleccionada(primera);
            const datos = await obtenerDatosEmpresa(primera);
            setCompetidores(datos.competidores);
            setProductos(datos.productos);
          }
        } else {
          const datos = await obtenerDatosEmpresa(
            datosPerfil.empresaId as string
          );
          setCompetidores(datos.competidores);
          setProductos(datos.productos);
        }
      } catch (err) {
        console.error(err);
        setError("No fue posible cargar los datos de la empresa.");
      } finally {
        setCargando(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function cambiarEmpresa(empresaId: string) {
    setEmpresaSeleccionada(empresaId);
    setCompetidorProducto("");
    setMensajeProducto("");
    setMensajeCsv("");
    setEditandoCompetidorId("");
    setEditandoProductoId("");
    setError("");
    setCargandoDatos(true);

    try {
      const datos = await obtenerDatosEmpresa(empresaId);
      setCompetidores(datos.competidores);
      setProductos(datos.productos);
    } catch (err) {
      console.error(err);
      setCompetidores([]);
      setProductos([]);
      setError("No fue posible cargar los datos de esta empresa.");
    } finally {
      setCargandoDatos(false);
    }
  }

  async function crearCompetidor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setMensajeCompetidor("");
    setError("");

    if (!puedeGestionarCompetidores) {
      setError(t(
        "Tu rol no tiene permiso para crear competidores.",
        "Your role does not have permission to create competitors."
      ));
      return;
    }

    const empresaDestino = esSuperadmin
      ? empresaSeleccionada
      : perfil?.empresaId ?? "";

    if (!empresaDestino) {
      setError(t(
        "No hay una empresa seleccionada para crear el competidor.",
        "There is no selected company for creating the competitor."
      ));
      return;
    }

    const nombre = nombreCompetidor.trim();
    const tipo = tipoCompetidor.trim() || "empresa";

    if (!nombre) {
      setError(t(
        "Debes ingresar el nombre del competidor.",
        "You must enter the competitor name."
      ));
      return;
    }

    setGuardandoCompetidor(true);

    try {
      const competidorRef = doc(collection(db, "competidores"));

      await setDoc(competidorRef, {
        id: competidorRef.id,
        nombre,
        tipo,
        empresaId: empresaDestino,
        estado: "activo",
        creado_en: serverTimestamp(),
      });

      const datosActualizados = await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(datosActualizados.competidores);
      setProductos(datosActualizados.productos);

      setNombreCompetidor("");
      setTipoCompetidor("empresa");
      setMensajeCompetidor(t(
        "Competidor agregado correctamente.",
        "Competitor added successfully."
      ));
    } catch (err) {
      console.error(err);
      setError(t(
        "No fue posible crear el competidor.",
        "The competitor could not be created."
      ));
    } finally {
      setGuardandoCompetidor(false);
    }
  }

  async function crearProducto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setMensajeProducto("");
    setError("");

    if (!puedeGestionarProductos) {
      setError(t(
        "Tu rol no tiene permiso para crear productos.",
        "Your role does not have permission to create products."
      ));
      return;
    }

    const nombre = nombreProducto.trim();
    const categoria = categoriaProducto.trim();
    const competidorId = competidorProducto;

    if (!nombre) {
      setError(t(
        "Debes ingresar el nombre del producto.",
        "You must enter the product name."
      ));
      return;
    }

    if (!categoria) {
      setError(t(
        "Debes ingresar la categoría del producto.",
        "You must enter the product category."
      ));
      return;
    }

    if (!competidorId) {
      setError(t(
        "Debes seleccionar un competidor.",
        "You must select a competitor."
      ));
      return;
    }

    const competidorValido = competidores.some(
      (competidor) => competidor.id === competidorId
    );

    if (!competidorValido) {
      setError(t(
        "El competidor seleccionado no pertenece a la empresa actual.",
        "The selected competitor does not belong to the current company."
      ));
      return;
    }

    let precio: number | null = null;

    if (precioProducto.trim() !== "") {
      precio = Number(precioProducto);

      if (!Number.isFinite(precio) || precio < 0) {
        setError(t(
          "El precio debe ser un número válido mayor o igual a 0.",
          "The price must be a valid number greater than or equal to 0."
        ));
        return;
      }
    }

    const empresaDestino = esSuperadmin
      ? empresaSeleccionada
      : perfil?.empresaId ?? "";

    if (!empresaDestino) {
      setError(t(
        "No hay una empresa seleccionada para crear el producto.",
        "There is no selected company for creating the product."
      ));
      return;
    }

    setGuardandoProducto(true);

    try {
      const competidorRef = doc(db, "competidores", competidorId);
      const competidorSnap = await getDoc(competidorRef);

      if (
        !competidorSnap.exists() ||
        competidorSnap.data().empresaId !== empresaDestino
      ) {
        setError(t(
          "El competidor no pertenece a la empresa seleccionada.",
          "The competitor does not belong to the selected company."
        ));
        return;
      }

      const productoRef = doc(collection(db, "productos"));

      await setDoc(productoRef, {
        id: productoRef.id,
        nombre,
        categoria,
        precio,
        competidorId,
        estado: "activo",
        creado_en: serverTimestamp(),
      });

      const datosActualizados = await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(datosActualizados.competidores);
      setProductos(datosActualizados.productos);

      setNombreProducto("");
      setCategoriaProducto("");
      setPrecioProducto("");
      setCompetidorProducto("");
      setMensajeProducto(t(
        "Producto agregado correctamente.",
        "Product added successfully."
      ));
    } catch (err) {
      console.error(err);
      setError(t(
        "No fue posible crear el producto.",
        "The product could not be created."
      ));
    } finally {
      setGuardandoProducto(false);
    }
  }

  function empresaDestinoActual() {
    return esSuperadmin
      ? empresaSeleccionada
      : perfil?.empresaId ?? "";
  }

  function iniciarEdicionCompetidor(
    competidor: Competidor
  ) {
    setError("");
    setMensajeCompetidor("");
    setEditandoProductoId("");

    setEditandoCompetidorId(competidor.id);
    setNombreCompetidorEdicion(competidor.nombre);
    setTipoCompetidorEdicion(
      competidor.tipo ?? "empresa"
    );
  }

  function cancelarEdicionCompetidor() {
    setEditandoCompetidorId("");
    setNombreCompetidorEdicion("");
    setTipoCompetidorEdicion("");
  }

  async function guardarEdicionCompetidor(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setError("");
    setMensajeCompetidor("");

    if (!puedeGestionarCompetidores) {
      setError(
        t(
          "Tu rol no tiene permiso para editar competidores.",
          "Your role does not have permission to edit competitors."
        )
      );
      return;
    }

    const empresaDestino = empresaDestinoActual();

    if (!empresaDestino || !editandoCompetidorId) {
      setError(
        t(
          "No hay un competidor válido para editar.",
          "There is no valid competitor to edit."
        )
      );
      return;
    }

    const nombre = nombreCompetidorEdicion.trim();
    const tipo =
      tipoCompetidorEdicion.trim() || "empresa";

    if (!nombre) {
      setError(
        t(
          "Debes ingresar el nombre del competidor.",
          "You must enter the competitor name."
        )
      );
      return;
    }

    setAccionCompetidorId(editandoCompetidorId);

    try {
      const competidorRef = doc(
        db,
        "competidores",
        editandoCompetidorId
      );

      const competidorSnap =
        await getDoc(competidorRef);

      if (
        !competidorSnap.exists() ||
        competidorSnap.data().empresaId !==
          empresaDestino
      ) {
        throw new Error(
          t(
            "El competidor no pertenece a la empresa actual.",
            "The competitor does not belong to the current company."
          )
        );
      }

      await setDoc(
        competidorRef,
        {
          nombre,
          tipo,
          actualizado_en: serverTimestamp(),
        },
        { merge: true }
      );

      const datosActualizados =
        await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(
        datosActualizados.competidores
      );

      setProductos(
        datosActualizados.productos
      );

      cancelarEdicionCompetidor();

      setMensajeCompetidor(
        t(
          "Competidor actualizado correctamente.",
          "Competitor updated successfully."
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t(
              "No fue posible actualizar el competidor.",
              "The competitor could not be updated."
            )
      );
    } finally {
      setAccionCompetidorId("");
    }
  }

  async function cambiarEstadoCompetidor(
    competidor: Competidor
  ) {
    setError("");
    setMensajeCompetidor("");

    if (!puedeGestionarCompetidores) {
      setError(
        t(
          "Tu rol no tiene permiso para cambiar el estado de competidores.",
          "Your role does not have permission to change competitor status."
        )
      );
      return;
    }

    const empresaDestino = empresaDestinoActual();

    if (!empresaDestino) {
      return;
    }

    const nuevoEstado =
      competidor.estado === "inactivo"
        ? "activo"
        : "inactivo";

    setAccionCompetidorId(competidor.id);

    try {
      const competidorRef = doc(
        db,
        "competidores",
        competidor.id
      );

      const competidorSnap =
        await getDoc(competidorRef);

      if (
        !competidorSnap.exists() ||
        competidorSnap.data().empresaId !==
          empresaDestino
      ) {
        throw new Error(
          t(
            "El competidor no pertenece a la empresa actual.",
            "The competitor does not belong to the current company."
          )
        );
      }

      await setDoc(
        competidorRef,
        {
          estado: nuevoEstado,
          actualizado_en: serverTimestamp(),
        },
        { merge: true }
      );

      const datosActualizados =
        await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(
        datosActualizados.competidores
      );

      setProductos(
        datosActualizados.productos
      );

      if (
        editandoCompetidorId === competidor.id
      ) {
        cancelarEdicionCompetidor();
      }

      setMensajeCompetidor(
        nuevoEstado === "activo"
          ? t(
              "Competidor reactivado correctamente.",
              "Competitor reactivated successfully."
            )
          : t(
              "Competidor desactivado correctamente.",
              "Competitor deactivated successfully."
            )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t(
              "No fue posible cambiar el estado del competidor.",
              "The competitor status could not be changed."
            )
      );
    } finally {
      setAccionCompetidorId("");
    }
  }

  function iniciarEdicionProducto(
    producto: Producto
  ) {
    setError("");
    setMensajeProducto("");
    setEditandoCompetidorId("");

    setEditandoProductoId(producto.id);
    setNombreProductoEdicion(producto.nombre);
    setCategoriaProductoEdicion(
      producto.categoria ?? ""
    );

    setPrecioProductoEdicion(
      producto.precio === null ||
        producto.precio === undefined
        ? ""
        : String(producto.precio)
    );

    setCompetidorProductoEdicion(
      producto.competidorId
    );
  }

  function cancelarEdicionProducto() {
    setEditandoProductoId("");
    setNombreProductoEdicion("");
    setCategoriaProductoEdicion("");
    setPrecioProductoEdicion("");
    setCompetidorProductoEdicion("");
  }

  async function guardarEdicionProducto(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setError("");
    setMensajeProducto("");

    if (!puedeGestionarProductos) {
      setError(
        t(
          "Tu rol no tiene permiso para editar productos.",
          "Your role does not have permission to edit products."
        )
      );
      return;
    }

    const empresaDestino = empresaDestinoActual();

    if (!empresaDestino || !editandoProductoId) {
      setError(
        t(
          "No hay un producto válido para editar.",
          "There is no valid product to edit."
        )
      );
      return;
    }

    const nombre = nombreProductoEdicion.trim();
    const categoria =
      categoriaProductoEdicion.trim();

    const competidorId =
      competidorProductoEdicion;

    if (!nombre || !categoria || !competidorId) {
      setError(
        t(
          "Nombre, categoría y competidor son obligatorios.",
          "Name, category and competitor are required."
        )
      );
      return;
    }

    let precio: number | null = null;

    if (precioProductoEdicion.trim() !== "") {
      precio = Number(precioProductoEdicion);

      if (!Number.isFinite(precio) || precio < 0) {
        setError(
          t(
            "El precio debe ser un número válido mayor o igual a 0.",
            "The price must be a valid number greater than or equal to 0."
          )
        );
        return;
      }
    }

    setAccionProductoId(editandoProductoId);

    try {
      const productoRef = doc(
        db,
        "productos",
        editandoProductoId
      );

      const productoSnap =
        await getDoc(productoRef);

      if (!productoSnap.exists()) {
        throw new Error(
          t(
            "El producto ya no existe.",
            "The product no longer exists."
          )
        );
      }

      const competidorActualId =
        productoSnap.data().competidorId;

      const [
        competidorActualSnap,
        competidorNuevoSnap,
      ] = await Promise.all([
        getDoc(
          doc(
            db,
            "competidores",
            competidorActualId
          )
        ),
        getDoc(
          doc(
            db,
            "competidores",
            competidorId
          )
        ),
      ]);

      if (
        !competidorActualSnap.exists() ||
        competidorActualSnap.data().empresaId !==
          empresaDestino ||
        !competidorNuevoSnap.exists() ||
        competidorNuevoSnap.data().empresaId !==
          empresaDestino
      ) {
        throw new Error(
          t(
            "El producto o el competidor seleccionado no pertenece a la empresa actual.",
            "The product or selected competitor does not belong to the current company."
          )
        );
      }

      await setDoc(
        productoRef,
        {
          nombre,
          categoria,
          precio,
          competidorId,
          actualizado_en: serverTimestamp(),
        },
        { merge: true }
      );

      const datosActualizados =
        await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(
        datosActualizados.competidores
      );

      setProductos(
        datosActualizados.productos
      );

      cancelarEdicionProducto();

      setMensajeProducto(
        t(
          "Producto actualizado correctamente.",
          "Product updated successfully."
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t(
              "No fue posible actualizar el producto.",
              "The product could not be updated."
            )
      );
    } finally {
      setAccionProductoId("");
    }
  }

  async function cambiarEstadoProducto(
    producto: Producto
  ) {
    setError("");
    setMensajeProducto("");

    if (!puedeGestionarProductos) {
      setError(
        t(
          "Tu rol no tiene permiso para cambiar el estado de productos.",
          "Your role does not have permission to change product status."
        )
      );
      return;
    }

    const empresaDestino = empresaDestinoActual();

    if (!empresaDestino) {
      return;
    }

    const nuevoEstado =
      producto.estado === "inactivo"
        ? "activo"
        : "inactivo";

    setAccionProductoId(producto.id);

    try {
      const productoRef = doc(
        db,
        "productos",
        producto.id
      );

      const productoSnap =
        await getDoc(productoRef);

      if (!productoSnap.exists()) {
        throw new Error(
          t(
            "El producto ya no existe.",
            "The product no longer exists."
          )
        );
      }

      const competidorId =
        productoSnap.data().competidorId;

      const competidorSnap = await getDoc(
        doc(
          db,
          "competidores",
          competidorId
        )
      );

      if (
        !competidorSnap.exists() ||
        competidorSnap.data().empresaId !==
          empresaDestino
      ) {
        throw new Error(
          t(
            "El producto no pertenece a la empresa actual.",
            "The product does not belong to the current company."
          )
        );
      }

      await setDoc(
        productoRef,
        {
          estado: nuevoEstado,
          actualizado_en: serverTimestamp(),
        },
        { merge: true }
      );

      const datosActualizados =
        await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(
        datosActualizados.competidores
      );

      setProductos(
        datosActualizados.productos
      );

      if (editandoProductoId === producto.id) {
        cancelarEdicionProducto();
      }

      setMensajeProducto(
        nuevoEstado === "activo"
          ? t(
              "Producto reactivado correctamente.",
              "Product reactivated successfully."
            )
          : t(
              "Producto desactivado correctamente.",
              "Product deactivated successfully."
            )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t(
              "No fue posible cambiar el estado del producto.",
              "The product status could not be changed."
            )
      );
    } finally {
      setAccionProductoId("");
    }
  }

  async function importarProductosArchivo(
    evento: ChangeEvent<HTMLInputElement>
  ) {
    const archivo = evento.target.files?.[0];

    if (!archivo) {
      return;
    }

    setError("");
    setMensajeCsv("");

    if (!puedeGestionarProductos) {
      setError(t(
        "Tu rol no tiene permiso para importar productos.",
        "Your role does not have permission to import products."
      ));
      evento.target.value = "";
      return;
    }

    const extension =
      archivo.name.split(".").pop()?.toLowerCase();

    if (
      !extension ||
      !["csv", "xlsx", "json"].includes(extension)
    ) {
      setError(
        t(
          "Formato no soportado. Usa CSV, XLSX o JSON.",
          "Unsupported format. Use CSV, XLSX or JSON."
        )
      );
      evento.target.value = "";
      return;
    }

    const empresaDestino = esSuperadmin
      ? empresaSeleccionada
      : perfil?.empresaId ?? "";

    if (!empresaDestino) {
      setError(
        "No hay una empresa seleccionada para realizar la importación."
      );
      evento.target.value = "";
      return;
    }

    setImportandoCsv(true);

    try {
      const filas =
        await parsearArchivoProductos(
          archivo,
          idioma
        );

      if (filas.length > 450) {
        throw new Error(
          "El MVP admite un máximo de 450 productos por archivo CSV."
        );
      }

      const competidoresPermitidos = new Set(
        competidores.map((competidor) => competidor.id)
      );

      const competidoresCsv = [
        ...new Set(filas.map((fila) => fila.competidorId)),
      ];

      for (const competidorId of competidoresCsv) {
        if (!competidoresPermitidos.has(competidorId)) {
          throw new Error(
            `El competidor ${competidorId} no pertenece a la empresa actual.`
          );
        }

        const competidorRef = doc(
          db,
          "competidores",
          competidorId
        );

        const competidorSnap = await getDoc(competidorRef);

        if (
          !competidorSnap.exists() ||
          competidorSnap.data().empresaId !== empresaDestino
        ) {
          throw new Error(
            `El competidor ${competidorId} no pertenece al tenant seleccionado.`
          );
        }
      }

      // Todas las filas se validan ANTES de escribir.
      // Se usa un único batch para que la carga del MVP sea atómica.
      const batch = writeBatch(db);

      filas.forEach((fila) => {
        const productoRef = doc(collection(db, "productos"));

        batch.set(productoRef, {
          id: productoRef.id,
          nombre: fila.nombre,
          categoria: fila.categoria,
          precio: fila.precio,
          competidorId: fila.competidorId,
          estado: fila.estado,
          creado_en: serverTimestamp(),
        });
      });

      await batch.commit();

      const datosActualizados =
        await obtenerDatosEmpresa(empresaDestino);

      setCompetidores(datosActualizados.competidores);
      setProductos(datosActualizados.productos);

      setMensajeCsv(
        `Carga batch completada: ${filas.length} producto${
          filas.length === 1 ? "" : "s"
        } importado${filas.length === 1 ? "" : "s"} correctamente.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? `No se pudo importar el CSV: ${err.message}`
          : "No se pudo importar el archivo CSV."
      );
    } finally {
      setImportandoCsv(false);
      evento.target.value = "";
    }
  }

  async function cerrarSesion() {
    await signOut(auth);
    router.replace("/login");
  }

  if (cargando) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
        Cargando Enci-Intel...
      </main>
    );
  }

  const competidoresActivos = competidores.filter(
    (competidor) => competidor.estado === "activo"
  ).length;

  const productosActivos = productos.filter(
    (producto) => producto.estado === "activo"
  ).length;

  const textoCompetidor = busquedaCompetidor.trim().toLowerCase();

  const competidoresFiltrados = competidores.filter((competidor) => {
    const coincideBusqueda =
      !textoCompetidor ||
      competidor.nombre.toLowerCase().includes(textoCompetidor) ||
      (competidor.tipo ?? "").toLowerCase().includes(textoCompetidor);

    const coincideEstado =
      filtroEstadoCompetidor === "todos" ||
      competidor.estado === filtroEstadoCompetidor;

    return coincideBusqueda && coincideEstado;
  });

  const totalPaginasCompetidores = Math.max(
    1,
    Math.ceil(competidoresFiltrados.length / REGISTROS_POR_PAGINA)
  );

  const paginaCompetidoresActual = Math.min(
    paginaCompetidores,
    totalPaginasCompetidores
  );

  const competidoresPagina = competidoresFiltrados.slice(
    (paginaCompetidoresActual - 1) * REGISTROS_POR_PAGINA,
    paginaCompetidoresActual * REGISTROS_POR_PAGINA
  );

  const textoProducto = busquedaProducto.trim().toLowerCase();

  const productosFiltrados = productos.filter((producto) => {
    const nombreCompetidor =
      competidores.find(
        (competidor) => competidor.id === producto.competidorId
      )?.nombre ?? "";

    const coincideBusqueda =
      !textoProducto ||
      producto.nombre.toLowerCase().includes(textoProducto) ||
      (producto.categoria ?? "").toLowerCase().includes(textoProducto) ||
      nombreCompetidor.toLowerCase().includes(textoProducto);

    const coincideEstado =
      filtroEstadoProducto === "todos" ||
      producto.estado === filtroEstadoProducto;

    return coincideBusqueda && coincideEstado;
  });

  const totalPaginasProductos = Math.max(
    1,
    Math.ceil(productosFiltrados.length / REGISTROS_POR_PAGINA)
  );

  const paginaProductosActual = Math.min(
    paginaProductos,
    totalPaginasProductos
  );

  const productosPagina = productosFiltrados.slice(
    (paginaProductosActual - 1) * REGISTROS_POR_PAGINA,
    paginaProductosActual * REGISTROS_POR_PAGINA
  );

  const tarjeta = {
    background: "#fff",
    padding: "24px",
    borderRadius: "14px",
    marginBottom: "24px",
  };

  return (
    <main
      className={styles.dashboardShell}
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        padding: "40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        className={styles.dashboardContainer}
        style={{ maxWidth: "1100px", margin: "0 auto" }}
      >
        <header
          className={styles.topbar}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Enci-Intel</h1>
            <p style={{ color: "#666" }}>
              {t(
                "Plataforma de inteligencia de mercado",
                "Market intelligence platform"
              )}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <SelectorIdioma
              idioma={idioma}
              onChange={cambiarIdioma}
            />

            <button
              onClick={cerrarSesion}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {t("Cerrar sesión", "Sign out")}
            </button>
          </div>
        </header>

        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarBrand}>
              <span>ENCI-INTEL</span>
            </div>

            <div className={styles.sidebarTitle}>
              {t("Navegación", "Navigation")}
            </div>

            <button
              type="button"
              className={
                seccionActiva === "resumen"
                  ? styles.navButtonActive
                  : styles.navButton
              }
              onClick={() => setSeccionActiva("resumen")}
            >
              {t("Resumen", "Overview")}
            </button>

            <button
              type="button"
              className={
                seccionActiva === "competidores"
                  ? styles.navButtonActive
                  : styles.navButton
              }
              onClick={() => setSeccionActiva("competidores")}
            >
              {t("Competidores", "Competitors")}
              <span className={styles.navCounter}>
                {competidores.length}
              </span>
            </button>

            <button
              type="button"
              className={
                seccionActiva === "productos"
                  ? styles.navButtonActive
                  : styles.navButton
              }
              onClick={() => setSeccionActiva("productos")}
            >
              {t("Productos", "Products")}
              <span className={styles.navCounter}>
                {productos.length}
              </span>
            </button>

            {puedeGestionarProductos && (
              <button
                type="button"
                className={
                  seccionActiva === "importacion"
                    ? styles.navButtonActive
                    : styles.navButton
                }
                onClick={() => setSeccionActiva("importacion")}
              >
                {t("Importación", "Import")}
              </button>
            )}

            <div className={styles.sidebarInfo}>
              <span>{t("Empresa actual", "Current company")}</span>
              <strong>
                {esSuperadmin
                  ? empresaSeleccionada ||
                    t("Sin seleccionar", "Not selected")
                  : perfil?.empresaId}
              </strong>

              <span>{t("Rol", "Role")}</span>
              <strong>{perfil?.rol}</strong>
            </div>
          </aside>

          <div className={styles.contentArea}>

            {error && (
              <section
                className={styles.errorCard}
                style={{
                  ...tarjeta,
                  background: "#fff3f3",
                }}
              >
                {error}
              </section>
            )}

            {seccionActiva === "resumen" && (
              <>

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              {t("Competidores", "Competitors")}
            </div>
            <div className={styles.metricValue}>
              {competidores.length}
            </div>
            <div className={styles.metricSubtext}>
              {t("Registrados en la empresa actual", "Registered in current company")}
            </div>
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              {t("Productos", "Products")}
            </div>
            <div className={styles.metricValue}>
              {productos.length}
            </div>
            <div className={styles.metricSubtext}>
              {t("Productos disponibles", "Available products")}
            </div>
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              {t("Competidores activos", "Active competitors")}
            </div>
            <div className={styles.metricValue}>
              {competidoresActivos}
            </div>
            <div className={styles.metricSubtext}>
              {t("Estado activo", "Active status")}
            </div>
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricLabel}>
              {t("Productos activos", "Active products")}
            </div>
            <div className={styles.metricValue}>
              {productosActivos}
            </div>
            <div className={styles.metricSubtext}>
              {t("Estado activo", "Active status")}
            </div>
          </article>
        </section>

        <section
          className={styles.sessionCard}
          style={tarjeta}
        >
          <h2>{t("Sesión activa", "Active session")}</h2>
          <p><strong>{t("Usuario", "User")}:</strong> {usuario?.email}</p>
          <p>
            <strong>{t("Empresa", "Company")}:</strong>{" "}
            {esSuperadmin ? t("Todas (superadmin)", "All (superadmin)") : perfil?.empresaId}
          </p>
          <p><strong>{t("Rol", "Role")}:</strong> {perfil?.rol}</p>
        </section>

        {esSuperadmin && (
          <section style={tarjeta}>
            <h2>{t("Empresas de la plataforma", "Platform companies")}</h2>

            {empresas.length === 0 ? (
              <p>{t(
                "No hay empresas registradas.",
                "No companies are registered."
              )}</p>
            ) : (
              <>
                {empresas.map((empresa) => (
                  <div
                    key={empresa.id}
                    style={{
                      borderTop: "1px solid #eee",
                      padding: "14px 0",
                    }}
                  >
                    <strong>{empresa.nombre}</strong>
                    <div>ID: {empresa.id}</div>
                    <div>Estado: {empresa.estado ?? "Sin definir"}</div>
                  </div>
                ))}

                <label
                  htmlFor="empresa"
                  style={{
                    display: "block",
                    marginTop: "16px",
                    marginBottom: "6px",
                  }}
                >
                  {t(
                    "Ver competidores y productos de:",
                    "View competitors and products for:"
                  )}
                </label>
                <select
                  id="empresa"
                  value={empresaSeleccionada}
                  onChange={(e) => cambiarEmpresa(e.target.value)}
                  disabled={cargandoDatos}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    minWidth: "240px",
                  }}
                >
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </>
            )}
          </section>
        )}

              </>
            )}

            {seccionActiva === "competidores" && (
        <section
          className={styles.sectionCard}
          style={tarjeta}
        >
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t("Gestión", "Management")}
              </span>
              <h2>
                    {t("Competidores", "Competitors")}
                {esSuperadmin && empresaSeleccionada
                  ? ` de ${empresaSeleccionada}`
                  : ""}
              </h2>
            </div>

            <span className={styles.sectionCount}>
              {competidores.length}{" "}
              {t("registros", "records")}
            </span>
          </div>

          {puedeGestionarCompetidores && (
            <details className={styles.managementPanel}>
              <summary className={styles.managementSummary}>
                {t("+ Nuevo competidor", "+ New competitor")}
              </summary>

            <form
              onSubmit={crearCompetidor}
              style={{
                padding: "18px",
                marginBottom: "22px",
                border: "1px solid #e5e5e5",
                borderRadius: "10px",
                background: "#fafafa",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {t("Agregar competidor", "Add competitor")}
              </h3>

              <p style={{ color: "#666" }}>
                {t("Empresa destino", "Target company")}:{" "}
                <strong>
                  {esSuperadmin ? empresaSeleccionada : perfil?.empresaId}
                </strong>
              </p>

              <label
                htmlFor="nombreCompetidor"
                style={{ display: "block", marginBottom: "6px" }}
              >
                {t("Nombre", "Name")}
              </label>

              <input
                id="nombreCompetidor"
                value={nombreCompetidor}
                onChange={(e) => setNombreCompetidor(e.target.value)}
                placeholder="Ej: Competidor XYZ"
                disabled={guardandoCompetidor}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />

              <label
                htmlFor="tipoCompetidor"
                style={{ display: "block", marginBottom: "6px" }}
              >
                {t("Tipo", "Type")}
              </label>

              <input
                id="tipoCompetidor"
                value={tipoCompetidor}
                onChange={(e) => setTipoCompetidor(e.target.value)}
                disabled={guardandoCompetidor}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />

              <button
                type="submit"
                disabled={guardandoCompetidor}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "8px",
                  background: "#111",
                  color: "#fff",
                  cursor: guardandoCompetidor ? "wait" : "pointer",
                  fontWeight: 600,
                }}
              >
                {guardandoCompetidor
                  ? t("Guardando...", "Saving...")
                  : t("Agregar competidor", "Add competitor")}
              </button>

              {mensajeCompetidor && (
                <p style={{ marginBottom: 0, color: "#176b35" }}>
                  {mensajeCompetidor}
                </p>
              )}
            </form>
            </details>
          )}

          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              value={busquedaCompetidor}
              onChange={(e) => {
                setBusquedaCompetidor(e.target.value);
                setPaginaCompetidores(1);
              }}
              placeholder={t(
                "Buscar competidor...",
                "Search competitor..."
              )}
            />

            <select
              className={styles.filterSelect}
              value={filtroEstadoCompetidor}
              onChange={(e) => {
                setFiltroEstadoCompetidor(e.target.value);
                setPaginaCompetidores(1);
              }}
            >
              <option value="todos">
                {t("Todos los estados", "All statuses")}
              </option>
              <option value="activo">
                {t("Activos", "Active")}
              </option>
              <option value="inactivo">
                {t("Inactivos", "Inactive")}
              </option>
            </select>
          </div>

          {cargandoDatos ? (
            <p className={styles.emptyState}>
              {t("Cargando...", "Loading...")}
            </p>
          ) : competidoresFiltrados.length === 0 ? (
            <p className={styles.emptyState}>
              {t(
                "No se encontraron competidores.",
                "No competitors were found."
              )}
            </p>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>{t("Nombre", "Name")}</th>
                      <th>{t("Tipo", "Type")}</th>
                      <th>{t("Estado", "Status")}</th>
                      {puedeGestionarCompetidores && (
                        <th>{t("Acciones", "Actions")}</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {competidoresPagina.map((competidor) =>
                      editandoCompetidorId === competidor.id ? (
                        <tr key={competidor.id}>
                          <td
                            colSpan={
                              puedeGestionarCompetidores ? 4 : 3
                            }
                          >
                            <form
                              className={styles.inlineEdit}
                              onSubmit={guardarEdicionCompetidor}
                            >
                              <div>
                                <label>{t("Nombre", "Name")}</label>
                                <input
                                  value={nombreCompetidorEdicion}
                                  onChange={(e) =>
                                    setNombreCompetidorEdicion(
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label>{t("Tipo", "Type")}</label>
                                <input
                                  value={tipoCompetidorEdicion}
                                  onChange={(e) =>
                                    setTipoCompetidorEdicion(
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div className={styles.inlineActions}>
                                <button
                                  className={styles.primaryButton}
                                  type="submit"
                                  disabled={
                                    accionCompetidorId === competidor.id
                                  }
                                >
                                  {t("Guardar", "Save")}
                                </button>

                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  onClick={cancelarEdicionCompetidor}
                                >
                                  {t("Cancelar", "Cancel")}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={competidor.id}>
                          <td className={styles.nameCell}>
                            {competidor.nombre}
                          </td>

                          <td>
                            {competidor.tipo ??
                              t("Sin definir", "Not defined")}
                          </td>

                          <td>
                            <span
                              className={
                                competidor.estado === "activo"
                                  ? styles.badgeActive
                                  : competidor.estado === "inactivo"
                                  ? styles.badgeInactive
                                  : styles.badgeNeutral
                              }
                            >
                              {competidor.estado === "activo"
                                ? t("Activo", "Active")
                                : competidor.estado === "inactivo"
                                ? t("Inactivo", "Inactive")
                                : t("Sin definir", "Not defined")}
                            </span>
                          </td>

                          {puedeGestionarCompetidores && (
                            <td>
                              <div className={styles.actions}>
                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  onClick={() =>
                                    iniciarEdicionCompetidor(
                                      competidor
                                    )
                                  }
                                >
                                  {t("Editar", "Edit")}
                                </button>

                                <button
                                  className={
                                    competidor.estado === "inactivo"
                                      ? styles.reactivateButton
                                      : styles.dangerButton
                                  }
                                  type="button"
                                  disabled={
                                    accionCompetidorId === competidor.id
                                  }
                                  onClick={() =>
                                    cambiarEstadoCompetidor(
                                      competidor
                                    )
                                  }
                                >
                                  {competidor.estado === "inactivo"
                                    ? t("Reactivar", "Reactivate")
                                    : t("Desactivar", "Deactivate")}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <span>
                  {t("Mostrando", "Showing")}{" "}
                  {(paginaCompetidoresActual - 1) *
                    REGISTROS_POR_PAGINA +
                    1}
                  –
                  {Math.min(
                    paginaCompetidoresActual *
                      REGISTROS_POR_PAGINA,
                    competidoresFiltrados.length
                  )}{" "}
                  {t("de", "of")}{" "}
                  {competidoresFiltrados.length}
                </span>

                <div className={styles.paginationControls}>
                  <button
                    type="button"
                    disabled={paginaCompetidoresActual <= 1}
                    onClick={() =>
                      setPaginaCompetidores(
                        Math.max(
                          1,
                          paginaCompetidoresActual - 1
                        )
                      )
                    }
                  >
                    {t("Anterior", "Previous")}
                  </button>

                  <strong>
                    {paginaCompetidoresActual} /{" "}
                    {totalPaginasCompetidores}
                  </strong>

                  <button
                    type="button"
                    disabled={
                      paginaCompetidoresActual >=
                      totalPaginasCompetidores
                    }
                    onClick={() =>
                      setPaginaCompetidores(
                        Math.min(
                          totalPaginasCompetidores,
                          paginaCompetidoresActual + 1
                        )
                      )
                    }
                  >
                    {t("Siguiente", "Next")}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
            )}

            {seccionActiva === "productos" && (
        <section
          className={styles.sectionCard}
          style={{ ...tarjeta, marginBottom: 0 }}
        >
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t("Catálogo", "Catalog")}
              </span>
              <h2>{t("Productos", "Products")}</h2>
            </div>

            <span className={styles.sectionCount}>
              {productos.length}{" "}
              {t("registros", "records")}
            </span>
          </div>



          {puedeGestionarProductos && (
            <details className={styles.managementPanel}>
              <summary className={styles.managementSummary}>
                {t("+ Nuevo producto", "+ New product")}
              </summary>

            <form
              onSubmit={crearProducto}
              style={{
                padding: "18px",
                marginBottom: "22px",
                border: "1px solid #e5e5e5",
                borderRadius: "10px",
                background: "#fafafa",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {t("Agregar producto", "Add product")}
              </h3>

              <p style={{ color: "#666" }}>
                {t("Empresa destino", "Target company")}:{" "}
                <strong>
                  {esSuperadmin ? empresaSeleccionada : perfil?.empresaId}
                </strong>
              </p>

              <label
                htmlFor="nombreProducto"
                style={{ display: "block", marginBottom: "6px" }}
              >
                {t("Nombre", "Name")}
              </label>

              <input
                id="nombreProducto"
                value={nombreProducto}
                onChange={(e) => setNombreProducto(e.target.value)}
                placeholder="Ej: Producto veterinario"
                disabled={guardandoProducto}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />

              <label
                htmlFor="categoriaProducto"
                style={{ display: "block", marginBottom: "6px" }}
              >
                {t("Categoría", "Category")}
              </label>

              <input
                id="categoriaProducto"
                value={categoriaProducto}
                onChange={(e) => setCategoriaProducto(e.target.value)}
                placeholder="Ej: Antiparasitario"
                disabled={guardandoProducto}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />

              <label
                htmlFor="precioProducto"
                style={{ display: "block", marginBottom: "6px" }}
              >
                {t(
                  "Precio CLP (opcional)",
                  "CLP price (optional)"
                )}
              </label>

              <input
                id="precioProducto"
                type="number"
                min="0"
                step="1"
                value={precioProducto}
                onChange={(e) => setPrecioProducto(e.target.value)}
                placeholder="Ej: 19990"
                disabled={guardandoProducto}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />

              <label
                htmlFor="competidorProducto"
                style={{ display: "block", marginBottom: "6px" }}
              >
                {t("Competidor", "Competitor")}
              </label>

              <select
                id="competidorProducto"
                value={competidorProducto}
                onChange={(e) => setCompetidorProducto(e.target.value)}
                disabled={guardandoProducto || competidores.length === 0}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              >
                <option value="">
                  {t(
                    "Seleccionar competidor",
                    "Select competitor"
                  )}
                </option>

                {competidores.map((competidor) => (
                  <option key={competidor.id} value={competidor.id}>
                    {competidor.nombre}
                  </option>
                ))}
              </select>

              {competidores.length === 0 && (
                <p style={{ color: "#666" }}>
                  {t(
                    "Primero debes registrar un competidor para esta empresa.",
                    "You must first register a competitor for this company."
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={guardandoProducto || competidores.length === 0}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "8px",
                  background: "#111",
                  color: "#fff",
                  cursor:
                    guardandoProducto || competidores.length === 0
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 600,
                }}
              >
                {guardandoProducto
                  ? t("Guardando...", "Saving...")
                  : t("Agregar producto", "Add product")}
              </button>

              {mensajeProducto && (
                <p style={{ marginBottom: 0, color: "#176b35" }}>
                  {mensajeProducto}
                </p>
              )}
            </form>
            </details>
          )}

          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              value={busquedaProducto}
              onChange={(e) => {
                setBusquedaProducto(e.target.value);
                setPaginaProductos(1);
              }}
              placeholder={t(
                "Buscar producto...",
                "Search product..."
              )}
            />

            <select
              className={styles.filterSelect}
              value={filtroEstadoProducto}
              onChange={(e) => {
                setFiltroEstadoProducto(e.target.value);
                setPaginaProductos(1);
              }}
            >
              <option value="todos">
                {t("Todos los estados", "All statuses")}
              </option>
              <option value="activo">
                {t("Activos", "Active")}
              </option>
              <option value="inactivo">
                {t("Inactivos", "Inactive")}
              </option>
            </select>
          </div>

          {cargandoDatos ? (
            <p className={styles.emptyState}>
              {t("Cargando...", "Loading...")}
            </p>
          ) : productosFiltrados.length === 0 ? (
            <p className={styles.emptyState}>
              {t(
                "No se encontraron productos.",
                "No products were found."
              )}
            </p>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>{t("Nombre", "Name")}</th>
                      <th>{t("Categoría", "Category")}</th>
                      <th>{t("Precio", "Price")}</th>
                      <th>{t("Competidor", "Competitor")}</th>
                      <th>{t("Estado", "Status")}</th>
                      {puedeGestionarProductos && (
                        <th>{t("Acciones", "Actions")}</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {productosPagina.map((producto) =>
                      editandoProductoId === producto.id ? (
                        <tr key={producto.id}>
                          <td
                            colSpan={
                              puedeGestionarProductos ? 6 : 5
                            }
                          >
                            <form
                              className={styles.inlineEditProduct}
                              onSubmit={guardarEdicionProducto}
                            >
                              <div>
                                <label>{t("Nombre", "Name")}</label>
                                <input
                                  value={nombreProductoEdicion}
                                  onChange={(e) =>
                                    setNombreProductoEdicion(
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label>
                                  {t("Categoría", "Category")}
                                </label>
                                <input
                                  value={categoriaProductoEdicion}
                                  onChange={(e) =>
                                    setCategoriaProductoEdicion(
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label>{t("Precio", "Price")}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={precioProductoEdicion}
                                  onChange={(e) =>
                                    setPrecioProductoEdicion(
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label>
                                  {t("Competidor", "Competitor")}
                                </label>
                                <select
                                  value={competidorProductoEdicion}
                                  onChange={(e) =>
                                    setCompetidorProductoEdicion(
                                      e.target.value
                                    )
                                  }
                                >
                                  {competidores.map(
                                    (competidor) => (
                                      <option
                                        key={competidor.id}
                                        value={competidor.id}
                                      >
                                        {competidor.nombre}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              <div className={styles.inlineActions}>
                                <button
                                  className={styles.primaryButton}
                                  type="submit"
                                  disabled={
                                    accionProductoId === producto.id
                                  }
                                >
                                  {t("Guardar", "Save")}
                                </button>

                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  onClick={cancelarEdicionProducto}
                                >
                                  {t("Cancelar", "Cancel")}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={producto.id}>
                          <td className={styles.nameCell}>
                            {producto.nombre}
                          </td>

                          <td>
                            {producto.categoria ??
                              t("Sin definir", "Not defined")}
                          </td>

                          <td className={styles.priceCell}>
                            {producto.precio === null ||
                            producto.precio === undefined
                              ? t("Sin precio", "No price")
                              : `$${producto.precio.toLocaleString(
                                  "es-CL"
                                )}`}
                          </td>

                          <td>
                            {competidores.find(
                              (competidor) =>
                                competidor.id ===
                                producto.competidorId
                            )?.nombre ?? producto.competidorId}
                          </td>

                          <td>
                            <span
                              className={
                                producto.estado === "activo"
                                  ? styles.badgeActive
                                  : producto.estado === "inactivo"
                                  ? styles.badgeInactive
                                  : styles.badgeNeutral
                              }
                            >
                              {producto.estado === "activo"
                                ? t("Activo", "Active")
                                : producto.estado === "inactivo"
                                ? t("Inactivo", "Inactive")
                                : t("Sin definir", "Not defined")}
                            </span>
                          </td>

                          {puedeGestionarProductos && (
                            <td>
                              <div className={styles.actions}>
                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  onClick={() =>
                                    iniciarEdicionProducto(producto)
                                  }
                                >
                                  {t("Editar", "Edit")}
                                </button>

                                <button
                                  className={
                                    producto.estado === "inactivo"
                                      ? styles.reactivateButton
                                      : styles.dangerButton
                                  }
                                  type="button"
                                  disabled={
                                    accionProductoId === producto.id
                                  }
                                  onClick={() =>
                                    cambiarEstadoProducto(producto)
                                  }
                                >
                                  {producto.estado === "inactivo"
                                    ? t("Reactivar", "Reactivate")
                                    : t("Desactivar", "Deactivate")}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <span>
                  {t("Mostrando", "Showing")}{" "}
                  {(paginaProductosActual - 1) *
                    REGISTROS_POR_PAGINA +
                    1}
                  –
                  {Math.min(
                    paginaProductosActual *
                      REGISTROS_POR_PAGINA,
                    productosFiltrados.length
                  )}{" "}
                  {t("de", "of")} {productosFiltrados.length}
                </span>

                <div className={styles.paginationControls}>
                  <button
                    type="button"
                    disabled={paginaProductosActual <= 1}
                    onClick={() =>
                      setPaginaProductos(
                        Math.max(1, paginaProductosActual - 1)
                      )
                    }
                  >
                    {t("Anterior", "Previous")}
                  </button>

                  <strong>
                    {paginaProductosActual} /{" "}
                    {totalPaginasProductos}
                  </strong>

                  <button
                    type="button"
                    disabled={
                      paginaProductosActual >= totalPaginasProductos
                    }
                    onClick={() =>
                      setPaginaProductos(
                        Math.min(
                          totalPaginasProductos,
                          paginaProductosActual + 1
                        )
                      )
                    }
                  >
                    {t("Siguiente", "Next")}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
            )}


            {seccionActiva === "importacion" &&
              puedeGestionarProductos && (
                <section
                  className={styles.sectionCard}
                  style={tarjeta}
                >
                  <div className={styles.sectionHeader}>
                    <div>
                      <span className={styles.eyebrow}>
                        {t("Carga de datos", "Data upload")}
                      </span>
                      <h2>
                        {t(
                          "Importación masiva",
                          "Bulk import"
                        )}
                      </h2>
                    </div>

                    <span className={styles.formatBadge}>
                      CSV · XLSX · JSON
                    </span>
                  </div>

                  <div className={styles.importCard}>
                    <h3>
                      {t(
                        "Importar productos",
                        "Import products"
                      )}
                    </h3>

                    <p>
                      {t(
                        "Carga múltiples productos mediante un archivo estructurado. Todos los registros se validan antes de escribir en Firestore y solo pueden asociarse a competidores de la empresa actual.",
                        "Upload multiple products using a structured file. All records are validated before writing to Firestore and can only be linked to competitors from the current company."
                      )}
                    </p>

                    <div className={styles.importInfoGrid}>
                      <div>
                        <span>
                          {t(
                            "Formatos admitidos",
                            "Supported formats"
                          )}
                        </span>
                        <strong>CSV, XLSX, JSON</strong>
                      </div>

                      <div>
                        <span>
                          {t(
                            "Máximo por archivo",
                            "Maximum per file"
                          )}
                        </span>
                        <strong>450</strong>
                      </div>

                      <div>
                        <span>
                          {t(
                            "Empresa destino",
                            "Target company"
                          )}
                        </span>
                        <strong>
                          {esSuperadmin
                            ? empresaSeleccionada
                            : perfil?.empresaId}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.requiredFields}>
                      <span>
                        {t(
                          "Campos requeridos",
                          "Required fields"
                        )}
                      </span>

                      <code>
                        {idioma === "es"
                          ? "nombre, categoria, precio, competidorId, estado"
                          : "name, category, price, competitorId, status"}
                      </code>
                    </div>

                    <div className={styles.downloadLinks}>
                      <a
                        href={
                          idioma === "es"
                            ? "/ejemplos/productos-batch.csv"
                            : "/ejemplos/products-batch.csv"
                        }
                        download
                      >
                        {t(
                          "Descargar ejemplo CSV",
                          "Download CSV example"
                        )}
                      </a>

                      <a
                        href="/ejemplos/productos-batch.json"
                        download
                      >
                        {t(
                          "Descargar ejemplo JSON",
                          "Download JSON example"
                        )}
                      </a>
                    </div>

                    <label className={styles.filePicker}>
                      <span>
                        {importandoCsv
                          ? t(
                              "Validando y cargando...",
                              "Validating and uploading..."
                            )
                          : t(
                              "Seleccionar archivo",
                              "Select file"
                            )}
                      </span>

                      <input
                        type="file"
                        accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={importarProductosArchivo}
                        disabled={
                          importandoCsv ||
                          competidores.length === 0
                        }
                      />
                    </label>

                    {mensajeCsv && (
                      <div className={styles.successMessage}>
                        {mensajeCsv}
                      </div>
                    )}
                  </div>
                </section>
              )}

          </div>
        </div>
      </div>
    </main>
  );
}
