# Documentación de Autenticación

Este documento explica cómo funciona el flujo de autenticación con Google en la aplicación y los puntos clave de su configuración.

## Flujo de Autenticación

La aplicación utiliza el método de **redirección de OAuth** de Supabase, que es el más robusto y recomendado, especialmente para evitar problemas con bloqueadores de pop-ups.

1.  **Inicio de sesión**:
    -   El usuario hace clic en el botón "Continuar con Google".
    -   La aplicación llama a la función `supabase.auth.signInWithOAuth()` con el proveedor `google`.
    -   Crucialmente, se pasa la opción `redirectTo`, que le dice a Supabase a dónde debe devolver al usuario después de que se autentique en Google. Esta URL debe ser la URL exacta de la aplicación en GitHub Pages o en el entorno de desarrollo local.

2.  **Autenticación en Google**:
    -   El usuario es redirigido a la página de inicio de sesión de Google.
    -   El usuario introduce sus credenciales y autoriza a la aplicación a acceder a su información básica de perfil (email).

3.  **Redirección de vuelta a la aplicación**:
    -   Google redirige al usuario de vuelta a la URL de callback de Supabase (`https://<id-proyecto>.supabase.co/auth/v1/callback`).
    -   Supabase procesa la información, crea una sesión para el usuario y lo redirige finalmente a la `redirectTo` que se especificó en el primer paso.

4.  **Gestión de la sesión en el cliente**:
    -   La página se recarga. El SDK de Supabase detecta los parámetros de la sesión en la URL.
    -   El listener `supabase.auth.onAuthStateChange` se dispara con el evento `SIGNED_IN`.
    -   La aplicación obtiene los datos del usuario y su perfil (rol) de la base de datos.
    -   La interfaz se actualiza para mostrar el estado de "autenticado" y los controles de edición si el usuario tiene los permisos adecuados.

## Configuración de `redirectTo` y URLs de Redirección

La correcta configuración de las URLs es el paso más crítico para que la autenticación funcione.

-   **`options.redirectTo` en `signInWithOAuth`**:
    -   En el código (`app.js`), esta opción se establece dinámicamente como `window.location.origin + window.location.pathname`.
    -   Esto asegura que el usuario siempre vuelva a la página exacta desde la que inició el proceso de login.

-   **Redirect URLs en el panel de Supabase**:
    -   Ve a **Authentication → URL Configuration**.
    -   En la lista `Redirect URLs`, debes añadir **TODAS** las URLs a las que Supabase tiene permitido redirigir. Si una URL no está en esta lista, la redirección fallará por motivos de seguridad.
    -   **Para producción (GitHub Pages)**: `https://<tu-usuario-github>.github.io/<tu-repo>/`
    -   **Para desarrollo local**: `http://localhost:8080` (o el puerto que uses).

## Creación Automática de Perfil de Usuario

-   Cuando un usuario se registra por primera vez a través de Google, Supabase crea una nueva entrada en la tabla `auth.users`.
-   Un **trigger** de base de datos (`on_auth_user_created`) detecta esta inserción.
-   Este trigger ejecuta la función `handle_new_user()`, que inserta una nueva fila en la tabla `public.profiles`.
-   El nuevo perfil se crea con el `id` y `email` del usuario y se le asigna el rol por defecto de `'viewer'`. Esto asegura que cada usuario tenga un perfil y un rol desde el momento en que se registra.
