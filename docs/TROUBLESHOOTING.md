# Guía de Resolución de Problemas (Troubleshooting)

Esta guía documenta errores comunes que pueden surgir durante la configuración o el uso de la aplicación y cómo solucionarlos.

---

### Error: El login con Google falla o redirige a una página de error de Supabase.

-   **Síntoma**: Después de autenticarse en Google, no se vuelve a la aplicación, sino que aparece un error como "invalid redirect_uri" o similar.
-   **Causa más probable**: La URL a la que Supabase intenta redirigir al usuario no está en la lista blanca de tu proyecto.
-   **Solución**:
    1.  Ve a tu panel de Supabase: **Authentication → URL Configuration**.
    2.  En el campo `Redirect URLs`, asegúrate de que estén presentes las URLs **exactas** de tu aplicación.
    3.  **Para producción**: `https://<tu-usuario-github>.github.io/<tu-repo>/` (¡no olvides la barra `/` al final!).
    4.  **Para desarrollo**: `http://localhost:8080` (o el puerto que estés usando).
    5.  Asegúrate de que no haya erratas ni espacios extra.

---

### Error: "Permission denied" al intentar guardar o editar una guía.

-   **Síntoma**: Un `alert()` en la aplicación muestra un mensaje de error que contiene "permission denied" o "violates row-level security policy".
-   **Causa**: El usuario que realiza la acción no tiene el rol (`editor` o `admin`) requerido por las políticas RLS de la tabla (`guides`, `guide_sections`, etc.).
-   **Solución**:
    1.  Verifica el rol del usuario en la interfaz de la aplicación (se muestra junto a su email).
    2.  Si el rol es `viewer`, necesitas promoverlo a `editor`.
    3.  Sigue las instrucciones en `docs/README_DB.md` para actualizar el rol del usuario en la base de datos mediante una consulta SQL.
    4.  El usuario deberá cerrar y volver a iniciar sesión para que los cambios surtan efecto.

---

### Error: Las imágenes no se cargan o la subida de imágenes falla.

-   **Síntoma 1**: Las imágenes de las guías publicadas aparecen rotas.
    -   **Causa**: El bucket `guides` en Supabase Storage no es público.
    -   **Solución**: Ve a **Storage** en tu panel de Supabase, selecciona el bucket `guides`, ve a **Bucket settings** y haz clic en **"Make public"**.

-   **Síntoma 2**: Falla la subida de una imagen al editar una guía.
    -   **Causa**: Las políticas de seguridad del bucket no están configuradas correctamente para permitir la escritura.
    -   **Solución**:
        1.  Ve a **Storage → Policies**.
        2.  Asegúrate de que existen políticas para la operación `INSERT` (y `UPDATE`/`DELETE`) en el bucket `guides`.
        3.  La política debe permitir la acción a los roles `editor` y `admin`. Consulta `docs/README_STORAGE.md` para ver la definición exacta de la política.

---

### Error: Error de CORS en la consola del navegador.

-   **Síntoma**: La consola del navegador muestra errores de `CORS policy` al intentar hacer peticiones a la API de Supabase.
-   **Causa**: La URL desde la que se ejecuta la aplicación no está configurada en la configuración de CORS de Supabase.
-   **Solución**:
    1.  Por defecto, Supabase es bastante permisivo, pero si has modificado la configuración, necesitarás ajustarla.
    2.  Ve a tu panel de Supabase: **Project Settings → API**.
    3.  En la sección `CORS Configuration`, asegúrate de que `*` está presente o añade explícitamente el origen de tu aplicación (ej. `https://<tu-usuario-github>.github.io`).

---

### Problema: El sitio en GitHub Pages muestra un 404 o una página en blanco.

-   **Síntoma**: Al navegar a `https://<usuario>.github.io/<repo>/`, no se carga el contenido esperado.
-   **Causa 1**: El workflow de despliegue no se ha ejecutado o ha fallado.
    -   **Solución**: Ve a la pestaña **Actions** de tu repositorio. Busca el último workflow "Deploy to GitHub Pages" y comprueba si se ha completado con éxito. Si ha fallado, revisa los logs para ver el error.

-   **Causa 2**: La configuración de GitHub Pages no apunta a la rama correcta.
    -   **Solución**: Ve a **Settings → Pages** en tu repositorio. Asegúrate de que la fuente de despliegue (`Source`) está configurada como **"Deploy from a branch"** y que la rama seleccionada es `gh-pages` con la carpeta `/(root)`.

-   **Causa 3**: El repositorio es privado.
    -   **Solución**: GitHub Pages para repositorios privados es una característica de pago (GitHub Pro/Team). Si el repositorio es privado, deberás hacerlo público para usar Pages de forma gratuita.
