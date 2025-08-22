# WayWhispery - Interactive Guide Platform

This project is an advanced, offline-first Progressive Web App (PWA) that serves as a platform for creating, sharing, and experiencing interactive, multilingual voice guides for any location worldwide. It combines a Leaflet.js map interface with a Supabase backend for data persistence and authentication.
<img width="1911" height="943" alt="image" src="https://github.com/user-attachments/assets/b55478d6-ab3e-45ee-90f7-26e9cc95f5dd" />


## Key Features

-   **AI-Powered Guide Generation**: Editors can generate complete, multilingual walking tours on any topic using AI. The system creates a title, summary, and a list of 10-15 points of interest with detailed descriptions and plausible coordinates.

-   **Interactive Map**: A dynamic, zoomable map built with Leaflet.js and OpenStreetMap serves as the primary interface for both viewing and editing guides.

-   **Real-time GPS & Proximity-Based Audio**: The app uses the browser's Geolocation API for real-time position tracking. When in "Live GPS Mode," approaching a Point of Interest (POI) automatically triggers a spoken description using the Web Speech API, providing a hands-free tour experience.

-   **Offline-First Architecture (PWA)**:
    - **IndexedDB Storage**: All guides and POIs are stored locally in the browser using IndexedDB (via Dexie.js), allowing the app to be fully functional without an internet connection after the first visit.
    - **Offline Mutations**: Create, edit, or delete guides and POIs while offline. All changes are saved to a local "mutation outbox."
    - **Automatic Syncing**: When the connection is restored, the app automatically syncs local changes with the Supabase backend and fetches the latest updates.
    - **Periodic Background Sync**: The service worker attempts to sync data periodically even when the app is not active.

-   **Backend with Supabase**:
    -   **Authentication**: Secure login with Google (OAuth).
    -   **PostgreSQL Database**: Stores all guide and POI data, with Row Level Security (RLS) to protect user data.
    -   **Storage**: (Future) For managing guide-related media.

-   **User Roles**:
    -   **Visitor (anonymous)**: Can view all published guides on the map.
    -   **Editor/Admin**: Can create, edit, and delete guides and POIs directly on the map, and access AI generation tools.

-   **Unified Experience**: A single, intuitive interface for both viewing and editing guides, with a responsive design for mobile and desktop.
