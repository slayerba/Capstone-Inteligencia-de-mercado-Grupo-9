# Documentación técnica — Enci-Intel Grupo 9

Versión 2.2 (cierre técnico actualizado al 23-11-2026). Diagramas redibujados sin cruces de líneas; requisitos separados en funcionales y no funcionales. Cubre los elementos obligatorios del instructivo Capstone (Anexo 1).

| Documento | Contenido | Requisito del instructivo |
|---|---|---|
| `Documento_Diseno_Arquitectura_EnciIntel.docx` | Diagrama, componentes, comunicación entre servicios, seguridad, despliegue, decisiones técnicas, deuda técnica | 1. Arquitectura · Documento de diseño |
| `Modelo_de_Datos_EnciIntel.docx` | Modelo documental Firestore, diccionario de datos, relaciones, evolución | 2. Modelo de datos |
| `Diagramas_UML_EnciIntel.docx` | Casos de uso, secuencia (acceso e importación), actividad, componentes, justificación de clases | 3. Diagramas UML mínimos |
| `Requisitos_No_Funcionales_EnciIntel.docx` | 15 RNF: 6 de diseño e interfaz (colores, tipografía, estados, cifras, disposición, responsive) y 9 de calidad técnica, con métrica y evidencia | 4. Requisitos no funcionales |
| `Requisitos_Funcionales_EnciIntel.docx` | 18 RF con actor, criterio de aceptación, historia y estado | Complemento (qué hace el sistema) |
| `Plan_de_Pruebas_y_Resultados_EnciIntel.docx` | Unitarias, integración, rendimiento, seguridad; resultados | 6. Pruebas |
| `Manual_Tecnico_EnciIntel.docx` | Instalación, variables, Docker, Vercel, Firebase, pruebas, solución de problemas | Manual técnico · 5. Docker |
| `Formulario_Resultados_Pruebas_Finales.docx` | Formulario que completa quien ejecuta las pruebas | Evidencia |
| `Guia_Pruebas_Finales_EnciIntel.docx` | Instructivo de pruebas finales (PF-01 a PF-10) para el equipo | Apoyo operativo |
| `Revision_Hitos_2_y_3_EnciIntel.docx` | Matriz final requisito → evidencia → estado, alineada a la presentación de auditorio | Checklist de cierre |

Docker: `enci-intel-app/Dockerfile` y `enci-intel-app/docker-compose.yml`. Innovación: sección del Informe Final.

## Criterio de transparencia
Cada resultado se marca como **APROBADO** (con evidencia), **PENDIENTE** (falta ejecutar o registrar) o **FUERA DE ALCANCE**. Nada se presenta como validado sin evidencia.

## Estado de cierre al 23-11-2026

- **PROBADO / VALIDADO:** PF-01 a PF-05, PF-08 y PF-09.
- **IMPLEMENTADO, pendiente de rerun final:** Docker/Compose (PF-07).
- **PENDIENTE:** matriz final de roles/tenants e idioma en Production (PF-10).
- Antes del merge se repiten `npm test`, `npm run test:rules`, `npm run lint` y `npm run build` sobre la rama final.
