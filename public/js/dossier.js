// Temple Dossier Module: Museum-grade detail viewer with live Wikipedia narrative and gallery
const Dossier = (() => {
  const dossierEl = document.getElementById('templeDossier');
  const overlayEl = document.getElementById('dossierOverlay');
  const closeBtn = document.getElementById('dossierCloseBtn');
  const loaderEl = document.getElementById('dossierLoader');
  const bodyEl = document.getElementById('dossierBody');

  // Fields
  const heroImg = document.getElementById('dossierHeroImg');
  const heritageTag = document.getElementById('dossierHeritageTag');
  const deityBadge = document.getElementById('dossierDeityBadge');
  const styleBadge = document.getElementById('dossierStyleBadge');
  const titleEl = document.getElementById('dossierTitle');
  const nativeNameEl = document.getElementById('dossierNativeName');
  const locationEl = document.getElementById('dossierLocation');
  const coordsPill = document.getElementById('dossierCoords');
  const coordsText = document.getElementById('coordsText');
  const mapsActionBtn = document.getElementById('mapsActionBtn');
  const wikiActionBtn = document.getElementById('wikiActionBtn');
  const shareActionBtn = document.getElementById('shareActionBtn');

  // Attributes
  const attrDeity = document.getElementById('attrDeity');
  const attrDynasty = document.getElementById('attrDynasty');
  const attrStyle = document.getElementById('attrStyle');
  const attrHeritage = document.getElementById('attrHeritage');

  // Narrative & Gallery
  const extractEl = document.getElementById('dossierExtract');
  const galleryGrid = document.getElementById('dossierGalleryGrid');
  const gallerySection = document.getElementById('dossierGallerySection');

  let currentTemple = null;

  function init() {
    closeBtn.addEventListener('click', close);
    overlayEl.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        close();
      }
    });

    coordsPill.addEventListener('click', () => {
      if (currentTemple && currentTemple.lat && currentTemple.lng) {
        const text = `${currentTemple.lat.toFixed(5)}, ${currentTemple.lng.toFixed(5)}`;
        navigator.clipboard.writeText(text).then(() => {
          App.showToast(`Coordinates copied: ${text}`);
        });
      }
    });

    shareActionBtn.addEventListener('click', () => {
      if (currentTemple) {
        const url = `${window.location.origin}${window.location.pathname}?temple=${encodeURIComponent(currentTemple.id)}`;
        navigator.clipboard.writeText(url).then(() => {
          App.showToast('Temple link copied to clipboard');
        });
      }
    });
  }

  function isOpen() {
    return dossierEl.classList.contains('open');
  }

  function close() {
    dossierEl.classList.remove('open');
    dossierEl.setAttribute('aria-hidden', 'true');
    // Clear URL param without reloading
    const url = new URL(window.location);
    url.searchParams.delete('temple');
    window.history.replaceState({}, '', url);
  }

  async function open(templeId) {
    if (!templeId) return;

    dossierEl.classList.add('open');
    dossierEl.setAttribute('aria-hidden', 'false');
    loaderEl.style.display = 'flex';
    bodyEl.style.display = 'none';

    // Update URL param
    const url = new URL(window.location);
    url.searchParams.set('temple', templeId);
    window.history.replaceState({}, '', url);

    try {
      const res = await fetch(`/api/temple/${encodeURIComponent(templeId)}`);
      if (!res.ok) throw new Error('Failed to retrieve temple details');
      const data = await res.json();
      currentTemple = data;
      render(data);
    } catch (err) {
      console.error('Error opening dossier:', err);
      loaderEl.innerHTML = `<p style="color: var(--accent-amber);">Unable to load dossier details. Please try again.</p>`;
    } finally {
      loaderEl.style.display = 'none';
      bodyEl.style.display = 'block';
    }
  }

  function render(t) {
    // 1. Hero Image
    const imgSrc = t.effectiveImage || t.image || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80';
    heroImg.src = imgSrc;
    heroImg.alt = t.name;

    // 2. Heritage Tag
    if (t.heritageStatus) {
      heritageTag.textContent = t.heritageStatus;
      heritageTag.style.display = 'inline-block';
    } else {
      heritageTag.style.display = 'none';
    }

    // 3. Eyebrow & Badges
    deityBadge.textContent = t.deity || 'Sacred Sanctum';
    styleBadge.textContent = t.architectureStyle || (t.dynasty ? `${t.dynasty}` : 'Indian Temple Heritage');

    // 4. Titles & Subtitles
    titleEl.textContent = t.name;
    if (t.nativeName) {
      nativeNameEl.textContent = t.nativeName;
      nativeNameEl.style.display = 'block';
    } else {
      nativeNameEl.style.display = 'none';
    }

    // 5. Location & Coordinates
    const locParts = [t.district, t.state].filter(Boolean);
    locationEl.textContent = locParts.length > 0 ? locParts.join(', ') : 'India';

    if (t.lat != null && t.lng != null) {
      coordsText.textContent = `${t.lat.toFixed(4)}° N, ${t.lng.toFixed(4)}° E`;
      coordsPill.style.display = 'inline-flex';
      mapsActionBtn.href = `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
      mapsActionBtn.style.display = 'inline-flex';
    } else {
      coordsPill.style.display = 'none';
      mapsActionBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.name)}`;
    }

    // 6. Wikipedia Action Link
    if (t.wiki?.pageUrl || t.wikiTitle) {
      const wikiUrl = t.wiki?.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(t.wikiTitle)}`;
      wikiActionBtn.href = wikiUrl;
      wikiActionBtn.style.display = 'inline-flex';
    } else {
      wikiActionBtn.style.display = 'none';
    }

    // 7. Key Attributes
    attrDeity.textContent = t.deity || '—';
    attrDynasty.textContent = t.dynasty || t.century || 'Ancient Heritage';
    attrStyle.textContent = t.architectureStyle || 'Traditional Indian';
    attrHeritage.textContent = t.heritageStatus || 'Sacred Historic Pilgrimage';

    // 8. Historical & Spiritual Narrative
    let narrativeHtml = '';
    if (t.wiki?.extractHtml) {
      narrativeHtml = t.wiki.extractHtml;
    } else if (t.wiki?.extract) {
      narrativeHtml = `<p>${t.wiki.extract}</p>`;
    } else if (t.summary) {
      narrativeHtml = `<p>${t.summary}</p>`;
    } else {
      narrativeHtml = `<p>${t.name} is a renowned historic sanctuary dedicated to ${t.deity || 'the divine'}, situated in ${locParts.join(', ') || 'India'}. It stands as a monument to ancient Indian sacred geometry and living devotional tradition.</p>`;
    }
    extractEl.innerHTML = narrativeHtml;

    // 9. Photo Gallery
    const galleryItems = t.gallery || [];
    if (galleryItems.length > 0) {
      gallerySection.style.display = 'block';
      galleryGrid.innerHTML = galleryItems.map(item => `
        <div class="gallery-tile" onclick="window.open('${item.url}', '_blank')">
          <img src="${item.url}" alt="${item.caption || item.title}" loading="lazy">
          <div class="gallery-caption">${item.caption || item.title}</div>
        </div>
      `).join('');
    } else {
      gallerySection.style.display = 'none';
    }
  }

  return { init, open, close, isOpen };
})();
