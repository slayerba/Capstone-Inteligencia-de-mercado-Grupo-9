# Enci-Intel — Infraestructura Base Multitenant

**Capstone 2026 · Ingeniería en Informática · Duoc UC · Grupo 9**  
**Integrantes:** Alejandro Rojas · Gabriel Rubilar · Vicente Abarzúa

Enci-Intel es un proyecto mayor de inteligencia de mercado. El **Grupo 9** desarrolló e implementó su **infraestructura base multitenant**, dejando una plataforma web capaz de atender a varias empresas con separación de datos, autenticación, roles, seguridad, gestión de competidores y productos, importación masiva, trazabilidad de fuentes y despliegue reproducible.

**Producción:** https://capstone-inteligencia-de-mercado-gr.vercel.app  
Las credenciales de prueba se entregan por canal privado y no se versionan.

---

## 1. Problema que aborda

El monitoreo de mercado puede quedar repartido entre páginas web, planillas y registros manuales. Eso dificulta responder preguntas básicas: qué competidores se observan, qué productos tienen, de dónde proviene cada dato, cuándo fue consultado y qué precio público se observó.

Enci-Intel centraliza esa información y agrega dos controles de ingeniería esenciales:

1. **aislamiento multitenant:** cada empresa trabaja sobre sus propios datos;
2. **trazabilidad:** los registros pueden conservar origen, fuente, URL y fecha de consulta.

## 2. Alcance del Grupo 9

### Implementado

- autenticación con Firebase Authentication;
- perfiles con roles `superadmin`, `admin`, `gerencia` y `comercial`;
- separación de datos por empresa (tenant);
- Firestore Security Rules para validar aislamiento y permisos;
- gestión de competidores: alta, edición, validación, desactivación/reactivación;
- gestión de productos: alta, edición y desactivación/reactivación;
- importación masiva CSV, XLSX y JSON con validación previa;
- importación atómica con `writeBatch` (hasta 450 productos por archivo);
- plantillas de importación asociadas al competidor del tenant actual;
- Dashboard con indicadores, trazabilidad y precios públicos observados;
- interfaz ES/EN persistida;
- Vercel para Preview/Production;
- Dockerfile multi-stage y Docker Compose;
- pruebas unitarias, seguridad, integración, rendimiento y auditoría Lighthouse.

### Fuera del alcance entregado

- agentes automáticos de scraping/recolección;
- RAG o consultor veterinario;
- analítica avanzada/BI final de todo Enci-Intel;
- integración con ERP externos;
- pantalla final de administración de empresas/usuarios (actualmente se aprovisionan desde Firebase por el superadmin).

La arquitectura queda preparada para futuras integraciones con agentes externos mediante contratos de datos desacoplados. **El Grupo 9 no desarrolló esos agentes.**

---

## 3. Arquitectura por capas

La solución **no se presenta como MVC**, porque la implementación real no sigue un MVC clásico. Se organiza por responsabilidades/capas:

| Capa | Responsabilidad | Tecnología |
|---|---|---|
| Presentación | Login, Dashboard, navegación, formularios, filtros, importación e i18n | Next.js 15 · React 19 · CSS Modules |
| Lógica de aplicación | Validación de sesión/rol, reglas de importación, normalización CSV/XLSX/JSON, selección de tenant | TypeScript |
| Identidad y autorización | Identidad del usuario + autorización real por empresa/rol | Firebase Authentication + Firestore Security Rules |
| Persistencia | Empresas, usuarios, competidores y productos | Cloud Firestore |
| Despliegue | Hosting de producción y previews | Vercel |
| Portabilidad | Ejecución reproducible en contenedor | Docker + Docker Compose |

```text
Usuario
  │
  ▼
Next.js / React
  │
  ├── Firebase Authentication ──► identidad (uid)
  │
  └── Cloud Firestore
        ├── Security Rules ─────► autorización por rol/tenant
        └── datos ──────────────► empresas, users, competidores, productos

Producción: Vercel
Alternativa portable: contenedor Docker
```

