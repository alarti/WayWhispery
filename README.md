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
