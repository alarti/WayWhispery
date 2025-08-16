# Cómo crear un Gist para una nueva guía

Aquí tienes un ejemplo de la estructura JSON multi-idioma y las instrucciones para subirlo a Gist.

## 1. Contenido del fichero `guide.json`

Tu fichero `guide.json` debe seguir esta estructura. Fíjate en cómo los textos (nombre y descripción) están anidados dentro de un objeto `texts` con códigos de idioma (`en`, `es`, `fr`, etc.).

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

## 2. Instrucciones para subir a Gist

1.  Ve a la página de Gist: **[https://gist.github.com/](https://gist.github.com/)**
2.  En el campo "Gist description...", puedes escribir una descripción para tu guía.
3.  En el campo "Filename including extension...", escribe exactamente `guide.json`. Es **muy importante** que el nombre sea ese.
4.  Pega tu contenido JSON en el cuadro de texto grande.
5.  Haz clic en el botón verde que dice **"Create public gist"**.
6.  ¡Listo! La página se recargará y la URL en la barra de tu navegador será la URL de tu Gist. El **identificador (ID)** del Gist es la serie larga de letras y números que aparece al final de la URL (ej: `https://gist.github.com/TuUsuario/ESTE_ES_EL_ID`).

Puedes usar ese ID para cargar la guía en la aplicación (`?gist=TU_ID_AQUI`) o para añadirla al catálogo `assets/guides.json`.
