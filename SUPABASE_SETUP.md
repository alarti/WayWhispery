# Configuración de Supabase y Google OAuth para GitHub Pages

Esta guía detalla los pasos para configurar un proyecto de Supabase y habilitar la autenticación con Google, preparándolo para un despliegue en GitHub Pages.

**Requisitos previos**:
- Una cuenta de GitHub.
- Una cuenta de Google.

## 1. Crear el Proyecto en Supabase

1.  Ve a [supabase.com](https://supabase.com) y crea una nueva cuenta o inicia sesión.
2.  Crea un nuevo proyecto:
    -   **Name**: Elige un nombre para tu proyecto (ej. `alhambra-guide`).
    -   **Database Password**: Genera y guarda una contraseña segura. La necesitarás si quieres conectarte directamente a la base de datos.
    -   **Region**: Elige la región más cercana a tus usuarios.
3.  Una vez creado el proyecto, navega a **Settings** → **API**.
4.  Localiza y copia las siguientes claves. Las necesitarás para tu aplicación cliente:
    -   **Project URL**: La URL base de tu API de Supabase.
    -   **Project API Keys** → `anon` `public`: La clave anónima pública. Esta clave es segura para ser usada en el frontend.

## 2. Configurar la Autenticación con Google

Para permitir que los usuarios inicien sesión con sus cuentas de Google, debes configurar el proveedor de OAuth en Supabase y registrar tu aplicación en Google Cloud Platform.

### Paso 2.1: Habilitar el Proveedor de Google en Supabase

1.  En el panel de Supabase, ve a **Authentication** → **Providers**.
2.  Encuentra **Google** en la lista y haz clic para habilitarlo.
3.  Verás dos campos: `Client ID` y `Client Secret`. Necesitarás obtener estos valores de Google Cloud.
4.  También verás una **Redirect URL**. Cópiala, la necesitarás en el siguiente paso. Se verá algo así: `https://<tu-id-de-proyecto>.supabase.co/auth/v1/callback`.

### Paso 2.2: Crear Credenciales de OAuth en Google Cloud Platform

1.  Ve a la [Consola de Google Cloud](https://console.cloud.google.com/).
2.  Crea un nuevo proyecto o selecciona uno existente.
3.  En el menú de navegación, ve a **APIs & Services** → **Credentials**.
4.  Haz clic en **+ CREATE CREDENTIALS** y selecciona **OAuth client ID**.
5.  Si es la primera vez, tendrás que configurar la **OAuth consent screen** (pantalla de consentimiento):
    -   **User Type**: Selecciona **External**.
    -   **App name**: El nombre de tu aplicación (ej. "Guía de la Alhambra").
    -   **User support email**: Tu correo electrónico.
    -   **Authorized domains**: Añade `github.io`.
    -   **Developer contact information**: Tu correo electrónico.
    -   Guarda y continúa. En las demás pestañas (Scopes, Test users) puedes dejarlas como están por ahora.
6.  Ahora, de vuelta a la creación del **OAuth client ID**:
    -   **Application type**: Selecciona **Web application**.
    -   **Name**: Dale un nombre descriptivo (ej. "Supabase Alhambra Guide Client").
    -   En **Authorized JavaScript origins**, añade las siguientes URIs:
        -   `https://<tu-usuario-github>.github.io`
        -   `http://localhost:8080` (para desarrollo local)
    -   En **Authorized redirect URIs**, añade la **Redirect URL** que copiaste de Supabase.
7.  Haz clic en **CREATE**. Se te mostrará tu `Client ID` y `Client Secret`.

### Paso 2.3: Finalizar la Configuración en Supabase

1.  Vuelve al panel de Supabase (donde habilitaste el proveedor de Google).
2.  Pega el `Client ID` y el `Client Secret` que obtuviste de Google Cloud en los campos correspondientes.
3.  Haz clic en **Save**.

## 3. Configurar las URLs de Redirección de la Aplicación

Supabase necesita saber a qué URLs puede redirigir a los usuarios después de que se hayan autenticado correctamente.

1.  En el panel de Supabase, ve a **Authentication** → **URL Configuration**.
2.  En el campo **Redirect URLs**, añade las siguientes URLs:
    -   `https://<tu-usuario-github>.github.io/<tu-repo>/` **(¡IMPORTANTE! Incluye la barra final si tu aplicación la espera)**.
    -   `http://localhost:8080` (para desarrollo local).

## 4. Crear el Bucket de Almacenamiento

1.  En el panel de Supabase, ve a **Storage**.
2.  Haz clic en **Create a new bucket**.
3.  **Bucket name**: `guides`.
4.  **Public bucket**: Marca esta opción como **activada**. Esto permite que cualquiera pueda leer las imágenes a través de su URL pública, lo cual es ideal para contenido público como las imágenes de las guías.
5.  Haz clic en **Create bucket**.
6.  Más adelante, añadiremos políticas de seguridad para restringir la subida y modificación de archivos solo a los usuarios autorizados (rol `editor`).
