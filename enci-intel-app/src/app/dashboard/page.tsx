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

  const tarjeta = {
    background: "#fff",
    padding: "24px",
    borderRadius: "14px",
    marginBottom: "24px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        padding: "40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <header
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

        <section style={tarjeta}>
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

        {error && (
          <section style={{ ...tarjeta, background: "#fff3f3" }}>
            {error}
          </section>
        )}

        <section style={tarjeta}>
          <h2>
            {t("Competidores", "Competitors")}
            {esSuperadmin && empresaSeleccionada
              ? ` de ${empresaSeleccionada}`
              : ""}
          </h2>

          {puedeGestionarCompetidores && (
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
          )}

          {cargandoDatos ? (
            <p>{t("Cargando...", "Loading...")}</p>
          ) : competidores.length === 0 ? (
            <p>{t(
              "No existen competidores asociados a esta empresa.",
              "There are no competitors associated with this company."
            )}</p>
          ) : (
            competidores.map((competidor) => (
              <div
                key={competidor.id}
                style={{
                  borderTop: "1px solid #eee",
                  padding: "14px 0",
                }}
              >
                <strong>{competidor.nombre}</strong>
                <div>
                  {t("Tipo", "Type")}:{" "}
                  {competidor.tipo ??
                    t("Sin definir", "Not defined")}
                </div>
                <div>
                  {t("Estado", "Status")}:{" "}
                  {competidor.estado === "activo"
                    ? t("activo", "active")
                    : competidor.estado === "inactivo"
                    ? t("inactivo", "inactive")
                    : t("Sin definir", "Not defined")}
                </div>
              </div>
            ))
          )}
        </section>

        <section style={{ ...tarjeta, marginBottom: 0 }}>
          <h2>{t("Productos", "Products")}</h2>

          {puedeGestionarProductos && (
            <div
              style={{
                padding: "18px",
                marginBottom: "22px",
                border: "1px solid #d8e2ec",
                borderRadius: "10px",
                background: "#f7fbff",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {t(
                  "Importar productos por archivo",
                  "Import products from file"
                )}
              </h3>

              <p style={{ color: "#666", lineHeight: 1.5 }}>
                {t(
                  "Carga masiva mediante Firestore Batch. Se admiten archivos CSV, Excel XLSX y JSON. El archivo se valida completamente antes de escribir y solo puede utilizar competidores de la empresa actual.",
                  "Bulk upload using Firestore Batch. CSV, Excel XLSX and JSON files are supported. The file is fully validated before writing and can only use competitors from the current company."
                )}
              </p>

              <p style={{ color: "#666", lineHeight: 1.5 }}>
                {t(
                  "Columnas requeridas:",
                  "Required fields:"
                )}
                <br />
                <code>
                  {idioma === "es"
                    ? "nombre,categoria,precio,competidorId,estado"
                    : "name,category,price,competitorId,status"}
                </code>
              </p>

              <p style={{ color: "#666" }}>
                {t(
                  "Máximo: 450 productos por archivo.",
                  "Maximum: 450 products per file."
                )}
              </p>

              <a
                href="/ejemplos/productos-batch.csv"
                download
                style={{
                  display: "inline-block",
                  marginBottom: "14px",
                }}
              >
                {t(
                  "Descargar CSV sintético de ejemplo",
                  "Download synthetic CSV example"
                )}
              </a>

              <span style={{ margin: "0 8px" }}>|</span>

              <a
                href="/ejemplos/productos-batch.json"
                download
                style={{
                  display: "inline-block",
                  marginBottom: "14px",
                }}
              >
                {t(
                  "Descargar JSON sintético de ejemplo",
                  "Download synthetic JSON example"
                )}
              </a>

              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={importarProductosArchivo}
                  disabled={
                    importandoCsv || competidores.length === 0
                  }
                />
              </div>

              {importandoCsv && (
                <p style={{ color: "#666" }}>
                  {t(
                    "Validando y cargando productos...",
                    "Validating and uploading products..."
                  )}
                </p>
              )}

              {mensajeCsv && (
                <p
                  style={{
                    marginBottom: 0,
                    color: "#176b35",
                    fontWeight: 600,
                  }}
                >
                  {mensajeCsv}
                </p>
              )}
            </div>
          )}

          {puedeGestionarProductos && (
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
          )}

          {cargandoDatos ? (
            <p>{t("Cargando...", "Loading...")}</p>
          ) : productos.length === 0 ? (
            <p>{t(
              "No existen productos asociados a los competidores de esta empresa.",
              "There are no products associated with this company's competitors."
            )}</p>
          ) : (
            productos.map((producto) => (
              <div
                key={producto.id}
                style={{
                  borderTop: "1px solid #eee",
                  padding: "14px 0",
                }}
              >
                <strong>{producto.nombre}</strong>
                <div>
                  {t("Categoría", "Category")}:{" "}
                  {producto.categoria ??
                    t("Sin definir", "Not defined")}
                </div>
                <div>
                  {t("Precio", "Price")}:{" "}
                  {producto.precio === null || producto.precio === undefined
                    ? t("Sin precio", "No price")
                    : `$${producto.precio.toLocaleString("es-CL")}`}
                </div>
                <div>
                  {t("Competidor", "Competitor")}:{" "}
                  {competidores.find(
                    (competidor) => competidor.id === producto.competidorId
                  )?.nombre ?? producto.competidorId}
                </div>
                <div>
                  {t("Estado", "Status")}:{" "}
                  {producto.estado === "activo"
                    ? t("activo", "active")
                    : producto.estado === "inactivo"
                    ? t("inactivo", "inactive")
                    : t("Sin definir", "Not defined")}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
