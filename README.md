# Enci-Intel â€” Infraestructura Base Multitenant

**Capstone 2026 Â· IngenierÃ­a en InformÃ¡tica Â· Duoc UC Â· Grupo 9**  
**Integrantes:** Alejandro Rojas Â· Gabriel Rubilar Â· Vicente AbarzÃºa

Enci-Intel es un proyecto mayor de inteligencia de mercado. El **Grupo 9** desarrollÃ³ e implementÃ³ su **infraestructura base multitenant**, dejando una plataforma web capaz de atender a varias empresas con separaciÃ³n de datos, autenticaciÃ³n, roles, seguridad, gestiÃ³n de competidores y productos, importaciÃ³n masiva, trazabilidad de fuentes y despliegue reproducible.

**ProducciÃ³n:** https://capstone-inteligencia-de-mercado-gr.vercel.app  
Las credenciales de prueba se entregan por canal privado y no se versionan.

---

## 1. Problema que aborda

El monitoreo de mercado puede quedar repartido entre pÃ¡ginas web, planillas y registros manuales. Eso dificulta responder preguntas bÃ¡sicas: quÃ© competidores se observan, quÃ© productos tienen, de dÃ³nde proviene cada dato, cuÃ¡ndo fue consultado y quÃ© precio pÃºblico se observÃ³.

Enci-Intel centraliza esa informaciÃ³n y agrega dos controles de ingenierÃ­a esenciales:

1. **aislamiento multitenant:** cada empresa trabaja sobre sus propios datos;
2. **trazabilidad:** los registros pueden conservar origen, fuente, URL y fecha de consulta.

## 2. Alcance del Grupo 9

### Implementado

- autenticaciÃ³n con Firebase Authentication;
- perfiles con roles `superadmin`, `admin`, `gerencia` y `comercial`;
- separaciÃ³n de datos por empresa (tenant);
- Firestore Security Rules para validar aislamiento y permisos;
- gestiÃ³n de competidores: alta, ediciÃ³n, validaciÃ³n, desactivaciÃ³n/reactivaciÃ³n;
- gestiÃ³n de productos: alta, ediciÃ³n y desactivaciÃ³n/reactivaciÃ³n;
- importaciÃ³n masiva CSV, XLSX y JSON con validaciÃ³n previa;
- importaciÃ³n atÃ³mica con `writeBatch` (hasta 450 productos por archivo);
- plantillas de importaciÃ³n asociadas al competidor del tenant actual;
- Dashboard con indicadores, trazabilidad y precios pÃºblicos observados;
- interfaz ES/EN persistida;
- Vercel para Preview/Production;
- Dockerfile multi-stage y Docker Compose;
- pruebas unitarias, seguridad, integraciÃ³n, rendimiento y auditorÃ­a Lighthouse.

### Fuera del alcance entregado

- agentes automÃ¡ticos de scraping/recolecciÃ³n;
- RAG o consultor veterinario;
- analÃ­tica avanzada/BI final de todo Enci-Intel;
- integraciÃ³n con ERP externos;
- pantalla final de administraciÃ³n de empresas/usuarios (actualmente se aprovisionan desde Firebase por el superadmin).

La arquitectura queda preparada para futuras integraciones con agentes externos mediante contratos de datos desacoplados. **El Grupo 9 no desarrollÃ³ esos agentes.**

---

## 3. Arquitectura por capas

La soluciÃ³n **no se presenta como MVC**, porque la implementaciÃ³n real no sigue un MVC clÃ¡sico. Se organiza por responsabilidades/capas:

| Capa | Responsabilidad | TecnologÃ­a |
|---|---|---|
| PresentaciÃ³n | Login, Dashboard, navegaciÃ³n, formularios, filtros, importaciÃ³n e i18n | Next.js 15 Â· React 19 Â· CSS Modules |
| LÃ³gica de aplicaciÃ³n | ValidaciÃ³n de sesiÃ³n/rol, reglas de importaciÃ³n, normalizaciÃ³n CSV/XLSX/JSON, selecciÃ³n de tenant | TypeScript |
| Identidad y autorizaciÃ³n | Identidad del usuario + autorizaciÃ³n real por empresa/rol | Firebase Authentication + Firestore Security Rules |
| Persistencia | Empresas, usuarios, competidores y productos | Cloud Firestore |
| Despliegue | Hosting de producciÃ³n y previews | Vercel |
| Portabilidad | EjecuciÃ³n reproducible en contenedor | Docker + Docker Compose |

