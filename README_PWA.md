# Interactive Voice Guide Platform

This project is an advanced, offline-first Progressive Web App (PWA) that serves as a platform for creating, sharing, and experiencing interactive, multilingual voice guides for any location worldwide. What started as a guide for the Alhambra has evolved into a full-featured creation tool.

## Features

### For Viewers
*   **Interactive Map:** Displays a dynamic, zoomable map using Leaflet.js and OpenStreetMap.
*   **Guided Tour Route:** A predefined walking tour is drawn on the map, showing the suggested path through all points of interest.
*   **Real-time GPS Tracking:** Uses the browser's Geolocation API to track your position in real-time.
*   **Proximity-Based Audio Guide:** Approaching a Point of Interest (POI) automatically triggers a spoken description of that location using the Web Speech API.
*   **Dynamic Subtitle Overlay:** The spoken description is simultaneously displayed as text in a semi-transparent overlay.
*   **Full Multi-Language Support:** Guides can contain multiple languages. Users can switch languages on the fly.
*   **Offline First (PWA):** Fully functional without an internet connection after the first visit. Can be installed on a mobile device's home screen.

### For Creators
*   **Unified Interface:** Seamlessly switch between viewing and editing a guide with the click of a button.
*   **Multi-Language Editor:** Create and edit POI names and descriptions in multiple languages.
*   **Visual Editor:** Add new POIs by clicking directly on the map. Reposition existing POIs by dragging their markers.
*   **Location Search:** Center the map anywhere in the world to start creating a new guide.
*   **Gist Integration:** Save your complete guide data to a public, anonymous GitHub Gist. The platform provides you with a shareable URL to your new guide.

## How to Use

### Running Locally
The application now includes a serverless backend function for securely saving guides to GitHub Gist. To run this full-stack application locally, you need a development server that can handle both the static frontend files and the Node.js API endpoint. The recommended way is to use the [Vercel CLI](https://vercel.com/cli).

1.  Install the Vercel CLI: `npm i -g vercel`
2.  Run the development server: `vercel dev`
3.  The application will be available at a local URL provided by the CLI.

### Gist Saving Configuration
To enable saving guides, you must provide a GitHub Personal Access Token with the `gist` scope.

1.  Create a token [here](https://github.com/settings/tokens/new).
2.  Create a file named `.env` in the root of the project.
3.  Add your token to the `.env` file like this:
    ```
    GIST_TOKEN=your_github_personal_access_token_here
    ```
4.  When deploying to a platform like Vercel, you must set the `GIST_TOKEN` as an environment variable in the project settings.

### Using the App
    *   Upon launch, a welcome screen will show a catalog of featured guides. You can choose one to view or click "Create a New Guide".
    *   **To View a Guide:** Simply explore the map. If you allow GPS access, the guide will speak as you approach points of interest.
    *   **To Edit a Guide:** Click "Edit This Guide". You will enter edit mode, where you can drag existing points, or use the "Add New POI" button to create new ones. You can also edit or delete POIs from the list in the side panel.
    *   **To Save Your Guide:** In edit mode, click "Save Guide". Your guide will be uploaded to a GitHub Gist, and you will be provided with a new, shareable URL. You can add this URL to the `assets/guides.json` file to make it appear in the welcome catalog.

## Author

This project was originally developed by **Alberto Arce** ([alarti](https://github.com/alarti)) and has been significantly expanded with new platform features.
