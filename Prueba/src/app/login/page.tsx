"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type PerfilUsuario = {
  email?: string;
  rol?: string;
  empresaId?: string;
  estado?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensaje("");
    setPerfil(null);
    setCargando(true);

    try {
      const credencial = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const referenciaUsuario = doc(db, "users", credencial.user.uid);
      const documentoUsuario = await getDoc(referenciaUsuario);

      if (!documentoUsuario.exists()) {
        await signOut(auth);
        setMensaje("El usuario no tiene un perfil configurado en Enci-Intel.");
        return;
      }

      const datos = documentoUsuario.data() as PerfilUsuario;

      if (datos.estado !== "activo") {
        await signOut(auth);
        setMensaje("La cuenta se encuentra inactiva.");
        return;
      }

      if (!datos.empresaId || !datos.rol) {
        await signOut(auth);
        setMensaje("El perfil no tiene empresa o rol configurado.");
        return;
      }

      setPerfil(datos);
      setMensaje("Inicio de sesión correcto.");
    } catch (error) {
      console.error(error);
      setMensaje("Correo o contraseña incorrectos.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f6f8",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>Enci-Intel</h1>

        <p style={{ marginBottom: "24px", color: "#666" }}>
          Plataforma de inteligencia de mercado
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: "6px" }}
          >
            Correo electrónico
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "18px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              boxSizing: "border-box",
            }}
          />

          <label
            htmlFor="password"
            style={{ display: "block", marginBottom: "6px" }}
          >
            Contraseña
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: "12px",
              border: "none",
              borderRadius: "8px",
              background: "#111",
              color: "#fff",
              cursor: cargando ? "wait" : "pointer",
              fontWeight: 600,
            }}
          >
            {cargando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        {mensaje && (
          <p style={{ marginTop: "20px" }}>
            {mensaje}
          </p>
        )}

        {perfil && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              background: "#f0f7f2",
              borderRadius: "8px",
            }}
          >
            <strong>Usuario autenticado</strong>
            <p>Empresa: {perfil.empresaId}</p>
            <p>Rol: {perfil.rol}</p>
          </div>
        )}
      </section>
    </main>
  );
}
