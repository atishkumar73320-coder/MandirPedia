const express = require('express');
const cors = require('cors');
const path = require('path');
const storage = require('./src/services/storage');
const wikipedia = require('./src/services/wikipedia');
const wikidata = require('./src/services/wikidata');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Paginated search & filtered list of temples
app.get('/api/temples', (req, res) => {
  const { q, state, deity, style, religion, limit, offset, userLat, userLng } = req.query;
  const results = storage.search({
    q,
    state,
    deity,
    style,
    religion,
    limit: limit ? parseInt(limit, 10) : 40,
    offset: offset ? parseInt(offset, 10) : 0,
    userLat,
    userLng
  });
  res.json(results);
});

// 2. High-performance compact markers for the interactive map
app.get('/api/temples/map', (req, res) => {
  const markers = storage.getMapMarkers();
  res.json({
    count: markers.length,
    data: markers
  });
});

// 3. Proximity / Near Me endpoint
app.get('/api/temples/nearby', (req, res) => {
  const { lat, lng, radiusKm, limit } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng parameters required' });
  }
  const nearby = storage.getNearby(
    lat,
    lng,
    radiusKm ? parseFloat(radiusKm) : 150,
    limit ? parseInt(limit, 10) : 30
  );
  res.json({ count: nearby.length, data: nearby });
});

// 4. Detailed Temple Dossier (Auto-enriched with live Wikipedia extract & photo gallery)
app.get('/api/temple/:id', async (req, res) => {
  const temple = storage.getById(req.params.id);
  if (!temple) {
    return res.status(404).json({ error: 'Temple not found in archive' });
  }

  try {
    const enriched = await wikipedia.enrich(temple);
    res.json(enriched);
  } catch (err) {
    console.error(`Error enriching temple ${req.params.id}:`, err.message);
    res.json(temple);
  }
});

// 5. Facets and counts for filter chips
app.get('/api/facets', (req, res) => {
  res.json(storage.getFacets());
});

// 6. Archive statistics and automated sync status
app.get('/api/status', (req, res) => {
  res.json(storage.getStats());
});

// 7. Manual trigger for Wikidata sync
app.post('/api/sync', (req, res) => {
  const maxBatches = req.query.batches ? parseInt(req.query.batches, 10) : 6;
  if (storage.syncStatus.inProgress) {
    return res.json({ message: 'Sync is already currently running', status: storage.syncStatus });
  }
  wikidata.sync(maxBatches);
  res.json({ message: 'Automated background sync started', status: storage.syncStatus });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` MANDIRPEDIA — The Living Temple Encyclopedia of India `);
  console.log(` Server active on: http://localhost:${PORT}          `);
  console.log(` Initial temples loaded: ${storage.temples.length}   `);
  console.log(`====================================================`);

  // Start automated background ingestion after a brief delay so the server boots instantaneously
  setTimeout(() => {
    console.log('[System] Launching automated background sync with Wikidata...');
    wikidata.sync(6);
  }, 3500);
});
