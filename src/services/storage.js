const fs = require('fs');
const path = require('path');
const seedTemples = require('../data/seed');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'temples.json');

class Storage {
  constructor() {
    this.temples = [];
    this.idMap = new Map();
    this.wikidataMap = new Map();
    this.lastSync = null;
    this.syncStatus = {
      inProgress: false,
      totalFetched: 0,
      currentBatch: 0,
      lastError: null,
      lastCompleted: null
    };

    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.temples = parsed;
          console.log(`[Storage] Loaded ${this.temples.length} temples from ${DATA_FILE}`);
        } else {
          this.loadSeed();
        }
      } catch (err) {
        console.error('[Storage] Error reading temples.json, falling back to seed:', err.message);
        this.loadSeed();
      }
    } else {
      this.loadSeed();
    }

    this.rebuildIndex();
  }

  loadSeed() {
    this.temples = [...seedTemples];
    this.persist();
    console.log(`[Storage] Initialized with ${this.temples.length} seed temples`);
  }

  persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.temples, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Failed to save temples.json:', err.message);
    }
  }

  rebuildIndex() {
    this.idMap.clear();
    this.wikidataMap.clear();
    for (const t of this.temples) {
      if (t.id) this.idMap.set(t.id, t);
      if (t.wikidataId) this.wikidataMap.set(t.wikidataId, t);
    }
  }

  getById(id) {
    if (!id) return null;
    return this.idMap.get(id) || this.wikidataMap.get(id) || null;
  }

  // Upsert new incoming temples from Wikidata or Wikipedia
  upsertBatch(batch) {
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of batch) {
      if (!item.name || !item.lat || !item.lng) continue;

      let existing = null;
      if (item.wikidataId && this.wikidataMap.has(item.wikidataId)) {
        existing = this.wikidataMap.get(item.wikidataId);
      } else if (item.id && this.idMap.has(item.id)) {
        existing = this.idMap.get(item.id);
      }

      if (existing) {
        // Enrich existing
        if (!existing.image && item.image) existing.image = item.image;
        if (!existing.deity && item.deity) existing.deity = item.deity;
        if (!existing.state && item.state) existing.state = item.state;
        if (!existing.district && item.district) existing.district = item.district;
        if (!existing.wikiTitle && item.wikiTitle) existing.wikiTitle = item.wikiTitle;
        if (!existing.architectureStyle && item.architectureStyle) existing.architectureStyle = item.architectureStyle;
        if (!existing.summary && item.summary) existing.summary = item.summary;
        updatedCount++;
      } else {
        // Generate an ID if needed
        if (!item.id) {
          item.id = (item.wikidataId || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
        }
        this.temples.push(item);
        if (item.id) this.idMap.set(item.id, item);
        if (item.wikidataId) this.wikidataMap.set(item.wikidataId, item);
        addedCount++;
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      this.rebuildIndex();
      this.persist();
    }

    return { addedCount, updatedCount, total: this.temples.length };
  }

  // Compact payload for lightning-fast map pins across India
  getMapMarkers() {
    return this.temples.map(t => ({
      id: t.id,
      name: t.name,
      lat: t.lat,
      lng: t.lng,
      state: t.state || '',
      deity: t.deity || '',
      image: t.image || null,
      dynasty: t.dynasty || '',
      heritageStatus: t.heritageStatus || ''
    }));
  }

  // Search, filter & paginate
  search({ q, state, deity, style, religion, limit = 50, offset = 0, userLat, userLng }) {
    let results = this.temples;

    // Filter by query string
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      results = results.filter(t => {
        return (
          (t.name && t.name.toLowerCase().includes(term)) ||
          (t.nativeName && t.nativeName.toLowerCase().includes(term)) ||
          (t.deity && t.deity.toLowerCase().includes(term)) ||
          (t.state && t.state.toLowerCase().includes(term)) ||
          (t.district && t.district.toLowerCase().includes(term)) ||
          (t.architectureStyle && t.architectureStyle.toLowerCase().includes(term)) ||
          (t.dynasty && t.dynasty.toLowerCase().includes(term)) ||
          (t.summary && t.summary.toLowerCase().includes(term))
        );
      });
    }

    // Filter by State
    if (state && state !== 'all') {
      const sLower = state.toLowerCase();
      results = results.filter(t => t.state && t.state.toLowerCase().includes(sLower));
    }

    // Filter by Deity
    if (deity && deity !== 'all') {
      const dLower = deity.toLowerCase();
      results = results.filter(t => t.deity && t.deity.toLowerCase().includes(dLower));
    }

    // Filter by Architecture Style
    if (style && style !== 'all') {
      const stLower = style.toLowerCase();
      results = results.filter(t => t.architectureStyle && t.architectureStyle.toLowerCase().includes(stLower));
    }

    // Filter by Religion
    if (religion && religion !== 'all') {
      const rLower = religion.toLowerCase();
      results = results.filter(t => t.religion && t.religion.toLowerCase().includes(rLower));
    }

    // Compute distance if user coordinates provided
    if (userLat != null && userLng != null) {
      const uLat = parseFloat(userLat);
      const uLng = parseFloat(userLng);
      results = results.map(t => ({
        ...t,
        distanceKm: Math.round(this.haversineDistance(uLat, uLng, t.lat, t.lng))
      }));
      results.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      data: paginated
    };
  }

  // Get nearest temples to given coordinates
  getNearby(lat, lng, radiusKm = 150, limit = 30) {
    const uLat = parseFloat(lat);
    const uLng = parseFloat(lng);
    if (isNaN(uLat) || isNaN(uLng)) return [];

    const withDist = this.temples
      .map(t => {
        const dist = this.haversineDistance(uLat, uLng, t.lat, t.lng);
        return { ...t, distanceKm: Math.round(dist * 10) / 10 };
      })
      .filter(t => t.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return withDist;
  }

  // Aggregate metadata for filter chips
  getFacets() {
    const states = {};
    const deities = {};
    const styles = {};

    for (const t of this.temples) {
      if (t.state) {
        states[t.state] = (states[t.state] || 0) + 1;
      }
      if (t.deity) {
        // Group major deities cleanly
        let canonical = t.deity;
        if (/shiva|mahadeva|nataraja|kedar|lingam/i.test(t.deity)) canonical = 'Shiva';
        else if (/vishnu|krishna|rama|venkateswara|ranganatha|jagannath/i.test(t.deity)) canonical = 'Vishnu';
        else if (/kali|durga|parvati|shakti|kamakhya|devi|amman|mariamman/i.test(t.deity)) canonical = 'Shakti / Devi';
        else if (/ganesha|vinayaka|pillayar/i.test(t.deity)) canonical = 'Ganesha';
        else if (/murugan|kartikeya|subrahmanya/i.test(t.deity)) canonical = 'Murugan';
        else if (/surya|sun/i.test(t.deity)) canonical = 'Surya';
        else if (/tirthankara|adinatha|rishabhanatha|mahavira|parshvanatha/i.test(t.deity)) canonical = 'Jain Tirthankara';
        else if (/buddha/i.test(t.deity)) canonical = 'Gautama Buddha';
        deities[canonical] = (deities[canonical] || 0) + 1;
      }
      if (t.architectureStyle) {
        styles[t.architectureStyle] = (styles[t.architectureStyle] || 0) + 1;
      }
    }

    return {
      states: Object.entries(states).sort((a, b) => b[1] - a[1]),
      deities: Object.entries(deities).sort((a, b) => b[1] - a[1]),
      styles: Object.entries(styles).sort((a, b) => b[1] - a[1]),
      total: this.temples.length
    };
  }

  getStats() {
    const withImages = this.temples.filter(t => !!t.image).length;
    const withWiki = this.temples.filter(t => !!t.wikiTitle).length;
    return {
      total: this.temples.length,
      withImages,
      withWiki,
      sync: this.syncStatus
    };
  }

  // Haversine formula to compute great-circle distance between two points in km
  haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371; // Earth's mean radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = new Storage();
