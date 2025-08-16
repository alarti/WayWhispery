# Documentación de la Base de Datos

Este documento describe la estructura de la base de datos PostgreSQL en Supabase, las políticas de seguridad a nivel de fila (RLS) y cómo gestionar los roles de los usuarios.

## Esquema de Tablas

El esquema completo se define en `supabase/migrations/0001_init.sql`. A continuación se resumen las tablas principales:

-   `profiles`:
    -   Almacena datos públicos de los usuarios.
    -   `id` (uuid, PK): Referencia a `auth.users.id`.
    -   `role` (text): Rol del usuario (`viewer`, `editor`, `admin`). Es la clave para los permisos.

-   `guides`:
    -   Tabla principal que contiene la información de cada guía.
    -   `slug` (text, unique): Identificador amigable para la URL.
    -   `status` (text): `draft` o `published`. Controla la visibilidad pública.
    -   `author_id` (uuid, FK): Referencia al autor de la guía.

-   `guide_sections`:
    -   Secciones de contenido de cada guía.
    -   `guide_id` (uuid, FK): Referencia a la guía a la que pertenece.
    -   `order` (int): Para ordenar las secciones.

-   `tags` y `guide_tags`:
    -   Implementan una relación muchos-a-muchos para etiquetar las guías.

-   `media`:
    -   Almacena URLs y metadatos de los archivos multimedia (ej. imágenes de portada).

## Políticas de Seguridad (Row Level Security - RLS)

RLS está habilitado en todas las tablas para garantizar que los datos solo sean accesibles por los usuarios autorizados.

-   **Principio general**:
    -   **Lectura pública**: Cualquiera (incluso usuarios anónimos) puede leer las guías con `status = 'published'` y su contenido asociado (secciones, tags, media).
    -   **Lectura de borradores**: Solo el autor de una guía o un `editor`/`admin` puede verla si está en estado `draft`.
    -   **Escritura (Crear, Actualizar, Eliminar)**: Reservada exclusivamente para usuarios con rol `editor` o `admin`. Un autor con rol `viewer` no puede editar sus propias guías una vez creadas (esto es una decisión de diseño para un control editorial centralizado).

-   **Función auxiliar `get_user_role()`**:
    -   Para simplificar las políticas, se ha creado una función SQL `get_user_role()` que obtiene de forma segura el rol del usuario autenticado actualmente. Esto evita repetir la misma subconsulta en múltiples políticas.

## Cómo Promover un Usuario a "Editor"

Por defecto, todos los nuevos usuarios tienen el rol `viewer`. Para dar permisos de edición a un usuario, un administrador debe cambiar manualmente su rol en la base de datos.

1.  **Obtener el ID del usuario**:
    -   Pídele al usuario el email con el que se registró.
    -   Ve a **Authentication** en el panel de Supabase para encontrar al usuario y copiar su `ID`.

2.  **Ejecutar la consulta SQL**:
    -   Ve a **SQL Editor** en el panel de Supabase.
    -   Ejecuta la siguiente consulta, reemplazando `<user-id-a-promover>` con el ID del usuario:

    ```sql
    UPDATE public.profiles
    SET role = 'editor'
    WHERE id = '<user-id-a-promover>';
    ```

3.  **Verificación**:
    -   El usuario deberá cerrar sesión y volver a iniciarla para que la aplicación reconozca su nuevo rol.
    -   Una vez hecho esto, verá los controles de "Crear Nueva Guía" y "Editar Guía".
