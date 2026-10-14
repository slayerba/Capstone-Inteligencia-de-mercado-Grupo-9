"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  SelectorIdioma,
  tr,
  useIdioma,
} from "@/lib/i18n";
import { useRouter } from "next/navigation";

type PerfilUsuario = {
  email?: string;
  rol?: string;
  empresaId?: string | null;
  estado?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { idioma, cambiarIdioma } = useIdioma();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [perfil, setPerfil] =
    useState<PerfilUsuario | null>(null);

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setMensaje("");
    setPerfil(null);
    setCargando(true);

    try {
      const credencial =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const referenciaUsuario = doc(
        db,
        "users",
        credencial.user.uid
      );

      const documentoUsuario =
        await getDoc(referenciaUsuario);

      if (!documentoUsuario.exists()) {
        await signOut(auth);

        setMensaje(
          tr(
            idioma,
            "El usuario no tiene un perfil configurado en Enci-Intel.",
            "The user does not have a profile configured in Enci-Intel."
          )
        );

        return;
      }

      const datos =
        documentoUsuario.data() as PerfilUsuario;

      if (datos.estado !== "activo") {
        await signOut(auth);

        setMensaje(
          tr(
            idioma,
            "La cuenta se encuentra inactiva.",
            "The account is inactive."
          )
        );

        return;
      }

      if (!datos.rol) {
        await signOut(auth);

        setMensaje(
          tr(
            idioma,
            "El perfil no tiene rol configurado.",
            "The profile does not have a configured role."
          )
        );

        return;
      }

      const esSuperadmin =
        datos.rol === "superadmin";

      if (!esSuperadmin && !datos.empresaId) {
        await signOut(auth);

        setMensaje(
          tr(
            idioma,
            "El perfil no tiene empresa asignada.",
            "The profile does not have an assigned company."
          )
        );

        return;
      }

      setPerfil(datos);

      setMensaje(
        tr(
          idioma,
          "Inicio de sesión correcto.",
          "Login successful."
        )
      );

      router.replace("/dashboard");
    } catch (error) {
      console.error(error);

      const codigo =
        (error as { code?: string }).code ?? "";

      if (codigo === "auth/invalid-credential") {
        setMensaje(
          tr(
            idioma,
            "Correo o contraseña incorrectos.",
            "Incorrect email or password."
          )
        );
      } else if (
        codigo === "unavailable" ||
        String(error).includes("offline")
      ) {
        await signOut(auth).catch(() => {});

        setMensaje(
          tr(
            idioma,
            "No hay conexión con la base de datos. Revisa tu red e inténtalo de nuevo.",
            "There is no connection to the database. Check your network and try again."
          )
        );
      } else {
        setMensaje(
          tr(
            idioma,
            `No se pudo iniciar sesión (${
              codigo || "error desconocido"
            }).`,
            `Login failed (${
              codigo || "unknown error"
            }).`
          )
        );
      }
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
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "14px",
          }}
        >
          <SelectorIdioma
            idioma={idioma}
            onChange={cambiarIdioma}
          />
        </div>

        <h1 style={{ marginBottom: "8px" }}>
          Enci-Intel
        </h1>

        <p
          style={{
            marginBottom: "24px",
            color: "#666",
          }}
        >
          {tr(
            idioma,
            "Plataforma de inteligencia de mercado",
            "Market intelligence platform"
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              marginBottom: "6px",
            }}
          >
            {tr(
              idioma,
              "Correo electrónico",
              "Email"
            )}
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
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
            style={{
              display: "block",
              marginBottom: "6px",
            }}
          >
            {tr(
              idioma,
              "Contraseña",
              "Password"
            )}
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
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
              cursor: cargando
                ? "wait"
                : "pointer",
              fontWeight: 600,
            }}
          >
            {cargando
              ? tr(
                  idioma,
                  "Ingresando...",
                  "Signing in..."
                )
              : tr(
                  idioma,
                  "Iniciar sesión",
                  "Sign in"
                )}
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
            <strong>
              {tr(
                idioma,
                "Usuario autenticado",
                "Authenticated user"
              )}
            </strong>

            <p>
              {tr(
                idioma,
                "Empresa",
                "Company"
              )}
              :{" "}
              {perfil.empresaId ??
                tr(
                  idioma,
                  "Todas (superadmin)",
                  "All (superadmin)"
                )}
            </p>

            <p>
              {tr(idioma, "Rol", "Role")}:{" "}
              {perfil.rol}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
