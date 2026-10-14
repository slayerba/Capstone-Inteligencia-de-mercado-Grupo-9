"use client";

import { useEffect, useState } from "react";

export type Idioma = "es" | "en";

const STORAGE_KEY = "enci-intel-language";

export function tr(idioma: Idioma, es: string, en: string) {
  return idioma === "en" ? en : es;
}

export function useIdioma() {
  const [idioma, setIdioma] = useState<Idioma>("es");

  useEffect(() => {
    const guardado = window.localStorage.getItem(STORAGE_KEY);

    const inicial: Idioma =
      guardado === "en" || guardado === "es"
        ? guardado
        : "es";

    setIdioma(inicial);
    document.documentElement.lang = inicial;
  }, []);

  function cambiarIdioma(nuevoIdioma: Idioma) {
    setIdioma(nuevoIdioma);
    window.localStorage.setItem(STORAGE_KEY, nuevoIdioma);
    document.documentElement.lang = nuevoIdioma;
  }

  return {
    idioma,
    cambiarIdioma,
  };
}

type SelectorIdiomaProps = {
  idioma: Idioma;
  onChange: (idioma: Idioma) => void;
};

export function SelectorIdioma({
  idioma,
  onChange,
}: SelectorIdiomaProps) {
  const boton = (codigo: Idioma) => ({
    padding: "7px 10px",
    borderRadius: "7px",
    border:
      idioma === codigo
        ? "2px solid #111"
        : "1px solid #ccc",
    background:
      idioma === codigo
        ? "#111"
        : "#fff",
    color:
      idioma === codigo
        ? "#fff"
        : "#111",
    cursor: "pointer",
    fontWeight: 600,
  });

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        alignItems: "center",
      }}
      aria-label={
        idioma === "es"
          ? "Selector de idioma"
          : "Language selector"
      }
    >
      <button
        type="button"
        onClick={() => onChange("es")}
        style={boton("es")}
      >
        ES
      </button>

      <button
        type="button"
        onClick={() => onChange("en")}
        style={boton("en")}
      >
        EN
      </button>
    </div>
  );
}
