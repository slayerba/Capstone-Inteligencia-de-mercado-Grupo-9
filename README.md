# Enci-Intel — Infraestructura Base Multitenant

**Capstone 2026 | Ingeniería en Informática | Duoc UC | Grupo 9**

Proyecto desarrollado durante la asignatura Capstone de Ingeniería en Informática de Duoc UC.

## Descripción

Enci-Intel es una plataforma de inteligencia de mercado orientada a apoyar el monitoreo de competidores, productos y otras fuentes relevantes para la toma de decisiones empresariales.

La visión general del proyecto busca que distintas organizaciones puedan definir sus propios competidores y productos de interés, para posteriormente integrar agentes especializados capaces de recopilar y procesar información desde distintas fuentes.

Dentro del proyecto general Enci-Intel existen distintos equipos de desarrollo.

El **Grupo 9** es responsable de desarrollar la **infraestructura base multitenant**, permitiendo que diferentes empresas utilicen una misma plataforma manteniendo separados sus usuarios, permisos, competidores, productos y datos.

---

## Problemática

Enci-Intel necesita evolucionar desde una solución asociada a un contexto empresarial particular hacia una plataforma que pueda ser utilizada por múltiples organizaciones.

Sin una arquitectura multitenant, incorporar una nueva empresa podría requerir configuraciones o desarrollos específicos, dificultando la escalabilidad y aumentando el riesgo de mezclar información entre organizaciones.

Por esta razón, se requiere una infraestructura que permita:

- Incorporar múltiples empresas.
- Mantener separados los datos de cada organización.
- Administrar usuarios de forma independiente.
- Definir roles y privilegios.
- Registrar competidores y productos por empresa.
- Integrar posteriormente módulos de inteligencia de mercado.

---

## Objetivo general

Diseñar e implementar la infraestructura base multitenant de Enci-Intel, permitiendo la administración independiente y segura de empresas, usuarios, roles, competidores y productos, dejando preparada la plataforma para la integración posterior de módulos y agentes de inteligencia de mercado.

---

## Objetivos específicos

- Diseñar un modelo de datos multitenant para representar empresas, usuarios, competidores y productos.
- Implementar mecanismos de autenticación y control de acceso.
- Implementar roles y privilegios para los diferentes tipos de usuarios.
- Garantizar el aislamiento lógico de información entre empresas.
- Desarrollar funcionalidades para administrar usuarios, empresas, competidores y productos.
- Construir una interfaz base de Dashboard para integrar posteriormente otros módulos.
- Desplegar un entorno de prueba utilizando Vercel.
- Realizar pruebas funcionales, de integración y seguridad sobre la infraestructura desarrollada.

---

## Alcance del Grupo 9

El Grupo 9 desarrollará la infraestructura base necesaria para que Enci-Intel pueda operar bajo un modelo multitenant.

### Dentro del alcance

- Arquitectura multitenant.
- Gestión de empresas.
- Gestión de usuarios.
- Autenticación.
- Roles y privilegios.
- Protección de rutas.
- Control de acceso.
- Separación de información mediante `empresaId`.
- Gestión de competidores.
- Gestión de productos asociados a competidores.
- Dashboard base.
- Firebase Authentication.
- Cloud Firestore.
- Despliegue en Vercel.
- Usuarios de prueba.
- Pruebas funcionales.
- Pruebas de aislamiento entre empresas.
- Preparación de interfaces para integración con otros módulos.
- Documentación técnica.

### Fuera del alcance

El Grupo 9 no desarrollará directamente:

- Motor de agentes autónomos.
- Scraping de información competitiva.
- Agentes de monitoreo de competidores.
- Agentes regulatorios asociados a SAG o Aduanas.
- Consultor Veterinario basado en inteligencia artificial.
- Sistema RAG.
- Generación automática de inteligencia de mercado.
- Contenido real generado por los agentes de los otros equipos.

Estos componentes podrán integrarse posteriormente con la infraestructura desarrollada por el Grupo 9.

---

## Arquitectura multitenant

Una arquitectura multitenant permite que múltiples organizaciones utilicen una misma aplicación manteniendo separados sus usuarios y datos.

```text
                    ENCI-INTEL
                        |
        +---------------+---------------+
        |                               |
     EMPRESA A                       EMPRESA B
      Tenant A                        Tenant B
        |                               |
   +----+---------+                +----+---------+
   |              |                |              |
Usuarios      Competidores      Usuarios      Competidores
   |              |                |              |
 Roles         Productos          Roles         Productos
