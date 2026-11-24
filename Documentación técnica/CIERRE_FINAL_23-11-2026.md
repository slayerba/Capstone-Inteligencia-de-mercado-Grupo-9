# Cierre técnico final — Enci-Intel

**Fecha:** 23-11-2026  
**Grupo:** 9 — Ingeniería en Informática — Duoc UC

## Alcance

El Grupo 9 implementó la infraestructura base multitenant de Enci-Intel.

La solución entregada incluye autenticación, roles, separación de datos por empresa, gestión de competidores y productos, importación CSV/XLSX/JSON, trazabilidad, seguridad Firestore, dashboard y despliegue en Vercel.

Los agentes automáticos externos no forman parte del alcance desarrollado por el Grupo 9.

## Validación final

| Validación | Estado |
|---|---|
| Unitarias importador | APROBADO — 15/15 |
| Firestore Security Rules | APROBADO — suite final código 0 |
| ESLint | APROBADO |
| Build Next.js producción | APROBADO |
| CSV válido | APROBADO |
| CSV inválido | APROBADO |
| Persistencia / limpieza | APROBADO |
| Rendimiento Vercel | APROBADO |
| Lighthouse | APROBADO — 92 / 95 / 100 / 100 |
| Docker | BLOQUEADO POR ENTORNO LOCAL |
| Roles UI final | VALIDACIÓN MANUAL PARCIAL + SEGURIDAD AUTOMATIZADA |

## Rendimiento

- /login: p95 749 ms, 0 errores.
- /dashboard: p95 373,4 ms, 0 errores.
- archivo de ejemplo: p95 254 ms, 0 errores.
- criterio: p95 < 1.000 ms.

## Lighthouse

- Performance: 92
- Accessibility: 95
- Best Practices: 100
- SEO: 100

## Multitenancy

Se comprobó manualmente el funcionamiento de Empresa A y Empresa B.

Empresa B pudo crear un competidor propio y habilitar el flujo de importación utilizando un competidor perteneciente a su tenant.

Los datos de Empresa A permanecen separados de Empresa B.

La suite automática de Firestore valida adicionalmente aislamiento, escalada de privilegios, creación entre tenants y restricciones de escritura.

## Docker

Docker Desktop 29.9.3 y Docker Compose 5.7.0 están instalados.

El Dockerfile y docker-compose.yml forman parte del proyecto.

El smoke test final no pudo ejecutarse porque VirtualMachinePlatform está deshabilitado en el computador utilizado para el cierre.

No se modificó dicha característica debido a una incidencia previa de arranque de Windows. Este estado se documenta como una limitación del entorno local y no como una prueba aprobada.

## Estado de entrega

Código, documentación técnica, Scrum, informe final, presentación, evidencias y archivos de demostración quedan preparados para versionamiento final.

No se versionan contraseñas, .env.local, tokens ni credenciales privadas.
