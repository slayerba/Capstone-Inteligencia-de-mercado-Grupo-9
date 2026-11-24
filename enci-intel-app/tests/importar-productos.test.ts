// Pruebas unitarias del importador batch (CSV / XLSX / JSON).
// Validan la capa de normalización antes de escribir en Firestore.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsearArchivoProductos } from "@/lib/importar-productos";

const fx = (n: string) => new URL(`./fixtures/${n}`, import.meta.url);
const archivo = (n: string, tipo = "") => new File([readFileSync(fx(n))], n, { type: tipo });
const texto = (n: string, contenido: string) => new File([contenido], n);

describe("CSV", () => {
  it("lee separador coma y normaliza active/inactive", async () => {
    const r = await parsearArchivoProductos(
      texto("p.csv", "name,category,price,competitorId,status\nA,Salud,1500,c1,inactive"), "es");
    expect(r).toEqual([expect.objectContaining({ nombre: "A", precio: 1500, competidorId: "c1", estado: "inactivo", origen: "manual" })]);
  });
  it("lee separador punto y coma y precio chileno con decimales", async () => {
    const r = await parsearArchivoProductos(
      texto("p.csv", "nombre;categoria;precio;competidorId;estado\nB;Nutrición;19.990,50;c1;activo"), "es");
    expect(r[0].precio).toBe(19990.5);
  });
  it("respeta comillas con separador dentro del valor", async () => {
    const r = await parsearArchivoProductos(
      texto("p.csv", 'nombre,categoria,precio,competidorId,estado\n"Prod, 1L",Cat,,c1,activo'), "es");
    expect(r[0]).toMatchObject({ nombre: "Prod, 1L", precio: null });
  });
  it("rechaza CSV sin filas de datos", async () => {
    await expect(parsearArchivoProductos(texto("p.csv", "nombre,categoria"), "es")).rejects.toThrow(/cabecera/);
  });
});

describe("XLSX", () => {
  it("importa el archivo válido con encabezados en español", async () => {
    const r = await parsearArchivoProductos(archivo("productos-validos.xlsx"), "es");
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ nombre: "Producto XLSX válido 1", precio: 19990, estado: "activo" });
    expect(r[1]).toMatchObject({ precio: null, estado: "inactivo" });
    expect(r[2]).toMatchObject({ precio: 12990, origen: "web", fuenteUrl: "https://www.ejemplo.cl/producto", fechaConsulta: "2026-10-15" });
    expect(r[3].nombre).toBe("Ñandú vitamínico ácido");
  });
  it("importa el archivo con encabezados en inglés", async () => {
    const r = await parsearArchivoProductos(archivo("products-valid-en.xlsx"), "en");
    expect(r).toHaveLength(4);
    expect(r[2].fechaConsulta).toBe("2026-10-15");
  });
  it("acepta fechaConsulta guardada como celda de fecha de Excel", async () => {
    const r = await parsearArchivoProductos(archivo("productos-fecha-excel.xlsx"), "es");
    expect(r[0].fechaConsulta).toBe("2026-10-15");
  });
  it("rechaza fila con nombre vacío indicando la fila", async () => {
    await expect(parsearArchivoProductos(archivo("productos-invalidos.xlsx"), "es")).rejects.toThrow(/Fila 2: el nombre está vacío/);
  });
  it("rechaza registro web sin URL", async () => {
    await expect(parsearArchivoProductos(archivo("productos-web-sin-url.xlsx"), "es")).rejects.toThrow(/fuenteUrl/);
  });
});

describe("JSON", () => {
  it("importa un arreglo de productos", async () => {
    const r = await parsearArchivoProductos(archivo("productos-validos.json"), "es");
    expect(r).toHaveLength(4);
    expect(r[2]).toMatchObject({ precio: 12990, origen: "web" });
  });
  it("importa un objeto con propiedad productos", async () => {
    const r = await parsearArchivoProductos(archivo("productos-objeto.json"), "es");
    expect(r).toHaveLength(2);
  });
  it("rechaza precio negativo", async () => {
    await expect(parsearArchivoProductos(archivo("productos-invalidos.json"), "es")).rejects.toThrow(/precio no es válido/);
  });
  it("rechaza JSON malformado", async () => {
    await expect(parsearArchivoProductos(archivo("productos-malformado.json"), "es")).rejects.toThrow(/JSON no tiene un formato válido/);
  });
});

describe("Formatos", () => {
  it("rechaza extensiones no soportadas", async () => {
    await expect(parsearArchivoProductos(texto("p.pdf", "x"), "en")).rejects.toThrow(/Unsupported format/);
  });
});

describe("Regresiones corregidas", () => {
  it("columna origen presente pero vacía se interpreta como manual (CSV)", async () => {
    const r = await parsearArchivoProductos(
      texto("p.csv", "nombre,categoria,precio,competidorId,estado,origen\nA,Cat,100,c1,activo,"), "es");
    expect(r[0].origen).toBe("manual");
  });
});