La interfaz oculta acciones no permitidas, pero **el aislamiento no depende de la interfaz**: Firestore Security Rules vuelve a comprobar permisos en las operaciones de lectura/escritura.

---

## 4. Modelo de datos

```text
empresas/{empresaId}
      │ 1
      ├────────── N users/{uid}
      │              ├─ rol
      │              └─ empresaId
      │
      └────────── N competidores/{competidorId}
                         │ 1
                         └────────── N productos/{productoId}
```

### Relación multitenant

- `users/{uid}.empresaId` determina el tenant del usuario normal;
- el `superadmin` usa `empresaId = null` y selecciona el tenant;
- `competidores/{id}` guarda `empresaId`;
- los productos **no duplican `empresaId`**: derivan su tenant mediante `producto.competidorId → competidor.empresaId`.

Esto evita redundancia y reduce el riesgo de inconsistencias entre empresa y competidor.

---

## 5. Importación masiva

Formatos admitidos: **CSV · XLSX · JSON**.

Campos base:

```text
nombre, categoria, precio, competidorId, estado
```

Trazabilidad opcional:

```text
origen, fuenteNombre, fuenteUrl, fechaConsulta
```

Reglas principales:

- todas las filas se validan **antes** de escribir;
- un registro web requiere `fuenteUrl` válida;
- `fechaConsulta` usa `YYYY-MM-DD`;
- precio vacío se conserva como `null`;
- el `competidorId` debe pertenecer al tenant actual;
- máximo 450 productos por archivo;
- si una fila es inválida, el lote completo se rechaza y se informa la fila/motivo;
- si todo es válido, se escribe en un único `writeBatch`.

### Empresa A / Empresa B

La sección **Importación** ya no depende de una plantilla fija de Empresa A:

- si la empresa no tiene competidores, muestra una explicación y acceso directo a **Competidores**;
- cuando sí existen, muestra los competidores del tenant actual;
- permite copiar el `competidorId` para usarlo en XLSX;
- genera plantillas CSV/JSON con el ID correcto de la empresa seleccionada.

Esto evita mezclar IDs entre tenants y hace explícita la precondición del flujo.

---

## 6. Tecnologías

| Área | Tecnología |
|---|---|
| Aplicación web | Next.js 15.5.25 + React 19 + TypeScript |
| Autenticación | Firebase Authentication |
| Base de datos | Cloud Firestore |
| Autorización | Firestore Security Rules |
| Importación XLSX | `read-excel-file` |
| Unit testing | Vitest |
| Seguridad | Firebase Emulator + `@firebase/rules-unit-testing` |
| Hosting | Vercel |
| Contenedores | Docker Node 20 Alpine + Docker Compose |
| Control de versiones | Git + GitHub + Pull Requests |
| Metodología | Scrum (Kanban solo como visualización) |

---

## 7. Ejecutar localmente

### Requisitos

- Node.js 20.6+;
- npm;
- Git;
- 6 variables públicas de configuración Firebase en `.env.local`.

```powershell
git clone https://github.com/slayerba/Capstone-Inteligencia-de-mercado-Grupo-9.git
cd Capstone-Inteligencia-de-mercado-Grupo-9\enci-intel-app
npm ci
Copy-Item .env.example .env.local
# completar las variables NEXT_PUBLIC_FIREBASE_*
npm run dev
```

Abrir `http://localhost:3000`.

> `.env.local`, contraseñas, tokens y service accounts no se suben a Git.

---

## 8. Docker

Firebase continúa siendo un servicio externo; el contenedor ejecuta la aplicación Next.js.

```powershell
cd enci-intel-app
docker compose --env-file .env.local up --build -d
docker ps
curl.exe -I http://localhost:3000
docker compose down
```

El `Dockerfile` usa etapas separadas de dependencias, build y runtime para reducir el contenido de la imagen final.

---

## 9. Pruebas y calidad

Comandos principales:

| Comando | Verifica |
|---|---|
| `npm test` | Importador CSV/XLSX/JSON |
| `npm run test:rules` | Firestore Rules y aislamiento multitenant |
| `npm run lint` | Calidad estática con ESLint |
| `npm run build` | Build de producción Next.js |
| `npm run test:rendimiento -- <URL> 200 20` | p50/p95, errores y req/s |
| `npx lighthouse <URL> ...` | Performance, Accessibility, Best Practices y SEO |

