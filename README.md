# MandirPedia (मंदिरपीडिया) — The Living Sacred Temple Encyclopedia of India

A museum-grade, clutter-free web atlas dedicated to exploring temples across India with an **automated backend ingestion pipeline** powered by Wikidata SPARQL and Wikipedia REST APIs.

---

## ✦ Key Highlights

- **100% Automated Backend Sync:** Zero manual data entry or separate CSV downloading required. The Node.js backend connects directly to the Wikidata SPARQL API on startup, indexing 1,700+ verified sacred sites across all Indian states and territories with coordinates, deities, and architectural styles.
- **Dynamic Wikipedia & Wikimedia Commons Integration:** When any temple is selected, its detailed historical monograph, architectural narrative, and full high-definition photo gallery are streamed directly on demand from Wikipedia and cached in memory.
- **Zero Generic Clutter Aesthetic:** No generic logos, corporate headers, or boilerplate UI. Designed like a fine architectural monograph and dark cartographic archive using **Cinzel**, **Newsreader**, and **Plus Jakarta Sans** typography.
- **Interactive Cartographic Atlas:** Full-bleed Leaflet map with CartoDB Dark Matter tiles, custom glowing sacred markers, and radial cluster management for smooth 60fps rendering across the subcontinent.
- **Visual Monograph Archive Mode:** Toggle seamlessly between the interactive spatial map and an editorial card archive with masonry cards.
- **Instant Search & Multi-Faceted Filters:** Real-time search with `/` keyboard shortcut, quick deity filter chips (Shiva, Vishnu, Shakti/Devi, Surya, Jain, Buddha), and State/Dynasty dropdowns.
- **"Near Me" Geolocation:** Browser GPS positioning calculates Haversine distances in real time, guiding you to the closest sanctuaries near your location.

---

## ✦ Quick Start

```bash
# 1. Install dependencies (Express & CORS)
npm install

# 2. Start the application
npm start
```

Open your browser to:
**[http://localhost:3000](http://localhost:3000)**

---

## ✦ Architecture Overview

```
c:\Users\Atish\Desktop\TempleRun
├── server.js                     # Express server & API routes
├── data/
│   └── temples.json              # Local indexed database (auto-populated)
├── src/
│   ├── data/
│   │   └── seed.js               # Seed dataset of iconic Indian temples
│   └── services/
│       ├── wikidata.js           # Automated SPARQL batch ingestion engine
│       ├── wikipedia.js          # On-demand Wikipedia summary & photo gallery
│       └── storage.js            # In-memory index, geo-math, search & caching
└── public/
    ├── index.html                # Clutter-free minimal application shell
    ├── css/
    │   └── style.css             # Museum-grade dark architectural design
    └── js/
        ├── app.js                # App coordinator, live status polling, cards
        ├── map.js                # Leaflet map, glowing pins & clustering
        ├── search.js             # Real-time search, deity chips & GPS
        └── dossier.js            # Slide-out temple monograph & photo viewer
```

---

## ✦ API Endpoints

- `GET /api/temples?q=...&state=...&deity=...&limit=40` - Filtered, paginated search
- `GET /api/temples/map` - Lightweight coordinates and metadata for map pins
- `GET /api/temples/nearby?lat=...&lng=...&radiusKm=200` - Proximity distance query
- `GET /api/temple/:id` - Full temple details enriched with live Wikipedia narrative and Wikimedia gallery
- `GET /api/facets` - Aggregated state, deity, and architectural style counts
- `GET /api/status` - Live count of indexed temples and automated sync progress
- `POST /api/sync` - Trigger a live background sync batch