```text
Usuario
  â”‚
  â–¼
Next.js / React
  â”‚
  â”œâ”€â”€ Firebase Authentication â”€â”€â–º identidad (uid)
  â”‚
  â””â”€â”€ Cloud Firestore
        â”œâ”€â”€ Security Rules â”€â”€â”€â”€â”€â–º autorizaciÃ³n por rol/tenant
        â””â”€â”€ datos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º empresas, users, competidores, productos

ProducciÃ³n: Vercel
Alternativa portable: contenedor Docker
```

La interfaz oculta acciones no permitidas, pero **el aislamiento no depende de la interfaz**: Firestore Security Rules vuelve a comprobar permisos en las operaciones de lectura/escritura.

---

## 4. Modelo de datos

```text
empresas/{empresaId}
      â”‚ 1
      â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ N users/{uid}
      â”‚              â”œâ”€ rol
      â”‚              â””â”€ empresaId
      â”‚
      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ N competidores/{competidorId}
                         â”‚ 1
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ N productos/{productoId}
```

### RelaciÃ³n multitenant

- `users/{uid}.empresaId` determina el tenant del usuario normal;
- el `superadmin` usa `empresaId = null` y selecciona el tenant;
- `competidores/{id}` guarda `empresaId`;
- los productos **no duplican `empresaId`**: derivan su tenant mediante `producto.competidorId â†’ competidor.empresaId`.

Esto evita redundancia y reduce el riesgo de inconsistencias entre empresa y competidor.

---

## 5. ImportaciÃ³n masiva

Formatos admitidos: **CSV Â· XLSX Â· JSON**.

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
- un registro web requiere `fuenteUrl` vÃ¡lida;
- `fechaConsulta` usa `YYYY-MM-DD`;
- precio vacÃ­o se conserva como `null`;
- el `competidorId` debe pertenecer al tenant actual;
- mÃ¡ximo 450 productos por archivo;
- si una fila es invÃ¡lida, el lote completo se rechaza y se informa la fila/motivo;
- si todo es vÃ¡lido, se escribe en un Ãºnico `writeBatch`.

### Empresa A / Empresa B

La secciÃ³n **ImportaciÃ³n** ya no depende de una plantilla fija de Empresa A:

- si la empresa no tiene competidores, muestra una explicaciÃ³n y acceso directo a **Competidores**;
- cuando sÃ­ existen, muestra los competidores del tenant actual;
- permite copiar el `competidorId` para usarlo en XLSX;
- genera plantillas CSV/JSON con el ID correcto de la empresa seleccionada.

Esto evita mezclar IDs entre tenants y hace explÃ­cita la precondiciÃ³n del flujo.

---

## 6. TecnologÃ­as

| Ãrea | TecnologÃ­a |
|---|---|
| AplicaciÃ³n web | Next.js 15.5.25 + React 19 + TypeScript |
| AutenticaciÃ³n | Firebase Authentication |
| Base de datos | Cloud Firestore |
| AutorizaciÃ³n | Firestore Security Rules |
| ImportaciÃ³n XLSX | `read-excel-file` |
| Unit testing | Vitest |
| Seguridad | Firebase Emulator + `@firebase/rules-unit-testing` |
| Hosting | Vercel |
| Contenedores | Docker Node 20 Alpine + Docker Compose |
| Control de versiones | Git + GitHub + Pull Requests |
| MetodologÃ­a | Scrum (Kanban solo como visualizaciÃ³n) |

---

## 7. Ejecutar localmente

### Requisitos

- Node.js 20.6+;
- npm;
- Git;
- 6 variables pÃºblicas de configuraciÃ³n Firebase en `.env.local`.

```powershell
git clone https://github.com/slayerba/Capstone-Inteligencia-de-mercado-Grupo-9.git
cd Capstone-Inteligencia-de-mercado-Grupo-9\enci-intel-app
npm ci
Copy-Item .env.example .env.local
# completar las variables NEXT_PUBLIC_FIREBASE_*
npm run dev
```

Abrir `http://localhost:3000`.

> `.env.local`, contraseÃ±as, tokens y service accounts no se suben a Git.

---

## 8. Docker

Firebase continÃºa siendo un servicio externo; el contenedor ejecuta la aplicaciÃ³n Next.js.

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
| `npm run lint` | Calidad estÃ¡tica con ESLint |
| `npm run build` | Build de producciÃ³n Next.js |
| `npm run test:rendimiento -- <URL> 200 20` | p50/p95, errores y req/s |
| `npx lighthouse <URL> ...` | Performance, Accessibility, Best Practices y SEO |

### Resultados comprobados