### Resultados comprobados

| Prueba | Resultado |
|---|---|
| PF-01 Unitarias | ✅ 15/15 |
| PF-02 Firestore Security Rules | ✅ suite final ejecutada con código 0 |
| PF-03 Importación válida | ✅ 4 productos |
| PF-04 Importación inválida | ✅ lote rechazado y 0 productos nuevos |
| PF-05 Firestore + limpieza | ✅ persistencia y desactivación verificadas |
| PF-08 Vercel `/login` | ✅ p95 749 ms · 0 errores |
| PF-08 Vercel `/dashboard` | ✅ p95 373,4 ms · 0 errores |
| PF-08 Vercel archivo ejemplo | ✅ p95 254 ms · 0 errores |
| PF-09 Lighthouse | ✅ Performance 92 · Accessibility 95 · Best Practices 100 · SEO 100 |

**Criterio de rendimiento:** p95 < 1.000 ms y 0 errores.

Las corridas que dependan de credenciales/entorno local final (Docker y matriz final de roles) se registran en `Documentación técnica/Evidencias Pruebas Finales/` antes del merge definitivo.

---

## 10. Función principal para la demostración

Para la defensa se recomienda mostrar **una función completa de principio a fin**, en lugar de recorrer superficialmente toda la aplicación:

1. ingresar como `admin`;
2. verificar/crear un competidor del tenant actual;
3. ir a **Importación**;
4. copiar el `competidorId` o descargar la plantilla del tenant;
5. cargar un archivo válido;
6. comprobar el producto en la sección Productos;
7. cargar un archivo inválido y mostrar el rechazo completo del lote;
8. cambiar a otra empresa/rol y demostrar que los datos no se mezclan.

Con este flujo se evidencia interfaz, reglas de negocio, modelo de datos, persistencia, validación, seguridad y multitenancy en una sola demostración.

---

## 11. Estructura del repositorio

```text
├── enci-intel-app/
│   ├── src/app/                 login y dashboard
│   ├── src/lib/                 Firebase, i18n e importador
│   ├── firebase/                reglas + pruebas de reglas
│   ├── tests/                   unitarias, fixtures y rendimiento
│   ├── public/ejemplos/         recursos estáticos de prueba
│   ├── Dockerfile
│   └── docker-compose.yml
├── Documentación técnica/       arquitectura, modelo de datos, UML, RF/RNF, pruebas y manual
├── Scrum/                       Product Vision, Product Backlog, Sprints 1–4, DoD y evidencias
├── Fase 1/
├── Fase 2/                      informe final y evidencias académicas
└── Fase 3/                      presentación, guía de defensa y cierre
```

---

## 12. Equipo y Scrum

| Integrante | Rol |
|---|---|
| Alejandro Rojas | Scrum Master + Developer |
| Gabriel Rubilar | Product Owner + Developer |
| Vicente Abarzúa | Developer + QA / despliegue |
| Encipharm | Stakeholder externo |

El trabajo se organizó con **Scrum**. Kanban se utilizó únicamente como apoyo visual del trabajo. Los cambios se trabajan en ramas y se integran mediante Pull Request; Vercel genera Preview por PR y Production al integrar a `main`.

---

## 13. Estado de cierre

La aplicación y documentación se consideran preparadas para cierre cuando la rama final cumple simultáneamente:

- `npm test` en verde;
- `npm run test:rules` en verde;
- `npm run lint` en verde;
- `npm run build` en verde;
- prueba de importación válida/inválida registrada;
- rendimiento Vercel registrado;
- Lighthouse registrado;
- Dockerfile/Compose presentes y estado del smoke final documentado;
- matriz de roles y suite de seguridad registradas;
- README, informe, presentación y documentos técnicos actualizados;
- Pull Request revisado y mergeado a `main` sin secretos.

El estado detallado y las evidencias están en `Documentación técnica/Evidencias Pruebas Finales/`.

