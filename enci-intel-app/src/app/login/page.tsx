"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { SelectorIdioma, tr, useIdioma } from "@/lib/i18n";
import styles from "./login.module.css";

type PerfilUsuario = {
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensaje("");
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
        setMensaje(
          tr(
            idioma,
            "El usuario no tiene un perfil configurado en Enci-Intel.",
            "The user does not have a profile configured in Enci-Intel."
          )
        );
        return;
      }

      const datos = documentoUsuario.data() as PerfilUsuario;

      if (datos.estado !== "activo") {
        await signOut(auth);
        setMensaje(
          tr(idioma, "La cuenta se encuentra inactiva.", "The account is inactive.")
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

      const esSuperadmin = datos.rol === "superadmin";

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

      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      const codigo = (error as { code?: string }).code ?? "";

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
        String(error).toLowerCase().includes("offline")
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
            `No se pudo iniciar sesión (${codigo || "error desconocido"}).`,
            `Login failed (${codigo || "unknown error"}).`
          )
        );
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.brandPanel}>
          <div>
            <span className={styles.kicker}>
              {tr(idioma, "INTELIGENCIA DE MERCADO", "MARKET INTELLIGENCE")}
            </span>
            <h1>Enci-Intel</h1>
            <p className={styles.lead}>
              {tr(
                idioma,
                "Infraestructura multitenant para organizar competidores, productos, precios y fuentes en un solo lugar.",
                "Multitenant infrastructure to organize competitors, products, prices and sources in one place."
              )}
            </p>
          </div>

          <p className={styles.brandSummary}>
            {tr(
              idioma,
              "Información organizada, trazable y separada de forma segura por empresa.",
              "Organized, traceable information securely separated by company."
            )}
          </p>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.languageRow}>
            <SelectorIdioma idioma={idioma} onChange={cambiarIdioma} />
          </div>

          <div className={styles.formHeading}>
            <span>{tr(idioma, "Acceso seguro", "Secure access")}</span>
            <h2>{tr(idioma, "Iniciar sesión", "Sign in")}</h2>
            <p>
              {tr(
                idioma,
                "Ingresa con tu cuenta asignada. El contenido visible depende de tu empresa y rol.",
                "Sign in with your assigned account. Visible content depends on your company and role."
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="email">
              {tr(idioma, "Correo electrónico", "Email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="usuario@empresa.cl"
            />

            <label htmlFor="password">
              {tr(idioma, "Contraseña", "Password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <button type="submit" disabled={cargando}>
              {cargando
                ? tr(idioma, "Ingresando...", "Signing in...")
                : tr(idioma, "Iniciar sesión", "Sign in")}
            </button>
          </form>

          {mensaje && (
            <div className={styles.message} role="status" aria-live="polite">
              {mensaje}
            </div>
          )}

          <p className={styles.securityNote}>
            {tr(
              idioma,
              "El acceso se valida con Firebase Authentication y reglas de seguridad de Firestore.",
              "Access is validated with Firebase Authentication and Firestore Security Rules."
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
