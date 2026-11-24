# Estado de pruebas finales — corte 23-11-2026

## PROBADO / VALIDADO

- **PF-01 Unitarias:** 15/15 aprobadas.
- **PF-02 Firestore Security Rules:** suite multitenant finalizada correctamente (código 0).
- **PF-03 Importación válida:** 4 productos importados.
- **PF-04 Importación inválida:** lote rechazado en fila 2 y 0 productos nuevos.
- **PF-05 Persistencia/limpieza:** competidorId verificado y set de prueba dejado inactivo.
- **PF-08 Rendimiento Vercel:** 200 peticiones por ruta, concurrencia 20; `/login` p95 749 ms, `/dashboard` p95 373,4 ms, archivo ejemplo p95 254 ms; 0 errores.
- **PF-09 Lighthouse:** Performance 92, Accessibility 95, Best Practices 100, SEO 100.

## IMPLEMENTADO, PENDIENTE DE RERUN FINAL

- **PF-07 Docker:** Dockerfile y Compose implementados; build/runtime históricos aprobados. Falta repetir el smoke sobre la rama final: build, `curl`/redirect, login real, lectura y una escritura/desactivación.
- **PF-10 Roles:** aislamiento/roles fueron validados históricamente; falta la repetición final en Production con superadmin, admin tenant A, admin tenant B, gerencia y comercial.

## REGLA DE CIERRE

No marcar PF-07 ni PF-10 como aprobadas hasta guardar evidencia actual de la rama final. Antes del merge ejecutar además:

```powershell
npm test
npm run test:rules
npm run lint
npm run build
```

El README, guía de defensa y documentos técnicos ya reflejan PF-08/PF-09 y el flujo de importación multitenant corregido.
