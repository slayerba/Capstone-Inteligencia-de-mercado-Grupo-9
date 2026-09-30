import fs from "node:fs";

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";

const testEnv = await initializeTestEnvironment({
  projectId: "enci-intel-test",
  firestore: {
    rules: fs.readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080
  }
});

// Datos de prueba
await testEnv.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();

  await setDoc(doc(db, "empresas/empresa_a"), {
    id: "empresa_a",
    nombre: "Empresa A",
    estado: "activo"
  });

  await setDoc(doc(db, "empresas/empresa_b"), {
    id: "empresa_b",
    nombre: "Empresa B",
    estado: "activo"
  });

  await setDoc(doc(db, "users/uid-a"), {
    id: "uid-a",
    email: "admin@empresa-a.test",
    rol: "admin",
    empresaId: "empresa_a",
    estado: "activo"
  });

  await setDoc(doc(db, "users/uid-b"), {
    id: "uid-b",
    email: "admin@empresa-b.test",
    rol: "admin",
    empresaId: "empresa_b",
    estado: "activo"
  });

  await setDoc(doc(db, "competidores/competidor_a_01"), {
    id: "competidor_a_01",
    nombre: "Competidor Demo A",
    tipo: "empresa",
    empresaId: "empresa_a",
    estado: "activo"
  });

  await setDoc(doc(db, "competidores/competidor_b_01"), {
    id: "competidor_b_01",
    nombre: "Competidor Demo B",
    tipo: "empresa",
    empresaId: "empresa_b",
    estado: "activo"
  });

  await setDoc(doc(db, "productos/producto_a_01"), {
    id: "producto_a_01",
    nombre: "Producto Demo A",
    categoria: "demo",
    competidorId: "competidor_a_01",
    estado: "activo"
  });

  await setDoc(doc(db, "productos/producto_b_01"), {
    id: "producto_b_01",
    nombre: "Producto Demo B",
    categoria: "demo",
    competidorId: "competidor_b_01",
    estado: "activo"
  });
});

const dbA = testEnv.authenticatedContext("uid-a").firestore();
const dbB = testEnv.authenticatedContext("uid-b").firestore();

async function prueba(nombre, operacion, debeFuncionar) {
  try {
    if (debeFuncionar) {
      await assertSucceeds(operacion);
    } else {
      await assertFails(operacion);
    }

    console.log(`✅ ${nombre}`);
  } catch (error) {
    console.log(`❌ ${nombre}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// EMPRESA A
await prueba(
  "Admin A puede leer Empresa A",
  getDoc(doc(dbA, "empresas/empresa_a")),
  true
);

await prueba(
  "Admin A NO puede leer Empresa B",
  getDoc(doc(dbA, "empresas/empresa_b")),
  false
);

// COMPETIDORES
await prueba(
  "Admin A puede leer Competidor A",
  getDoc(doc(dbA, "competidores/competidor_a_01")),
  true
);

await prueba(
  "Admin A NO puede leer Competidor B",
  getDoc(doc(dbA, "competidores/competidor_b_01")),
  false
);

// PRODUCTOS
await prueba(
  "Admin A puede leer Producto A",
  getDoc(doc(dbA, "productos/producto_a_01")),
  true
);

await prueba(
  "Admin A NO puede leer Producto B",
  getDoc(doc(dbA, "productos/producto_b_01")),
  false
);

// EMPRESA B
await prueba(
  "Admin B puede leer Empresa B",
  getDoc(doc(dbB, "empresas/empresa_b")),
  true
);

await prueba(
  "Admin B NO puede leer Empresa A",
  getDoc(doc(dbB, "empresas/empresa_a")),
  false
);

// ESCALADA DE PRIVILEGIOS
await prueba(
  "Admin A NO puede convertirse en superadmin",
  updateDoc(doc(dbA, "users/uid-a"), {
    rol: "superadmin"
  }),
  false
);

await prueba(
  "Admin A NO puede cambiarse a Empresa B",
  updateDoc(doc(dbA, "users/uid-a"), {
    empresaId: "empresa_b"
  }),
  false
);

await testEnv.cleanup();

console.log("");
console.log("================================");
console.log("PRUEBAS MULTITENANT FINALIZADAS");
console.log("================================");
