# How to create a Gist for a new guide

Here is an example of the multi-language JSON structure and the instructions for uploading it to Gist.

## 1. Content of the `guide.json` file

Your `guide.json` file must follow this structure. Notice how the texts (name and description) are nested inside a `texts` object with language codes (`en`, `es`, `fr`, etc.).

```json
{
  "initialView": {
    "lat": 48.8584,
    "lon": 2.2945,
    "zoom": 16
  },
  "availableLanguages": {
    "en": "English",
    "es": "Español",
    "fr": "Français"
  },
  "poiBaseData": [
    {
      "id": "poi-1",
      "lat": 48.8584,
      "lon": 2.2945
    },
    {
      "id": "poi-2",
      "lat": 48.8600,
      "lon": 2.2950
    }
  ],
  "pois": [
    {
      "id": "poi-1",
      "texts": {
        "en": {
          "name": "Eiffel Tower",
          "description": "The famous landmark of Paris."
        },
        "es": {
          "name": "Torre Eiffel",
          "description": "El famoso monumento de París."
        },
        "fr": {
          "name": "Tour Eiffel",
          "description": "Le célèbre monument de Paris."
        }
      }
    },
    {
      "id": "poi-2",
      "texts": {
        "en": {
          "name": "Champ de Mars",
          "description": "A large public greenspace in Paris, France."
        },
        "es": {
          "name": "Campo de Marte",
          "description": "Un gran espacio verde público en París, Francia."
        },
        "fr": {
          "name": "Champ-de-Mars",
          "description": "Un grand espace vert public à Paris, France."
        }
      }
    }
  ],
  "tourRoute": [
    "poi-1",
    "poi-2"
  ]
}
```

## 2. Instructions for uploading to Gist

1.  Go to the Gist website: **[https://gist.github.com/](https://gist.github.com/)**
2.  In the "Gist description..." field, you can type a description for your guide.
3.  In the "Filename including extension..." field, type exactly `guide.json`. It is **very important** that the filename is correct.
4.  Paste your JSON content into the large text area.
5.  Click the green button that says **"Create public gist"**.
6.  Done! The page will reload, and the URL in your browser's address bar will be the URL of your Gist. The Gist **ID** is the long string of letters and numbers at the end of the URL (e.g., `https://gist.github.com/YourUser/THIS_IS_THE_ID`).

You can use this ID to load the guide in the application (`?gist=YOUR_ID_HERE`) or to add it to the `assets/guides.json` catalog.
