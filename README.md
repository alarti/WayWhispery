# WayWhispery - Interactive Guide Platform

This project is an advanced, offline-first Progressive Web App (PWA) that serves as a platform for creating, sharing, and experiencing interactive, multilingual voice guides for any location worldwide. It combines a Leaflet.js map interface with a Supabase backend for data persistence and authentication.

## Features

-   **Unified Experience**: A single interface for both viewing and editing guides.
-   **Interactive Map**: Displays a dynamic, zoomable map using Leaflet.js and OpenStreetMap.
-   **Real-time GPS Tracking**: Uses the browser's Geolocation API to track your position.
-   **Proximity-Based Audio Guide**: Approaching a Point of Interest (POI) automatically triggers a spoken description using the Web Speech API.
-   **Backend with Supabase**:
    -   **Autenticación**: Login con Google (OAuth).
    -   **Base de Datos**: PostgreSQL with RLS for storing guide and POI data.
    -   **Almacenamiento**: (Future) For managing guide-related media.
-   **Roles de Usuario**:
    -   **Visitor (anonymous)**: Can view all published guides on the map.
    -   **Editor/Admin**: Can create, edit, and delete guides and POIs directly on the map.
-   **Offline First (PWA)**: Fully functional without an internet connection after the first visit.

## How to Set Up

### 1. Supabase Configuration

You will need a Supabase project to act as the backend.

1.  **Create a project** on [Supabase](https://supabase.com).
2.  **Get your API keys**: In your project dashboard, go to `Settings` -> `API` and find your URL and `anon` public key.
3.  **Configure Auth**: Go to `Authentication` -> `Providers` and enable Google. You will need to get OAuth credentials from the Google Cloud Console. For local development, make sure to add `http://localhost:8000` (or your local server's address) to the "Redirect URLs" under `Authentication` -> `URL Configuration`.
4.  **Run the database migration**: Go to the `SQL Editor` in your Supabase dashboard, copy the content from `supabase/migrations/0001_init.sql`, and run it to create the necessary tables and policies.

### 2. Configure Local Keys

The application needs to know your Supabase URL and key.

1.  Open the `js/main.js` file.
2.  Find the following lines at the top of the file:
    ```javascript
    const SUPABASE_URL = '...';
    const SUPABASE_ANON_KEY = '...';
    ```
3.  Replace the placeholder values with your own URL and `anon` key.

### 3. Run Locally

To test the site on your local machine, you need a simple web server.

1.  If you have Python installed, you can run the following command from the project's root directory:
    ```bash
    python3 -m http.server 8000
    ```
2.  Open your browser and navigate to `http://localhost:8000`.

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

### `guide_poi`

This table stores the Points of Interest (POIs) for a guide, in order.

- `id` (uuid, primary key): A unique identifier for the POI.
- `guide_id` (uuid): References the `id` of the guide this POI belongs to.
- `order` (integer, default: 0): The order in which the POI appears in the guide.
- `texts` (jsonb): A JSON object containing the title and description in multiple languages.
- `lat` (double precision): The latitude of the POI.
- `lon` (double precision): The longitude of the POI.

### `tags`

This table defines the tags that can be associated with guides.

- `id` (uuid, primary key): A unique identifier for the tag.
- `name` (text, unique): The name of the tag.
- `slug` (text, unique): A user-friendly URL slug for the tag.

### `guide_tags`

This is a join table for the many-to-many relationship between guides and tags.

- `guide_id` (uuid): References the `id` of the guide.
- `tag_id` (uuid): References the `id` of the tag.

### `media`

This table stores references to media files associated with a guide.

- `id` (uuid, primary key): A unique identifier for the media file.
- `guide_id` (uuid): References the `id` of the guide this media file belongs to.
- `url` (text): The URL of the media file.
- `alt` (text): Alternative text for the media file (for accessibility).
- `kind` (text): The type of media, e.g., 'image', 'video'.
