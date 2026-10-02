// Datos de prueba sintéticos para Enci-Intel (Firebase enci-intel-test).
//
// Uso (desde la carpeta enci-intel-app, con .env.local completo):
//   node --env-file=.env.local scripts/datos-prueba/datos-prueba.mjs validar
//   node --env-file=.env.local scripts/datos-prueba/datos-prueba.mjs cargar
//   node --env-file=.env.local scripts/datos-prueba/datos-prueba.mjs verificar
//   node --env-file=.env.local scripts/datos-prueba/datos-prueba.mjs borrar
//
// - validar:   revisa el archivo JSON sin conectarse a Firebase.
// - cargar:    inicia sesión como superadmin y crea/actualiza los documentos.
// - verificar: inicia sesión con cualquier usuario y comprueba qué puede leer.
// - borrar:    inicia sesión como superadmin y elimina SOLO los documentos de este set.
//
// Las credenciales se piden por consola: nunca se guardan en este archivo.
// Usa el SDK web de Firebase, por lo que respeta las reglas de seguridad.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const RUTA_DATOS = new URL("./datos-prueba.json", import.meta.url);
const EMPRESAS_VALIDAS = ["empresa_a", "empresa_b"];
const ESTADOS_VALIDOS = ["activo", "inactivo"];

const datos = JSON.parse(readFileSync(RUTA_DATOS, "utf8"));
const modo = process.argv[2] ?? "validar";

// ---------- Validación del set (sin conexión) ----------

function validarDatos() {
  const errores = [];
  const ids = new Set();
  const competidores = new Map();

  for (const c of datos.competidores) {
    if (ids.has(c.id)) errores.push(`ID duplicado: ${c.id}`);
    ids.add(c.id);
    if (!EMPRESAS_VALIDAS.includes(c.empresaId)) errores.push(`${c.id}: empresaId inválido`);
    if (!ESTADOS_VALIDOS.includes(c.estado)) errores.push(`${c.id}: estado inválido`);
    if (!c.nombre?.trim()) errores.push(`${c.id}: nombre vacío`);
    competidores.set(c.id, c);
  }

  for (const p of datos.productos) {
    if (ids.has(p.id)) errores.push(`ID duplicado: ${p.id}`);
    ids.add(p.id);
    if (!competidores.has(p.competidorId)) errores.push(`${p.id}: competidorId inexistente`);
    if (!ESTADOS_VALIDOS.includes(p.estado)) errores.push(`${p.id}: estado inválido`);
    if (p.precio !== null && (typeof p.precio !== "number" || p.precio < 0)) {
      errores.push(`${p.id}: precio inválido`);
    }
    if (!p.nombre?.trim()) errores.push(`${p.id}: nombre vacío`);
  }

  const resumen = {};
  for (const empresa of EMPRESAS_VALIDAS) {
    const comps = datos.competidores.filter((c) => c.empresaId === empresa);
    const prods = datos.productos.filter((p) => competidores.get(p.competidorId)?.empresaId === empresa);
    resumen[empresa] = { competidores: comps.length, productos: prods.length };
  }

  return { errores, resumen };
}

// ---------- Conexión a Firebase ----------

async function conectar() {
  const { initializeApp } = await import("firebase/app");
  const auth = await import("firebase/auth");
  const fs = await import("firebase/firestore");

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Faltan variables NEXT_PUBLIC_FIREBASE_*. Ejecuta con: node --env-file=.env.local ..."
    );
  }
  if (config.projectId !== "enci-intel-test") {
    throw new Error(`Proyecto inesperado: ${config.projectId}. Este set es solo para enci-intel-test.`);
  }

  const app = initializeApp(config);
  return { app, auth, fs, authInstance: auth.getAuth(app), db: fs.getFirestore(app) };
}

