# Guía de Puesta en Producción

Este documento resume los pasos y variables de entorno necesarios para desplegar y configurar la aplicación en un entorno de producción, específicamente en GitHub Pages.

## Resumen del Proceso de Despliegue

El despliegue es automático gracias a la GitHub Action definida en `.github/workflows/deploy.yml`. Este workflow se activa en cada `push` a la rama `main` y publica el contenido de la carpeta `/vanilla-dist` en GitHub Pages.

**No se requieren secretos de CI/CD para el despliegue**, ya que las claves de Supabase son públicas y se insertan directamente en el código cliente.

## Variables y Configuraciones Requeridas

Para que la aplicación funcione correctamente en producción, debes configurar tres áreas principales: Supabase, Google Cloud y el propio código de la aplicación.

### 1. Configuración en el Código (`vanilla-dist/app.js`)

Estas son las únicas "variables" que necesitas modificar directamente en el código.

-   **`SUPABASE_URL`**: La URL de tu proyecto de Supabase.
    -   **Ejemplo**: `https://xyzabc.supabase.co`
    -   **Ubicación**: `vanilla-dist/app.js`, línea 8.
-   **`SUPABASE_ANON_KEY`**: La clave anónima (pública) de tu proyecto de Supabase.
    -   **Ejemplo**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
    -   **Ubicación**: `vanilla-dist/app.js`, línea 9.

### 2. Configuración en el Panel de Supabase

Inicia sesión en [Supabase](https://supabase.com) y navega a tu proyecto.

-   **URLs de Redirección de Autenticación**:
    -   **Propósito**: Indicar a Supabase a qué URLs puede redirigir a los usuarios después de un login exitoso.
    -   **Ubicación**: `Authentication` → `URL Configuration`.
    -   **Valor requerido para producción**: `https://<TU-USUARIO-GITHUB>.github.io/<TU-REPO>/` (incluye la barra final).
    -   **Valor para desarrollo**: `http://localhost:8080`.

-   **Políticas de Almacenamiento (Storage Policies)**:
    -   **Propósito**: Asegurar que solo los editores puedan subir o modificar imágenes.
    -   **Ubicación**: `Storage` → `Policies`.
    -   **Configuración requerida**: Debes crear políticas para las operaciones `INSERT`, `UPDATE` y `DELETE` en el bucket `guides` que restrinjan el acceso a los roles `editor` y `admin`. Consulta `docs/README_STORAGE.md` para las definiciones exactas.

### 3. Configuración en Google Cloud Platform Console

-   **Credenciales de OAuth 2.0**:
    -   **Propósito**: Permitir que tu aplicación use el sistema de login de Google.
    -   **Ubicación**: `APIs & Services` → `Credentials`.
    -   **Valores requeridos**:
        -   **Authorized JavaScript origins**:
            -   `https://<TU-USUARIO-GITHUB>.github.io`
            -   `http://localhost:8080`
        -   **Authorized redirect URIs**:
            -   La URL de callback que te proporciona Supabase en la configuración del proveedor de Google (ej. `https://xyzabc.supabase.co/auth/v1/callback`).

## Checklist de Puesta en Producción

-   [ ] Se ha creado el proyecto en Supabase.
-   [ ] Se ha copiado la URL y la clave anónima de Supabase en `vanilla-dist/app.js`.
-   [ ] Se ha ejecutado la migración SQL (`0001_init.sql`) en el editor de SQL de Supabase.
-   [ ] Se han configurado las credenciales de OAuth en Google Cloud Platform.
-   [ ] Se ha copiado el Client ID y el Client Secret de Google en la configuración del proveedor de Google en Supabase.
-   [ ] Se ha añadido la URL de producción de GitHub Pages a la lista de URLs de redirección en Supabase.
-   [ ] Se ha configurado el bucket `guides` como público en Supabase Storage.
-   [ ] Se han añadido las políticas de seguridad para el bucket `guides`.
-   [ ] Se ha configurado GitHub Pages en el repositorio para desplegar desde la rama `gh-pages`.
-   [ ] Se ha promovido al menos una cuenta de usuario al rol de `editor` para poder gestionar el contenido.
