// Prueba de rendimiento HTTP sin dependencias externas (Node 20+).
// Mide tiempos de respuesta de las páginas públicas bajo carga concurrente.
//
// Uso:
//   node tests/rendimiento.mjs <URL_BASE> [peticionesPorRuta=200] [concurrencia=20]
// Ejemplos:
//   node tests/rendimiento.mjs http://localhost:3000            (Docker / npm start)
//   node tests/rendimiento.mjs https://TU-PROYECTO.vercel.app 200 20
//
// Alcance: mide el servidor/CDN que entrega la aplicación (Vercel o el contenedor).
// Las consultas a Firestore ocurren en el navegador del usuario y se evalúan
// aparte con PageSpeed Insights / Lighthouse (ver Plan de Pruebas).

const [base, totalArg = "200", concArg = "20"] = process.argv.slice(2);
if (!base) {
  console.error("Falta la URL base. Ej: node tests/rendimiento.mjs http://localhost:3000");
  process.exit(1);
}
const TOTAL = Number(totalArg);
const CONC = Number(concArg);
const RUTAS = ["/login", "/dashboard", "/ejemplos/productos-batch.csv"];
const UMBRAL_P95_MS = 1000; // RNF de rendimiento: p95 < 1 s por página

function percentil(ordenados, p) {
  if (!ordenados.length) return NaN;
  const i = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[i];
}

async function medirRuta(ruta) {
  const tiempos = [];
  let errores = 0;
  let primerError = "";
  let enviadas = 0;
  const inicio = performance.now();

  async function trabajador() {
    while (enviadas < TOTAL) {
      enviadas += 1;
      const t0 = performance.now();
      try {
        const r = await fetch(base.replace(/\/$/, "") + ruta, { redirect: "manual" });
        await r.arrayBuffer();
        if (r.status >= 400) { errores += 1; primerError ||= `HTTP ${r.status}`; }
        else tiempos.push(performance.now() - t0);
      } catch (e) {
        errores += 1;
        primerError ||= e?.cause?.code || e?.message || "error de red";
      }
    }
  }

  await Promise.all(Array.from({ length: CONC }, trabajador));
  const duracion = (performance.now() - inicio) / 1000;
  tiempos.sort((a, b) => a - b);
  const p95 = percentil(tiempos, 95);
  return {
    ruta,
    peticiones: TOTAL,
    errores,
    "req/s": +(TOTAL / duracion).toFixed(1),
    "prom ms": +(tiempos.reduce((s, t) => s + t, 0) / (tiempos.length || 1)).toFixed(1),
    "p50 ms": +percentil(tiempos, 50).toFixed(1),
    "p95 ms": +p95.toFixed(1),
    "máx ms": +tiempos.at(-1)?.toFixed(1),
    resultado: errores === 0 && p95 < UMBRAL_P95_MS ? "APROBADO" : "REVISAR",
    ...(primerError ? { detalle: primerError } : {}),
  };
}

console.log(`Prueba de rendimiento — ${base} — ${TOTAL} peticiones/ruta, concurrencia ${CONC}`);
console.log(`Fecha: ${new Date().toISOString()}`);
const resultados = [];
for (const ruta of RUTAS) resultados.push(await medirRuta(ruta));
console.table(resultados);
const ok = resultados.every((r) => r.resultado === "APROBADO");
console.log(ok ? "✅ Todas las rutas cumplen p95 < 1000 ms sin errores" : "⚠️ Hay rutas fuera del umbral o con errores");
process.exitCode = ok ? 0 : 1;
