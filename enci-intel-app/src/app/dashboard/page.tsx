"use client";

import { FormEvent, useEffect, useState } from "react";
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
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

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
        estado: documento.data().estado,
      })) as Producto[];
    })
  );

  return { competidores, productos: listasProductos.flat() };
}

export default function DashboardPage() {
  const router = useRouter();

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

  const esSuperadmin = perfil?.rol === "superadmin";
  const puedeGestionarCompetidores =
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
      setError("Tu rol no tiene permiso para crear competidores.");
      return;
    }

    const empresaDestino = esSuperadmin
      ? empresaSeleccionada
      : perfil?.empresaId ?? "";

    if (!empresaDestino) {
      setError("No hay una empresa seleccionada para crear el competidor.");
      return;
    }

    const nombre = nombreCompetidor.trim();
    const tipo = tipoCompetidor.trim() || "empresa";

    if (!nombre) {
      setError("Debes ingresar el nombre del competidor.");
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
      setMensajeCompetidor("Competidor agregado correctamente.");
    } catch (err) {
      console.error(err);
      setError("No fue posible crear el competidor.");
    } finally {
      setGuardandoCompetidor(false);
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
              Plataforma de inteligencia de mercado
            </p>
          </div>

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
            Cerrar sesión
          </button>
        </header>

        <section style={tarjeta}>
          <h2>Sesión activa</h2>
          <p><strong>Usuario:</strong> {usuario?.email}</p>
          <p>
            <strong>Empresa:</strong>{" "}
            {esSuperadmin ? "Todas (superadmin)" : perfil?.empresaId}
          </p>
          <p><strong>Rol:</strong> {perfil?.rol}</p>
        </section>

        {esSuperadmin && (
          <section style={tarjeta}>
            <h2>Empresas de la plataforma</h2>

            {empresas.length === 0 ? (
              <p>No hay empresas registradas.</p>
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
                  Ver competidores y productos de:
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
            Competidores
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
              <h3 style={{ marginTop: 0 }}>Agregar competidor</h3>

              <p style={{ color: "#666" }}>
                Empresa destino:{" "}
                <strong>
                  {esSuperadmin ? empresaSeleccionada : perfil?.empresaId}
                </strong>
              </p>

              <label
                htmlFor="nombreCompetidor"
                style={{ display: "block", marginBottom: "6px" }}
              >
                Nombre
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
                Tipo
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
                  ? "Guardando..."
                  : "Agregar competidor"}
              </button>

              {mensajeCompetidor && (
                <p style={{ marginBottom: 0, color: "#176b35" }}>
                  {mensajeCompetidor}
                </p>
              )}
            </form>
          )}

          {cargandoDatos ? (
            <p>Cargando...</p>
          ) : competidores.length === 0 ? (
            <p>No existen competidores asociados a esta empresa.</p>
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
                <div>Tipo: {competidor.tipo ?? "Sin definir"}</div>
                <div>Estado: {competidor.estado ?? "Sin definir"}</div>
              </div>
            ))
          )}
        </section>

        <section style={{ ...tarjeta, marginBottom: 0 }}>
          <h2>Productos</h2>

          {cargandoDatos ? (
            <p>Cargando...</p>
          ) : productos.length === 0 ? (
            <p>No existen productos asociados a los competidores de esta empresa.</p>
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
                <div>Categoría: {producto.categoria ?? "Sin definir"}</div>
                <div>Competidor: {producto.competidorId}</div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
