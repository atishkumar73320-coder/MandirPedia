// Automated Wikidata SPARQL Ingestion Engine
const storage = require('./storage');

class WikidataService {
  constructor() {
    this.endpoint = 'https://query.wikidata.org/sparql';
    this.userAgent = 'MandiraIndianHeritageAtlas/1.0 (Indian Architectural Documentation; contact@mandira.internal)';
    this.isSyncing = false;
  }

  buildQuery({ limit = 500, offset = 0 } = {}) {
    return `
      SELECT ?item ?itemLabel ?coord ?image ?deityLabel ?locationLabel ?article ?styleLabel WHERE {
        VALUES ?type { 
          wd:Q44539    # Hindu temple
          wd:Q1417088  # Jain temple
          wd:Q10860533 # Mandir
          wd:Q11514315 # Hindu shrine
          wd:Q200794   # Cave temple
          wd:Q1078696  # Buddhist temple
          wd:Q13217684 # Buddhist monastery in India
        }
        ?item wdt:P31 ?type;
              wdt:P17 wd:Q668;
              wdt:P625 ?coord.
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P825 ?deity. }
        OPTIONAL { ?item wdt:P131 ?location. }
        OPTIONAL { ?item wdt:P149 ?style. }
        OPTIONAL {
          ?article schema:about ?item;
                   schema:isPartOf <https://en.wikipedia.org/>.
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hi,ta,te,kn,ml,or,bn,gu,mr". }
      }
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  parseBindings(bindings) {
    const list = [];
    for (const b of bindings) {
      if (!b.coord?.value) continue;

      // Parse Point(lng lat) -> WKT format
      const match = b.coord.value.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!match) continue;

      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);

      // Boundary check for India (approx lat: 6 to 37.5, lng: 68 to 97.5)
      if (isNaN(lat) || isNaN(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
        continue;
      }

      const qid = b.item?.value ? b.item.value.split('/').pop() : null;
      let name = b.itemLabel?.value || '';

      // Skip items where label is just the raw QID
      if (/^Q\d+$/.test(name)) continue;

      let wikiTitle = null;
      if (b.article?.value) {
        const parts = b.article.value.split('/wiki/');
        if (parts.length > 1) {
          wikiTitle = decodeURIComponent(parts[1]);
        }
      }

      // Convert Wikimedia Special:FilePath to direct thumbnail or high-res URL
      let image = null;
      if (b.image?.value) {
        image = b.image.value.replace('http://', 'https://');
      }

      list.push({
        id: `wikidata-${qid}`,
        wikidataId: qid,
        name: name,
        lat: lat,
        lng: lng,
        state: b.locationLabel?.value || null,
        district: b.locationLabel?.value || null,
        deity: b.deityLabel?.value || null,
        architectureStyle: b.styleLabel?.value || null,
        image: image,
        wikiTitle: wikiTitle
      });
    }
    return list;
  }

  async fetchBatch({ limit = 500, offset = 0 } = {}) {
    const query = this.buildQuery({ limit, offset });
    const url = `${this.endpoint}?query=${encodeURIComponent(query)}&format=json`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/sparql-results+json'
      }
    });

    if (!res.ok) {
      throw new Error(`Wikidata SPARQL returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    const bindings = data.results?.bindings || [];
    return this.parseBindings(bindings);
  }

  // Automated background sync pipeline
  async sync(maxBatches = 6) {
    if (this.isSyncing) {
      console.log('[Wikidata Sync] Sync already in progress, skipping duplicate call.');
      return;
    }

    this.isSyncing = true;
    storage.syncStatus.inProgress = true;
    storage.syncStatus.lastError = null;

    console.log('[Wikidata Sync] Starting automated background ingestion...');

    const batchSize = 500;
    let totalAdded = 0;
    let totalUpdated = 0;

    try {
      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
        const offset = batchIndex * batchSize;
        storage.syncStatus.currentBatch = batchIndex + 1;
        console.log(`[Wikidata Sync] Fetching batch ${batchIndex + 1}/${maxBatches} (offset: ${offset})...`);

        try {
          const items = await this.fetchBatch({ limit: batchSize, offset });
          if (items.length === 0) {
            console.log('[Wikidata Sync] Received empty batch, sync finished.');
            break;
          }

          const { addedCount, updatedCount } = storage.upsertBatch(items);
          totalAdded += addedCount;
          totalUpdated += updatedCount;
          storage.syncStatus.totalFetched = storage.temples.length;

          console.log(`[Wikidata Sync] Batch ${batchIndex + 1} processed: +${addedCount} new, ${updatedCount} updated. Total temples in archive: ${storage.temples.length}`);

          // Gentle delay between batches to be respectful to Wikidata public endpoint
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          console.error(`[Wikidata Sync] Error on batch ${batchIndex + 1}:`, err.message);
          storage.syncStatus.lastError = err.message;
          // Wait longer and continue or stop
          await new Promise(r => setTimeout(r, 4000));
        }
      }

      storage.syncStatus.lastCompleted = new Date().toISOString();
      console.log(`[Wikidata Sync] Automated sync complete. Total in archive: ${storage.temples.length}`);
    } catch (err) {
      console.error('[Wikidata Sync] Ingestion halted:', err.message);
      storage.syncStatus.lastError = err.message;
    } finally {
      this.isSyncing = false;
      storage.syncStatus.inProgress = false;
    }
  }
}

module.exports = new WikidataService();
