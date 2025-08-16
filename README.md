

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

1.  Abre el fichero `js/main.js`.
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
    # Inicia un servidor en el puerto 8000
    python3 -m http.server 8000
    ``
2.  Abre tu navegador y ve a `http://localhost:8000`.

**¡Importante!** Recuerda añadir `http://localhost:8000` a tus URLs de redirección en Supabase para que el login con Google funcione localmente.

## Despliegue

El despliegue en GitHub Pages está automatizado. Cada vez que se realiza un `push` a la rama `main`, una GitHub Action se encarga de publicar el contenido de la carpeta `vanilla-dist`.

Consulta la guía de publicación para más detalles
**➡️ [`docs/PUBLISHING.md`](./docs/PUBLISHING.md)**

## Documentación Adicional

-   **Autenticación**: [`docs/README_AUTH.md`](./docs/README_AUTH.md)
-   **Base de Datos y RLS**: [`docs/README_DB.md`](./docs/README_DB.md)
-   **Almacenamiento**: [`docs/README_STORAGE.md`](./docs/README_STORAGE.md)
-   **Resolución de Problemas**: [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)

## Database Schema

The application uses a Supabase backend. The database schema is defined in `supabase/migrations/0001_init.sql`. Here is a breakdown of the tables and their fields:

### `profiles`

This table stores public user data, including their role.

- `id` (uuid, primary key): References `auth.users(id)`.
- `email` (text, unique): The user's email address.
- `role` (text, default: 'viewer'): The user's role, which can be `viewer`, `editor`, or `admin`.
- `created_at` (timestamptz): The timestamp of when the profile was created.
- `updated_at` (timestamptz): The timestamp of the last profile update.

### `guides`

This table contains the main information for each guide.

- `id` (uuid, primary key): A unique identifier for the guide.
- `slug` (text, unique): A user-friendly URL slug for the guide.
- `title` (text): The title of the guide.
- `summary` (text): A short summary of the guide.
- `language` (text): The language of the guide.
- `cover_url` (text): A URL for the guide's cover image.
- `status` (text, default: 'draft'): The status of the guide, which can be `draft` or `published`.
- `author_id` (uuid): References the `id` of the author in the `auth.users` table.
- `created_at` (timestamptz): The timestamp of when the guide was created.
- `updated_at` (timestamptz): The timestamp of the last guide update.

### `guide_sections`

This table stores the content sections of a guide in order.

- `id` (uuid, primary key): A unique identifier for the section.
- `guide_id` (uuid): References the `id` of the guide this section belongs to.
- `order` (integer, default: 0): The order in which the section appears in the guide.
- `title` (text): The title of the section.
- `body_md` (text): The content of the section in Markdown format.

### `tags`

This table defines the tags that can be associated with guides.

- `id` (uuid, primary key): A unique identifier for the tag.
- `name` (text, unique): The name of the tag.
- `slug` (text, unique): A user-friendly URL slug for the tag.

### `guide_tags`

This is a join table for the many-to-many relationship between guides and tags.

- `guide_id` (uuid): References the `id` of the guide.
- `tag_id` (uuid): References