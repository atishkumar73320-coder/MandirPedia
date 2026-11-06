// Wikipedia REST API service with in-memory caching
const summaryCache = new Map();
const mediaCache = new Map();

class WikipediaService {
  constructor() {
    this.userAgent = 'MandiraIndianHeritageAtlas/1.0 (https://mandira.internal; cultural.heritage@mandira.app) Node/fetch';
  }

  async getSummary(title) {
    if (!title) return null;
    const cleanTitle = title.replace(/\s+/g, '_');
    if (summaryCache.has(cleanTitle)) {
      return summaryCache.get(cleanTitle);
    }

    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        console.warn(`[Wikipedia] Summary returned status ${res.status} for ${cleanTitle}`);
        return null;
      }

      const data = await res.json();
      const result = {
        title: data.title,
        displayTitle: data.displaytitle,
        description: data.description,
        extract: data.extract,
        extractHtml: data.extract_html,
        thumbnail: data.thumbnail?.source || null,
        originalImage: data.originalimage?.source || null,
        pageUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${cleanTitle}`,
        coordinates: data.coordinates ? { lat: data.coordinates.lat, lng: data.coordinates.lon } : null
      };

      summaryCache.set(cleanTitle, result);
      return result;
    } catch (err) {
      console.error(`[Wikipedia] Failed to fetch summary for ${cleanTitle}:`, err.message);
      return null;
    }
  }

  async getMediaGallery(title, limit = 12) {
    if (!title) return [];
    const cleanTitle = title.replace(/\s+/g, '_');
    if (mediaCache.has(cleanTitle)) {
      return mediaCache.get(cleanTitle);
    }

    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) return [];

      const data = await res.json();
      const rawItems = data.items || [];

      // Filter out non-photo assets (icons, maps, flags, logos, SVGs)
      const blacklist = /(icon|flag|logo|symbol|map|diagram|insignia|emblem|button|arrow|\.svg)/i;

      const images = rawItems
        .filter(item => item.type === 'image' && item.title && !blacklist.test(item.title))
        .map(item => {
          let highRes = null;
          if (item.srcset && item.srcset.length > 0) {
            highRes = item.srcset[item.srcset.length - 1].src;
          } else if (item.original?.source) {
            highRes = item.original.source;
          } else if (item.thumbnail?.source) {
            highRes = item.thumbnail.source;
          }

          // Ensure protocol
          if (highRes && highRes.startsWith('//')) {
            highRes = 'https:' + highRes;
          }

          let caption = item.caption?.text || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');

          return {
            title: item.title,
            caption: caption,
            url: highRes
          };
        })
        .filter(img => !!img.url)
        .slice(0, limit);

      mediaCache.set(cleanTitle, images);
      return images;
    } catch (err) {
      console.error(`[Wikipedia] Failed to fetch media list for ${cleanTitle}:`, err.message);
      return [];
    }
  }

  // Enrich a temple object with live Wikipedia summary and photo gallery
  async enrich(temple) {
    if (!temple) return null;

    let title = temple.wikiTitle;
    if (!title && temple.name) {
      title = temple.name.replace(/\s+/g, '_');
    }

    let summary = null;
    let gallery = [];

    if (title) {
      const [sum, med] = await Promise.all([
        this.getSummary(title),
        this.getMediaGallery(title)
      ]);
      summary = sum;
      gallery = med;
    }

    return {
      ...temple,
      wiki: summary,
      gallery: gallery,
      effectiveImage: temple.image || summary?.originalImage || summary?.thumbnail || (gallery[0]?.url) || null
    };
  }
}

module.exports = new WikipediaService();
