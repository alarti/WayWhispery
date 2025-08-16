# Alhambra Guide - Versión Vanilla JS + Supabase

Este proyecto es una versión "solo frontend" de la aplicación Alhambra Guide, diseñada para ser desplegada como un sitio estático en plataformas como GitHub Pages. Utiliza HTML, CSS y JavaScript "vanilla" (sin frameworks de compilación) y se conecta directamente a [Supabase](https://supabase.com) para la autenticación, base de datos y almacenamiento de archivos.

La versión original, una PWA con funcionalidades de mapa interactivo, se ha conservado en el fichero `README_PWA.md`.

## Características

-   **Sitio Estático**: Rápido, seguro y fácil de desplegar.
-   **Backend con Supabase**:
    -   **Autenticación**: Login con Google (OAuth).
    -   **Base de Datos**: PostgreSQL con políticas de seguridad a nivel de fila (RLS).
    -   **Almacenamiento**: Gestión de imágenes de portada para las guías.
-   **Roles de Usuario**:
    -   **Visitante (anónimo)**: Puede ver todas las guías publicadas.
    -   **Viewer (registrado)**: Rol base para usuarios autenticados.
    -   **Editor/Admin**: Puede crear, editar, publicar y eliminar guías.
-   **Despliegue Continuo**: Automatizado con GitHub Actions para publicar en GitHub Pages.

## Cómo Ponerlo en Marcha

### 1. Configuración de Supabase

Necesitarás una cuenta de Supabase para actuar como backend. Sigue las instrucciones detalladas en la guía de configuración:

**➡️ [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)**

Esta guía te explicará cómo:
- Crear un proyecto en Supabase.
- Obtener tu URL y tu clave `anon` pública.
- Configurar la autenticación con Google OAuth.
- Crear el bucket de almacenamiento.

### 2. Aplicar las Migraciones de Base de Datos

Una vez creado tu proyecto de Supabase, necesitas crear las tablas y políticas de seguridad.

1.  Copia el contenido del fichero `supabase/migrations/0001_init.sql`.
2.  Ve a tu panel de Supabase, entra en el **SQL Editor**.
3.  Pega el contenido del script y haz clic en **"RUN"**.

### 3. Configurar las Claves en la Aplicación

La aplicación cliente necesita conocer la URL y la clave anónima de tu proyecto de Supabase.

1.  Abre el fichero `vanilla-dist/app.js`.
2.  Busca las siguientes líneas al principio del fichero:
    ```javascript
    const SUPABASE_URL = 'https://<ID-DE-PROYECTO-SUPABASE>.supabase.co';
    const SUPABASE_ANON_KEY = '<TU-CLAVE-ANON-PUBLICA>';
    ```
3.  Reemplaza los valores de los placeholders con tu propia URL y clave anónima que obtuviste en el primer paso.

### 4. Ejecutar Localmente

Para probar el sitio en tu máquina local:

1.  Necesitas un servidor web simple para servir los ficheros estáticos. Si tienes Python instalado, puedes usar:
    ```bash
    # Navega a la carpeta raíz del proyecto
    cd /ruta/a/Alhambra-guide
    # Inicia un servidor en la carpeta vanilla-dist en el puerto 8080
    python3 -m http.server 8080 --directory vanilla-dist
    ```
2.  Abre tu navegador y ve a `http://localhost:8080`.

**¡Importante!** Recuerda añadir `http://localhost:8080` a tus URLs de redirección en Supabase para que el login con Google funcione localmente.

## Despliegue

El despliegue en GitHub Pages está automatizado. Cada vez que se realiza un `push` a la rama `main`, una GitHub Action se encarga de publicar el contenido de la carpeta `vanilla-dist`.

Consulta la guía de publicación para más detalles:
**➡️ [`docs/PUBLISHING.md`](./docs/PUBLISHING.md)**

## Documentación Adicional

-   **Autenticación**: [`docs/README_AUTH.md`](./docs/README_AUTH.md)
-   **Base de Datos y RLS**: [`docs/README_DB.md`](./docs/README_DB.md)
-   **Almacenamiento**: [`docs/README_STORAGE.md`](./docs/README_STORAGE.md)
-   **Resolución de Problemas**: [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)
