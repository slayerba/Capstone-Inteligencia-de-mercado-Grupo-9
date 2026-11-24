# Fase 3 — Presentación del Proyecto APT

## Archivos finales

| Archivo | Uso |
|---|---|
| `Presentacion_Final_EnciIntel_Grupo9_Auditorio.pptx` | Presentación principal para la defensa en auditorio. Usa títulos naturales y estructura de 15 diapositivas de contenido. |
| `Guia_Defensa_EnciIntel_Grupo9.docx` | Guía final actualizada con feedback docente del 23-11-2026, reparto, demo completa, arquitectura por capas, preguntas y checklist. |

## Reparto acordado

Las diapositivas de contenido se reparten en bloques de cinco:

- **Alejandro:** 1–5.
- **Gabriel:** 6–10.
- **Vicente:** 11–15.

Portada, cierre y anexos/evidencias no se consideran dentro de esos bloques.

## Feedback docente incorporado

La defensa debe:

1. explicar el problema y decir directamente qué construyó el Grupo 9;
2. definir qué hace y qué no hace la solución;
3. mostrar arquitectura, modelo de datos y stack por capas;
4. no presentar un patrón que no existe: la solución se explica como arquitectura por responsabilidades/capas, no como MVC clásico;
5. reservar los últimos minutos para una función completa del MVP;
6. usar la importación validada como demo principal: tenant → competidor → plantilla/ID → archivo válido → persistencia → archivo inválido → aislamiento;
7. recordar que Enci-Intel es un proyecto mayor y que el Grupo 9 implementó la infraestructura base multitenant.

## Antes de la defensa

- ejecutar PF-07 Docker y PF-10 roles sobre la rama final;
- comprobar `npm test`, `npm run test:rules`, `npm run lint` y `npm run build`;
- verificar la URL de Production y las cuentas de prueba;
- dejar Empresa B con al menos un competidor si se demostrará importación en ese tenant;
- grabar el video de respaldo sin mostrar credenciales ni `.env.local`;
- ensayar con cronómetro.
