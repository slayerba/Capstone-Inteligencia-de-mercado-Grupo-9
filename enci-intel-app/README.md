# enci-intel-app

Aplicación web del módulo de **infraestructura base multitenant de Enci-Intel** (Grupo 9). Para contexto, alcance, arquitectura, resultados y demo recomendada, ver el [README principal](../README.md).

## Inicio rápido

```powershell
npm ci
Copy-Item .env.example .env.local
# completar NEXT_PUBLIC_FIREBASE_*
npm run dev
```

Abrir `http://localhost:3000`.

## Módulos

```text
src/app/login/page.tsx         Login, idioma y contexto de la solución
src/app/dashboard/page.tsx     Resumen, competidores, productos e importación
src/lib/firebase.ts            Inicialización Firebase
src/lib/i18n.tsx               ES/EN persistido
src/lib/importar-productos.ts  Parser y validación CSV/XLSX/JSON
firebase/firestore.rules       Autorización multitenant
firebase/test-rules.mjs        Suite de seguridad
```

## Importación

- CSV, XLSX y JSON;
- máximo 450 productos;
- validación completa antes de escribir;
- batch atómico;
- cada `competidorId` se valida contra la empresa actual;
- la interfaz muestra el ID de competidor válido para el tenant;
- si el tenant aún no tiene competidores, la carga se bloquea con una explicación y acceso a la sección Competidores;
- CSV/JSON pueden descargarse desde la interfaz con el ID correcto; para XLSX se copia ese mismo ID a la columna `competidorId`.

## Pruebas

```powershell
npm test
npm run test:rules
npm run lint
npm run build
npm run test:rendimiento -- https://capstone-inteligencia-de-mercado-gr.vercel.app 200 20
```

Resultados finales registrados en `../Documentación técnica/Evidencias Pruebas Finales/`.

## Docker

```powershell
docker compose --env-file .env.local up --build -d
docker ps
curl.exe -I http://localhost:3000
docker compose down
```

Firebase no corre dentro del contenedor; Authentication y Firestore permanecen como servicios administrados externos.
