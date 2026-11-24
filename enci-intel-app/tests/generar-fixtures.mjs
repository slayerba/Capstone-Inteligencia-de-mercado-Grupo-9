// Genera los archivos de prueba XLSX y JSON usados por las pruebas unitarias
// y por las pruebas end-to-end manuales del importador.
// Uso: node tests/generar-fixtures.mjs
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const dir = new URL("./fixtures/", import.meta.url);
const COMP = "COMPETIDOR_ID"; // reemplazar por un competidorId real del tenant antes del E2E

const validos = [
  { nombre: "Producto XLSX válido 1", categoria: "Salud animal", precio: 19990, competidorId: COMP, estado: "activo" },
  { nombre: "Producto XLSX sin precio", categoria: "Nutrición", precio: "", competidorId: COMP, estado: "inactive" },
  { nombre: "Producto XLSX precio chileno", categoria: "Bioseguridad", precio: "12.990", competidorId: COMP, estado: "activo",
    origen: "web", fuenteNombre: "Sitio oficial", fuenteUrl: "https://www.ejemplo.cl/producto", fechaConsulta: "2026-10-15" },
  { nombre: "Ñandú vitamínico ácido", categoria: "Nutrición", precio: 4500, competidorId: COMP, estado: "activo" },
];

async function xlsx(nombre, cabeceras, filas, transform = (r) => r) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Productos");
  ws.addRow(cabeceras);
  for (const f of filas) ws.addRow(transform(f));
  await wb.xlsx.writeFile(new URL(nombre, dir));
}

const ES = ["nombre", "categoria", "precio", "competidorId", "estado", "origen", "fuenteNombre", "fuenteUrl", "fechaConsulta"];
const EN = ["name", "category", "price", "competitorId", "status", "origin", "sourceName", "sourceUrl", "retrievalDate"];
const fila = (p) => ES.map((k) => p[k] ?? "");

await xlsx("productos-validos.xlsx", ES, validos, fila);
await xlsx("products-valid-en.xlsx", EN, validos, fila);
// Fecha escrita como celda de fecha real de Excel (caso típico al editar en Excel)
await xlsx("productos-fecha-excel.xlsx", ES, [validos[2]], (p) => {
  const r = fila(p); r[8] = new Date(Date.UTC(2026, 9, 15)); return r;
});
await xlsx("productos-invalidos.xlsx", ES, [
  { nombre: "", categoria: "Salud animal", precio: 1000, competidorId: COMP, estado: "activo" },
], fila);
await xlsx("productos-web-sin-url.xlsx", ES, [
  { nombre: "Web sin URL", categoria: "Salud animal", precio: 1000, competidorId: COMP, estado: "activo", origen: "web" },
], fila);

writeFileSync(new URL("productos-validos.json", dir), JSON.stringify(validos, null, 2));
writeFileSync(new URL("productos-objeto.json", dir), JSON.stringify({ productos: validos.slice(0, 2) }, null, 2));
writeFileSync(new URL("productos-invalidos.json", dir), JSON.stringify([{ nombre: "Precio negativo", categoria: "X", precio: -5, competidorId: COMP, estado: "activo" }], null, 2));
writeFileSync(new URL("productos-malformado.json", dir), '{"productos": [ { "nombre": "sin cerrar" ');
// CSV para la prueba end-to-end en la aplicación (formato solicitado para la carga)
const csv = (filas) => [ES.join(","), ...filas.map((p) => fila(p).map((v) => {
  const t = String(v ?? "");
  return /[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}).join(","))].join("\n") + "\n";
writeFileSync(new URL("productos-validos.csv", dir), csv(validos.map((p) => ({ ...p, nombre: p.nombre.replace("XLSX", "CSV") }))));
writeFileSync(new URL("productos-invalidos.csv", dir), csv([
  { nombre: "", categoria: "Salud animal", precio: 1000, competidorId: COMP, estado: "activo" },
  { nombre: "Precio negativo", categoria: "Salud animal", precio: -5, competidorId: COMP, estado: "activo" },
]));
console.log("Fixtures generados en tests/fixtures/");