| Prueba | Resultado |
|---|---|
| PF-01 Unitarias | âœ… 15/15 |
| PF-02 Firestore Security Rules | âœ… suite final ejecutada con cÃ³digo 0 |
| PF-03 ImportaciÃ³n vÃ¡lida | âœ… 4 productos |
| PF-04 ImportaciÃ³n invÃ¡lida | âœ… lote rechazado y 0 productos nuevos |
| PF-05 Firestore + limpieza | âœ… persistencia y desactivaciÃ³n verificadas |
| PF-08 Vercel `/login` | âœ… p95 749 ms Â· 0 errores |
| PF-08 Vercel `/dashboard` | âœ… p95 373,4 ms Â· 0 errores |
| PF-08 Vercel archivo ejemplo | âœ… p95 254 ms Â· 0 errores |
| PF-09 Lighthouse | âœ… Performance 92 Â· Accessibility 95 Â· Best Practices 100 Â· SEO 100 |

**Criterio de rendimiento:** p95 < 1.000 ms y 0 errores.

Las corridas que dependan de credenciales/entorno local final (Docker y matriz final de roles) se registran en `DocumentaciÃ³n tÃ©cnica/Evidencias Pruebas Finales/` antes del merge definitivo.

---

## 10. FunciÃ³n principal para la demostraciÃ³n

Para la defensa se recomienda mostrar **una funciÃ³n completa de principio a fin**, en lugar de recorrer superficialmente toda la aplicaciÃ³n:

1. ingresar como `admin`;
2. verificar/crear un competidor del tenant actual;
3. ir a **ImportaciÃ³n**;
4. copiar el `competidorId` o descargar la plantilla del tenant;
5. cargar un archivo vÃ¡lido;
6. comprobar el producto en la secciÃ³n Productos;
7. cargar un archivo invÃ¡lido y mostrar el rechazo completo del lote;
8. cambiar a otra empresa/rol y demostrar que los datos no se mezclan.

Con este flujo se evidencia interfaz, reglas de negocio, modelo de datos, persistencia, validaciÃ³n, seguridad y multitenancy en una sola demostraciÃ³n.

---

## 11. Estructura del repositorio

```text
â”œâ”€â”€ enci-intel-app/
â”‚   â”œâ”€â”€ src/app/                 login y dashboard
â”‚   â”œâ”€â”€ src/lib/                 Firebase, i18n e importador
â”‚   â”œâ”€â”€ firebase/                reglas + pruebas de reglas
â”‚   â”œâ”€â”€ tests/                   unitarias, fixtures y rendimiento
â”‚   â”œâ”€â”€ public/ejemplos/         recursos estÃ¡ticos de prueba
â”‚   â”œâ”€â”€ Dockerfile
â”‚   â””â”€â”€ docker-compose.yml
â”œâ”€â”€ DocumentaciÃ³n tÃ©cnica/       arquitectura, modelo de datos, UML, RF/RNF, pruebas y manual
â”œâ”€â”€ Scrum/                       Product Vision, Product Backlog, Sprints 1â€“4, DoD y evidencias
â”œâ”€â”€ Fase 1/
â”œâ”€â”€ Fase 2/                      informe final y evidencias acadÃ©micas
â””â”€â”€ Fase 3/                      presentaciÃ³n, guÃ­a de defensa y cierre
```

---

## 12. Equipo y Scrum

| Integrante | Rol |
|---|---|
| Alejandro Rojas | Scrum Master + Developer |
| Gabriel Rubilar | Product Owner + Developer |
| Vicente AbarzÃºa | Developer + QA / despliegue |
| Encipharm | Stakeholder externo |

El trabajo se organizÃ³ con **Scrum**. Kanban se utilizÃ³ Ãºnicamente como apoyo visual del trabajo. Los cambios se trabajan en ramas y se integran mediante Pull Request; Vercel genera Preview por PR y Production al integrar a `main`.

---

## 13. Estado de cierre

La aplicaciÃ³n y documentaciÃ³n se consideran preparadas para cierre cuando la rama final cumple simultÃ¡neamente:

- `npm test` en verde;
- `npm run test:rules` en verde;
- `npm run lint` en verde;
- `npm run build` en verde;
- prueba de importaciÃ³n vÃ¡lida/invÃ¡lida registrada;
- rendimiento Vercel registrado;
- Lighthouse registrado;
- Dockerfile/Compose presentes y estado del smoke final documentado;
- matriz de roles y suite de seguridad registradas;
- README, informe, presentaciÃ³n y documentos tÃ©cnicos actualizados;
- Pull Request revisado y mergeado a `main` sin secretos.

El estado detallado y las evidencias estÃ¡n en `DocumentaciÃ³n tÃ©cnica/Evidencias Pruebas Finales/`.

