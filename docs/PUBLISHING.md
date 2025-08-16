# Guía de Publicación y Despliegue

Este documento explica el proceso para publicar contenido nuevo (guías) y cómo funciona el despliegue del sitio en GitHub Pages.

## Proceso de Publicación de Contenido

El contenido de las guías se gestiona directamente desde la aplicación web por usuarios con el rol de `editor` o `admin`.

### 1. Crear o Editar una Guía

1.  **Iniciar sesión**: Accede al sitio y haz login con una cuenta de Google que tenga el rol de `editor`.
2.  **Acceder al formulario**:
    -   Para una nueva guía, haz clic en **"Crear Nueva Guía"**.
    -   Para editar una existente, navega a la guía y haz clic en **"Editar Guía"**.
3.  **Rellenar los campos**:
    -   **Título, Slug, Resumen, Idioma**: Completa los metadatos de la guía. El slug debe ser único.
    -   **Imagen de Portada**: Sube una imagen optimizada para la web.
    -   **Secciones**: Añade, edita o elimina las secciones de contenido.
4.  **Guardar la Guía**:
    -   Haz clic en **"Guardar Guía"**.

### 2. El Estado de la Guía: `draft` vs `published`

-   **Borrador (`draft`)**:
    -   Cuando creas una guía, por defecto se guarda como `draft`.
    -   Las guías en estado `draft` **no son visibles para el público**.
    -   Solo los editores y administradores pueden verlas y acceder a ellas (generalmente a través de la edición, ya que no aparecerán en la lista pública).
-   **Publicado (`published`)**:
    -   Para que una guía sea visible para todos los visitantes, debes editarla y cambiar su estado a `published`.
    -   Una vez guardada como `published`, aparecerá en la lista principal y será accesible públicamente.

## Proceso de Despliegue del Sitio Web

El sitio web es estático y se despliega en **GitHub Pages**. El proceso está completamente automatizado mediante GitHub Actions.

### ¿Cómo funciona?

1.  **Activador (Trigger)**: El despliegue se activa automáticamente cada vez que se hace un `push` a la rama `main` del repositorio.
2.  **Workflow**: El fichero `.github/workflows/deploy.yml` define los pasos del despliegue.
    -   **Checkout**: La acción clona el código del repositorio.
    -   **Setup Pages**: Configura el entorno para el despliegue en GitHub Pages.
    -   **Upload Artifact**: La acción empaqueta el contenido de la carpeta `/vanilla-dist` (que contiene el `index.html`, `app.js`, `styles.css` y `404.html`) como un "artefacto".
    -   **Deploy**: El artefacto se despliega en una rama especial llamada `gh-pages`, que es la que GitHub Pages utiliza para servir el sitio.

### ¿Qué significa esto en la práctica?

-   **No hay pasos manuales**: Para actualizar el sitio web (por ejemplo, para cambiar el texto de un botón o arreglar un bug en el CSS), simplemente tienes que hacer los cambios en el código de la rama `main` y hacer `push`. GitHub Actions se encargará del resto.
-   **El contenido no depende del código**: La publicación de guías (como se describió antes) no requiere un nuevo despliegue del sitio, ya que el contenido se carga dinámicamente desde Supabase. El despliegue solo es necesario si se modifica el código de la aplicación (`.html`, `.js`, `.css`).

### Acceder al Sitio

-   La URL del sitio desplegado será: `https://<tu-usuario-github>.github.io/<nombre-del-repo>/`
-   Puedes encontrar el enlace exacto en la pestaña **Settings → Pages** de tu repositorio de GitHub.
