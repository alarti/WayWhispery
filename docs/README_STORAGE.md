# Documentación de Almacenamiento (Storage)

Este documento detalla la configuración de Supabase Storage para gestionar las imágenes de las guías.

## Configuración del Bucket

-   **Nombre del Bucket**: `guides`
-   **Acceso Público**: El bucket está configurado como **público**.
    -   **Justificación**: Esto es necesario para que las imágenes de portada de las guías publicadas puedan ser vistas por cualquier visitante del sitio web sin necesidad de URLs firmadas (signed URLs). Simplifica enormemente la lógica del frontend.

## Estructura de Archivos

Para mantener el orden, las imágenes se suben con una ruta estructurada:

`guides/{guide_id}/{timestamp}-{nombre_sanitizado_del_archivo}`

-   `{guide_id}`: El UUID de la guía a la que pertenece la imagen. Esto mantiene todos los archivos de una guía agrupados.
-   `{timestamp}`: Un timestamp de Unix (`Date.now()`) se antepone al nombre para garantizar que cada subida sea única y evitar sobreescribir archivos si se sube una imagen con el mismo nombre.
-   `{nombre_sanitizado_del_archivo}`: El nombre original del archivo, pero "sanitizado" para eliminar caracteres problemáticos.

## Políticas de Seguridad del Bucket

Aunque el bucket es de lectura pública, la escritura (subir, modificar, eliminar) está restringida mediante políticas de almacenamiento. Estas políticas se configuran en el panel de Supabase, en **Storage → Policies**.

### 1. Política para Permitir la Subida de Archivos (INSERT)

-   **Targeted operation**: `INSERT`
-   **Policy definition**: Se utiliza una función `get_user_role()` (definida en la migración SQL) para comprobar que el usuario autenticado tiene el rol adecuado.

```sql
-- Permite la subida solo a usuarios con rol 'editor' o 'admin'
get_user_role() IN ('editor', 'admin')
```

### 2. Política para Permitir la Modificación de Archivos (UPDATE)

-   **Targeted operation**: `UPDATE`
-   **Policy definition**: La misma que para la subida.

```sql
-- Permite la actualización solo a usuarios con rol 'editor' o 'admin'
get_user_role() IN ('editor', 'admin')
```

### 3. Política para Permitir la Eliminación de Archivos (DELETE)

-   **Targeted operation**: `DELETE`
-   **Policy definition**: La misma que para la subida.

```sql
-- Permite la eliminación solo a usuarios con rol 'editor' o 'admin'
get_user_role() IN ('editor', 'admin')
```

## Recomendaciones de Uso

-   **Tamaño de las imágenes**: Se recomienda optimizar las imágenes antes de subirlas para reducir el tiempo de carga y el consumo de ancho de banda. Un tamaño inferior a 500KB por imagen es ideal para la web.
-   **Formatos**: Utilizar formatos de imagen modernos y eficientes como `.webp`, además de los tradicionales `.jpg` y `.png`. El `input` de subida en la aplicación ya está configurado para aceptar estos formatos.
