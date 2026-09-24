"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Perfil = {
  email?: string;
  empresaId?: string;
  rol?: string;
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

export default function DashboardPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [competidores, setCompetidores] = useState<Competidor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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

        if (
          datosPerfil.estado !== "activo" ||
          !datosPerfil.empresaId ||
          !datosPerfil.rol
        ) {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        setPerfil(datosPerfil);

        const competidoresQuery = query(
          collection(db, "competidores"),
          where("empresaId", "==", datosPerfil.empresaId)
        );

        const competidoresSnap = await getDocs(competidoresQuery);

        const listaCompetidores: Competidor[] =
          competidoresSnap.docs.map((documento) => ({
            id: documento.id,
            nombre: documento.data().nombre ?? documento.id,
            tipo: documento.data().tipo,
            estado: documento.data().estado,
          }));

        setCompetidores(listaCompetidores);

        const listasProductos = await Promise.all(
          listaCompetidores.map(async (competidor) => {
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

        setProductos(listasProductos.flat());
      } catch (err) {
        console.error(err);
        setError("No fue posible cargar los datos de la empresa.");
      } finally {
        setCargando(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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

        <section
          style={{
            background: "#fff",
            padding: "24px",
            borderRadius: "14px",
            marginBottom: "24px",
          }}
        >
          <h2>Sesión activa</h2>
          <p><strong>Usuario:</strong> {usuario?.email}</p>
          <p><strong>Empresa:</strong> {perfil?.empresaId}</p>
          <p><strong>Rol:</strong> {perfil?.rol}</p>
        </section>

        {error && (
          <section
            style={{
              background: "#fff3f3",
              padding: "20px",
              borderRadius: "14px",
              marginBottom: "24px",
            }}
          >
            {error}
          </section>
        )}

        <section
          style={{
            background: "#fff",
            padding: "24px",
            borderRadius: "14px",
            marginBottom: "24px",
          }}
        >
          <h2>Competidores</h2>

          {competidores.length === 0 ? (
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

        <section
          style={{
            background: "#fff",
            padding: "24px",
            borderRadius: "14px",
          }}
        >
          <h2>Productos</h2>

          {productos.length === 0 ? (
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
