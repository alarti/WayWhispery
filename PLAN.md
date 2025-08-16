# Plan: Vanilla JS + Supabase + GH Pages

## 1. Arquitectura

El proyecto consistirá en un sitio estático servido directamente desde GitHub Pages. La arquitectura se basa en:

-   **Frontend**: HTML, CSS y JavaScript "vanilla" (ESM - Módulos de EcmaScript). No se utilizará ningún framework de compilación (como Vite, Webpack) en esta fase para mantener la simplicidad.
    -   `index.html`: Punto de entrada principal de la aplicación.
    -   `app.js`: Lógica de la aplicación, incluyendo la comunicación con Supabase.
    -   `styles.css`: Estilos para la interfaz de usuario.
    -   `404.html`: Página de fallback para rutas no encontradas en GitHub Pages.
-   **Backend (BaaS)**: Se utilizará **Supabase** para todos los servicios de backend.
    -   **Autenticación**: Login con Google (OAuth) gestionado por Supabase Auth.
    -   **Base de datos**: Postgres con políticas de seguridad a nivel de fila (RLS) para controlar el acceso a los datos.
    -   **Almacenamiento**: Supabase Storage para alojar las imágenes de las guías, con políticas de acceso para restringir la subida de archivos.
-   **Despliegue**: GitHub Actions para desplegar el sitio estático a la rama `gh-pages`.

## 2. Estructura de carpetas

```
/
├── .github/
│   └── workflows/
│       └── deploy.yml      # Workflow de despliegue a GitHub Pages
├── supabase/
│   └── migrations/
│       └── 0001_init.sql   # Esquema inicial de la BBDD y políticas RLS
├── vanilla-dist/           # Carpeta con los archivos publicables
│   ├── index.html          # HTML principal
│   ├── app.js              # Lógica principal de JS
│   ├── styles.css          # Estilos
│   └── 404.html            # Página de error 404
├── docs/                   # Documentación operativa
│   ├── README_AUTH.md
│   ├── README_DB.md
│   ├── README_STORAGE.md
│   ├── PUBLISHING.md
│   └── TROUBLESHOOTING.md
├── .env.example            # Ejemplo de variables de entorno (solo públicas)
├── PLAN.md                 # Este archivo
├── SUPABASE_SETUP.md       # Guía de configuración de Supabase
└── README.md               # README principal del nuevo proyecto
```

## 3. Flujo de usuario

1.  **Visitante anónimo**:
    -   Accede al sitio.
    -   Puede ver una lista de todas las guías publicadas (`status = 'published'`).
    -   Puede hacer clic en una guía para ver su contenido detallado (secciones, imágenes).
    -   No puede ver borradores ni acceder a las funciones de edición.
2.  **Editor (rol `editor` o `admin`)**:
    -   Accede al sitio y ve el contenido público como un visitante anónimo.
    -   Hace clic en "Continuar con Google" para iniciar sesión.
    -   Tras el login, la interfaz se actualiza para mostrar los controles de edición.
    -   Puede crear nuevas guías (que se guardan como `draft` por defecto).
    -   Puede editar las guías existentes (cambiar título, estado, subir imagen de portada).
    -   Puede añadir, editar o eliminar secciones de una guía.
    -   Puede cerrar sesión para volver al modo de visitante anónimo.

## 4. Riesgos y Mitigaciones

-   **URIs de redirección de OAuth incorrectas**:
    -   **Riesgo**: El login con Google falla si las `Authorized redirect URLs` no coinciden exactamente.
    -   **Mitigación**: Documentar claramente en `SUPABASE_SETUP.md` las URLs exactas para desarrollo (`http://localhost:8080`) y producción (`https://<usuario>.github.io/<repo>/`).
-   **Errores de CORS**:
    -   **Riesgo**: El navegador puede bloquear peticiones a la API de Supabase si no está configurado correctamente.
    -   **Mitigación**: Supabase gestiona esto por defecto, pero es importante asegurarse de que no haya configuraciones de red o proxies que interfieran.
-   **Políticas RLS mal configuradas**:
    -   **Riesgo**: Se podría filtrar información privada (guías en borrador) o permitir modificaciones no autorizadas.
    -   **Mitigación**: Probar exhaustivamente cada política desde el SQL Editor de Supabase y con pruebas manuales en la aplicación, tanto como usuario anónimo como autenticado.
-   **Manejo de rutas en GitHub Pages**:
    -   **Riesgo**: Las "rutas" dinámicas (ej. `/guide/mi-guia`) no funcionan en un sitio estático.
    -   **Mitigación**: Se usará un enfoque basado en parámetros de URL (ej. `?guide=mi-guia`) y se proporcionará un `404.html` que pueda redirigir o guiar al usuario.

## 5. Roadmap de Ramas y Criterios de Aceptación

Aunque se implementará en un solo flujo, el trabajo se estructura conceptualmente en las siguientes ramas:

1.  **`plan/vanilla-js`**: Creación de este `PLAN.md`.
2.  **`docs/supabase-setup`**: Creación de `SUPABASE_SETUP.md` y `.env.example`.
3.  **`feat/db-rls`**: Creación del esquema SQL y políticas RLS en `supabase/migrations/`.
4.  **`feat/vanilla-shell`**: Creación de la estructura base de `vanilla-dist` (HTML, CSS, JS inicial).
5.  **`feat/auth-google`**: Implementación del flujo de autenticación con Google.
6.  **`feat/data-read`**: Implementación de la lectura y visualización de guías públicas.
7.  **`feat/data-write`**: Implementación de los formularios y lógica para crear/editar guías.
8.  **`feat/storage`**: Implementación de la subida de imágenes a Supabase Storage.
9.  **`ci/gh-pages`**: Creación del workflow de despliegue a GitHub Pages.
10. **`docs/ops`**: Creación de la documentación operativa y de troubleshooting.
