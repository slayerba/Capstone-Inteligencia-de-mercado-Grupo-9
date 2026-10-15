import type { Idioma } from "@/lib/i18n";

export type ProductoImportado = {
  nombre: string;
  categoria: string;
  precio: number | null;
  competidorId: string;
  estado: "activo" | "inactivo";

  origen: "manual" | "web" | "integracion";
  fuenteNombre: string | null;
  fuenteUrl: string | null;
  fechaConsulta: string | null;
};

function tr(idioma: Idioma, es: string, en: string) {
  return idioma === "en" ? en : es;
}

function normalizarCabecera(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function cabeceraCanonica(valor: unknown) {
  const clave = normalizarCabecera(valor);

  const aliases: Record<string, string> = {
    nombre: "nombre",
    name: "nombre",

    categoria: "categoria",
    category: "categoria",

    precio: "precio",
    price: "precio",

    competidorid: "competidorId",
    competitorid: "competidorId",

    estado: "estado",
    status: "estado",

    origen: "origen",
    origin: "origen",
    source: "origen",

    fuentenombre: "fuenteNombre",
    sourcename: "fuenteNombre",

    fuenteurl: "fuenteUrl",
    sourceurl: "fuenteUrl",

    fechaconsulta: "fechaConsulta",
    consultationdate: "fechaConsulta",
    retrievaldate: "fechaConsulta",
    retrievedat: "fechaConsulta",
  };

  return aliases[clave] ?? clave;
}

function parsearPrecio(valor: unknown): number | null {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === "" ||
    String(valor).trim().toLowerCase() === "null"
  ) {
    return null;
  }

  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error("PRECIO_INVALIDO");
    }

    return valor;
  }

  let texto = String(valor)
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "");

  // Formato chileno: 19.990 o 19.990,50
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(texto)) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(texto)) {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);

  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error("PRECIO_INVALIDO");
  }

  return numero;
}

function normalizarOrigen(
  valor: unknown,
  numeroFila: number,
  idioma: Idioma
): "manual" | "web" | "integracion" {
  const origen = String(valor ?? "manual")
    .trim()
    .toLowerCase();

  const equivalencias: Record<
    string,
    "manual" | "web" | "integracion"
  > = {
    manual: "manual",

    web: "web",
    website: "web",

    integracion: "integracion",
    integration: "integracion",
    api: "integracion",
  };

  const normalizado = equivalencias[origen];

  if (!normalizado) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: origen debe ser manual, web o integracion.`,
        `Row ${numeroFila}: origin must be manual, web or integration.`
      )
    );
  }

  return normalizado;
}

function normalizarUrl(
  valor: unknown,
  numeroFila: number,
  idioma: Idioma
): string | null {
  const texto = String(valor ?? "").trim();

  if (!texto) {
    return null;
  }

  try {
    const url = new URL(texto);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("PROTOCOLO_INVALIDO");
    }

    return url.toString();
  } catch {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: fuenteUrl no es una URL web válida.`,
        `Row ${numeroFila}: sourceUrl is not a valid web URL.`
      )
    );
  }
}

function normalizarFechaConsulta(
  valor: unknown,
  numeroFila: number,
  idioma: Idioma
): string | null {
  const texto = String(valor ?? "").trim();

  if (!texto) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: fechaConsulta debe usar formato YYYY-MM-DD.`,
        `Row ${numeroFila}: consultationDate must use YYYY-MM-DD format.`
      )
    );
  }

  const fecha = new Date(`${texto}T00:00:00Z`);

  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== texto
  ) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: fechaConsulta no es una fecha válida.`,
        `Row ${numeroFila}: consultationDate is not a valid date.`
      )
    );
  }

  return texto;
}

