# Cierre técnico — Enci-Intel Grupo 9

**Fecha de corte:** 23-11-2026

## Cambios finales incorporados

### Aplicación

- login rediseñado para una presentación más profesional y legible;
- se elimina la dependencia visual del modo oscuro del sistema operativo;
- se mantiene selector ES/EN;
- corrección de terminología: "competidores monitoreados" en vez de "empresas monitoreadas";
- importación explica la precondición de tener competidores en el tenant actual;
- Empresa B ya no muestra un botón aparentemente roto: si no tiene competidores se informa el motivo y se enlaza a Competidores;
- cuando existen competidores, la pantalla muestra el `competidorId`, permite copiarlo y genera plantillas CSV/JSON asociadas al tenant actual;
- mensajes de error de importación son genéricos para CSV/XLSX/JSON y no hablan de CSV cuando se sube un Excel/JSON.

### Calidad

- PF-08 Vercel: APROBADO, p95 < 1000 ms y 0 errores en todas las rutas medidas;
- PF-09 Lighthouse: 92 / 95 / 100 / 100;
- PF-01 a PF-05 permanecen aprobadas con evidencia previa;
- PF-07 y PF-10 deben repetirse sobre la rama final antes del merge.

### Documentación

- README principal reescrito con problema, solución, alcance, exclusiones, arquitectura por capas, modelo de datos, stack, importación, pruebas, Docker y demo recomendada;
- README de la app actualizado;
- Plan de Pruebas actualizado con PF-08/PF-09 y estados reales;
- RNF actualizado: RNF-10 cerrado con Vercel/Lighthouse; RNF-15 mantiene pendiente el smoke Docker final;
- Manual Técnico actualizado con el nuevo flujo de importación multitenant;
- Formulario de pruebas actualizado;
- Guía de Defensa reemplazada por versión alineada al feedback docente;
- informe final reemplazado por la versión tipo tesis solicitada;
- presentación de auditorio reemplazada por la última versión con títulos naturales.

## Mensaje técnico para la defensa

No afirmar que la aplicación usa MVC clásico. La implementación se explica como **arquitectura por capas/responsabilidades**: presentación (Next.js/React), lógica (TypeScript), identidad (Firebase Authentication), autorización/persistencia (Firestore + Security Rules), despliegue (Vercel) y portabilidad (Docker).

## Mensaje de alcance

Enci-Intel es un proyecto mayor. El Grupo 9 desarrolló la **infraestructura base multitenant**. Los agentes automáticos, RAG y otros módulos futuros quedan fuera del alcance entregado.