async function iniciarSesion(conexion, etiqueta) {
  const rl = createInterface({ input, output });
  const email = (await rl.question(`Correo ${etiqueta}: `)).trim();
  const password = await rl.question("Contraseña: ");
  rl.close();

  const cred = await conexion.auth.signInWithEmailAndPassword(conexion.authInstance, email, password);
  const perfilSnap = await conexion.fs.getDoc(conexion.fs.doc(conexion.db, "users", cred.user.uid));
  if (!perfilSnap.exists()) throw new Error("El usuario no tiene perfil en users.");
  const perfil = perfilSnap.data();
  console.log(`Sesión: ${email} · rol ${perfil.rol} · empresa ${perfil.empresaId ?? "(ninguna)"}\n`);
  return perfil;
}

// ---------- Modos ----------

async function cargar() {
  const c = await conectar();
  const perfil = await iniciarSesion(c, "del superadmin");
  if (perfil.rol !== "superadmin") throw new Error("La carga debe hacerla el superadmin.");

  const { doc, setDoc, serverTimestamp } = c.fs;

  for (const comp of datos.competidores) {
    await setDoc(doc(c.db, "competidores", comp.id), { ...comp, creado_en: serverTimestamp() });
    console.log(`✔ competidor ${comp.id} · ${comp.empresaId} · ${comp.nombre}`);
  }
  for (const prod of datos.productos) {
    await setDoc(doc(c.db, "productos", prod.id), { ...prod, creado_en: serverTimestamp() });
    console.log(`✔ producto   ${prod.id} · ${prod.competidorId} · ${prod.nombre}`);
  }
  console.log(`\nCarga completa: ${datos.competidores.length} competidores y ${datos.productos.length} productos.`);
}

async function verificar() {
  const c = await conectar();
  const perfil = await iniciarSesion(c, "a verificar");
  const { collection, query, where, getDocs } = c.fs;

  const empresas = perfil.rol === "superadmin" ? EMPRESAS_VALIDAS : [perfil.empresaId];
  for (const empresa of empresas) {
    const comps = await getDocs(query(collection(c.db, "competidores"), where("empresaId", "==", empresa)));
    let totalProductos = 0;
    for (const comp of comps.docs) {
      const prods = await getDocs(query(collection(c.db, "productos"), where("competidorId", "==", comp.id)));
      totalProductos += prods.size;
    }
    console.log(`✔ ${empresa}: ${comps.size} competidores y ${totalProductos} productos visibles (incluye datos previos).`);
  }

  if (perfil.rol !== "superadmin") {
    const otra = EMPRESAS_VALIDAS.find((e) => e !== perfil.empresaId);
    try {
      await getDocs(query(collection(c.db, "competidores"), where("empresaId", "==", otra)));
      console.log(`✘ FALLA DE AISLAMIENTO: el usuario pudo leer competidores de ${otra}.`);
      process.exitCode = 1;
    } catch (err) {
      if (err.code === "permission-denied") {
        console.log(`✔ Aislamiento: lectura de ${otra} bloqueada (permission-denied).`);
      } else {
        throw err;
      }
    }
  }
}

async function borrar() {
  const c = await conectar();
  const perfil = await iniciarSesion(c, "del superadmin");
  if (perfil.rol !== "superadmin") throw new Error("El borrado debe hacerlo el superadmin.");

  const { doc, deleteDoc } = c.fs;
  for (const prod of datos.productos) {
    await deleteDoc(doc(c.db, "productos", prod.id));
    console.log(`✔ borrado producto ${prod.id}`);
  }
  for (const comp of datos.competidores) {
    await deleteDoc(doc(c.db, "competidores", comp.id));
    console.log(`✔ borrado competidor ${comp.id}`);
  }
  console.log("\nSe eliminaron solo los documentos de este set. Los datos Demo y Prueba no se tocan.");
}

// ---------- Inicio ----------

const { errores, resumen } = validarDatos();
console.log(datos.descripcion);
console.log("Resumen del set:", JSON.stringify(resumen));
if (errores.length > 0) {
  console.error("Errores en el set de datos:\n- " + errores.join("\n- "));
  process.exit(1);
}
console.log("✔ Set de datos válido.\n");

const acciones = { validar: async () => {}, cargar, verificar, borrar };
if (!acciones[modo]) {
  console.error(`Modo desconocido: ${modo}. Usa validar, cargar, verificar o borrar.`);
  process.exit(1);
}

acciones[modo]()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("Error:", err.code ?? "", err.message);
    process.exit(1);
  });