function normalizarFila(
  registro: Record<string, unknown>,
  numeroFila: number,
  idioma: Idioma
): ProductoImportado {
  const normalizado: Record<string, unknown> = {};

  Object.entries(registro).forEach(([clave, valor]) => {
    normalizado[cabeceraCanonica(clave)] = valor;
  });

  const nombre = String(normalizado.nombre ?? "").trim();
  const categoria = String(normalizado.categoria ?? "").trim();
  const competidorId = String(
    normalizado.competidorId ?? ""
  ).trim();

  const origen = normalizarOrigen(
    normalizado.origen,
    numeroFila,
    idioma
  );

  const fuenteNombre =
    String(normalizado.fuenteNombre ?? "").trim() || null;

  const fuenteUrl = normalizarUrl(
    normalizado.fuenteUrl,
    numeroFila,
    idioma
  );

  const fechaConsulta = normalizarFechaConsulta(
    normalizado.fechaConsulta,
    numeroFila,
    idioma
  );

  let estado = String(normalizado.estado ?? "")
    .trim()
    .toLowerCase();

  if (estado === "active") {
    estado = "activo";
  }

  if (estado === "inactive") {
    estado = "inactivo";
  }

  if (!nombre) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: el nombre está vacío.`,
        `Row ${numeroFila}: name is empty.`
      )
    );
  }

  if (!categoria) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: la categoría está vacía.`,
        `Row ${numeroFila}: category is empty.`
      )
    );
  }

  if (!competidorId) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: competidorId está vacío.`,
        `Row ${numeroFila}: competitorId is empty.`
      )
    );
  }

  if (estado !== "activo" && estado !== "inactivo") {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: estado debe ser activo o inactivo.`,
        `Row ${numeroFila}: status must be active or inactive.`
      )
    );
  }

  if (origen === "web" && !fuenteUrl) {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: los registros de origen web deben incluir fuenteUrl.`,
        `Row ${numeroFila}: web-origin records must include sourceUrl.`
      )
    );
  }

  let precio: number | null;

  try {
    precio = parsearPrecio(normalizado.precio);
  } catch {
    throw new Error(
      tr(
        idioma,
        `Fila ${numeroFila}: el precio no es válido.`,
        `Row ${numeroFila}: price is invalid.`
      )
    );
  }

  return {
    nombre,
    categoria,
    precio,
    competidorId,
    estado: estado as "activo" | "inactivo",
    origen,
    fuenteNombre,
    fuenteUrl,
    fechaConsulta,
  };
}

function separarLineaCsv(
  linea: string,
  delimitador: string
) {
  const valores: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];

    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (
      caracter === delimitador &&
      !entreComillas
    ) {
      valores.push(actual.trim());
      actual = "";
    } else {
      actual += caracter;
    }
  }

  valores.push(actual.trim());

  return valores;
}

function parsearCsv(
  texto: string,
  idioma: Idioma
): ProductoImportado[] {
  const lineas = texto
    .replace(/\r/g, "")
    .split("\n")
    .filter((linea) => linea.trim() !== "");

  if (lineas.length < 2) {
    throw new Error(
      tr(
        idioma,
        "El CSV debe contener una cabecera y al menos un producto.",
        "The CSV must contain a header and at least one product."
      )
    );
  }

  const primeraLinea = lineas[0].replace(/^\uFEFF/, "");

  const comas = (primeraLinea.match(/,/g) ?? []).length;
  const puntoComas = (primeraLinea.match(/;/g) ?? []).length;

  const delimitador =
    puntoComas > comas ? ";" : ",";

  const cabeceras = separarLineaCsv(
    primeraLinea,
    delimitador
  );

  return lineas.slice(1).map((linea, indice) => {
    const valores = separarLineaCsv(
      linea,
      delimitador
    );

    const registro: Record<string, unknown> = {};

    cabeceras.forEach((cabecera, posicion) => {
      registro[cabecera] = valores[posicion] ?? "";
    });

    return normalizarFila(
      registro,
      indice + 2,
      idioma
    );
  });
}

function parsearJson(
  texto: string,
  idioma: Idioma
): ProductoImportado[] {
  let datos: unknown;

  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error(
      tr(
        idioma,
        "El archivo JSON no tiene un formato válido.",
        "The JSON file is not valid."
      )
    );
  }

  if (
    typeof datos === "object" &&
    datos !== null &&
    !Array.isArray(datos) &&
    Array.isArray(
      (datos as { productos?: unknown }).productos
    )
  ) {
    datos = (datos as { productos: unknown[] })
      .productos;
  }

  if (!Array.isArray(datos)) {
    throw new Error(
      tr(
        idioma,
        "El JSON debe contener un arreglo de productos.",
        "The JSON must contain an array of products."
      )
    );
  }

  return datos.map((fila, indice) => {
    if (
      typeof fila !== "object" ||
      fila === null ||
      Array.isArray(fila)
    ) {
      throw new Error(
        tr(
          idioma,
          `Elemento ${indice + 1}: formato inválido.`,
          `Item ${indice + 1}: invalid format.`
        )
      );
    }

    return normalizarFila(
      fila as Record<string, unknown>,
      indice + 1,
      idioma
    );
  });
}

async function parsearXlsx(
  archivo: File,
  idioma: Idioma
): Promise<ProductoImportado[]> {
  const { readSheet } =
    await import("read-excel-file/browser");

  const filas = await readSheet(archivo);

  if (filas.length < 2) {
    throw new Error(
      tr(
        idioma,
        "El Excel debe contener una cabecera y al menos un producto.",
        "The Excel file must contain a header and at least one product."
      )
    );
  }

  const cabeceras = filas[0];

  return filas.slice(1).map((fila, indice) => {
    const registro: Record<string, unknown> = {};

    cabeceras.forEach((cabecera, posicion) => {
      registro[String(cabecera ?? "")] =
        fila[posicion] ?? "";
    });

    return normalizarFila(
      registro,
      indice + 2,
      idioma
    );
  });
}

export async function parsearArchivoProductos(
  archivo: File,
  idioma: Idioma
): Promise<ProductoImportado[]> {
  const extension =
    archivo.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parsearCsv(
      await archivo.text(),
      idioma
    );
  }

  if (extension === "json") {
    return parsearJson(
      await archivo.text(),
      idioma
    );
  }

  if (extension === "xlsx") {
    return parsearXlsx(
      archivo,
      idioma
    );
  }

  throw new Error(
    tr(
      idioma,
      "Formato no soportado. Usa CSV, XLSX o JSON.",
      "Unsupported format. Use CSV, XLSX or JSON."
    )
  );
}
