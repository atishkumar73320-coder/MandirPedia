// Main Coordinator Application
const App = (() => {
  // Elements
  const viewMapBtn = document.getElementById('viewMapBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const mapView = document.getElementById('mapView');
  const gridView = document.getElementById('gridView');
  const templeCardsGrid = document.getElementById('templeCardsGrid');
  const resultsCount = document.getElementById('resultsCount');
  const gridPagination = document.getElementById('gridPagination');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const syncCountLabel = document.getElementById('syncCountLabel');
  const toastContainer = document.getElementById('toastContainer');

  let currentView = 'map'; // 'map' | 'grid'
  let currentOffset = 0;
  const pageSize = 24;
  let totalGridItems = 0;

  async function start() {
    // 1. Initialize Sub-modules
    TempleMap.init();
    Dossier.init();
    SearchController.init();

    // 2. Setup View Toggle Events
    viewMapBtn.addEventListener('click', () => switchView('map'));
    viewGridBtn.addEventListener('click', () => switchView('grid'));
    loadMoreBtn.addEventListener('click', loadMoreGrid);

    // 3. Fetch Map Data & Status
    await Promise.all([
      loadMapMarkers(),
      loadFacets(),
      checkStatus()
    ]);

    // 4. Check for direct URL Deep-Linking (e.g. ?temple=brihadeeswara-thanjavur)
    const urlParams = new URLSearchParams(window.location.search);
    const linkedTemple = urlParams.get('temple');
    if (linkedTemple) {
      Dossier.open(linkedTemple);
    }

    // 5. Periodic status poll to show real-time Wikidata background sync growth
    setInterval(checkStatus, 7000);
  }

  function switchView(view) {
    currentView = view;
    if (view === 'map') {
      viewMapBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
      mapView.style.display = 'block';
      gridView.style.display = 'none';
    } else {
      viewGridBtn.classList.add('active');
      viewMapBtn.classList.remove('active');
      mapView.style.display = 'none';
      gridView.style.display = 'block';
      // Load grid data
      fetchGridTemples(SearchController.getFilters(), true);
    }
  }

  // Load Map Markers
  async function loadMapMarkers() {
    try {
      const res = await fetch('/api/temples/map');
      const json = await res.json();
      if (json.data) {
        TempleMap.setMarkers(json.data);
      }
    } catch (err) {
      console.error('Failed to load map markers:', err);
    }
  }

  // Load Facets for Dropdowns
  async function loadFacets() {
    try {
      const res = await fetch('/api/facets');
      const facets = await res.json();
      if (facets.states) {
        SearchController.populateStateDropdown(facets.states);
      }
    } catch (err) {
      console.error('Failed to load facets:', err);
    }
  }

  // Check Sync Status & Count
  async function checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.total != null) {
        const countFormatted = data.total.toLocaleString();
        if (data.sync && data.sync.inProgress) {
          syncCountLabel.textContent = `${countFormatted} Temples • Wikidata Syncing (Batch ${data.sync.currentBatch})...`;
        } else {
          syncCountLabel.textContent = `${countFormatted} Temples Indexed`;
        }
      }
    } catch (err) {
      // Quiet fail for polling
    }
  }

  // Fetch paginated temples for the Grid Monograph Archive
  async function fetchGridTemples(filters, reset = true) {
    if (reset) {
      currentOffset = 0;
      templeCardsGrid.innerHTML = '';
    }

    const params = new URLSearchParams({
      limit: pageSize,
      offset: currentOffset,
      q: filters.q || '',
      deity: filters.deity || 'all',
      state: filters.state || 'all',
      style: filters.style || 'all'
    });

    if (filters.userLat && filters.userLng) {
      params.set('userLat', filters.userLat);
      params.set('userLng', filters.userLng);
    }

    try {
      const res = await fetch(`/api/temples?${params.toString()}`);
      const json = await res.json();
      
      totalGridItems = json.total || 0;
      resultsCount.textContent = totalGridItems.toLocaleString();

      if (reset) {
        templeCardsGrid.innerHTML = '';
      }

      renderGridCards(json.data, !reset);

      // Pagination Button
      currentOffset += (json.data?.length || 0);
      if (currentOffset < totalGridItems) {
        gridPagination.style.display = 'block';
      } else {
        gridPagination.style.display = 'none';
      }
    } catch (err) {
      console.error('Error fetching grid temples:', err);
    }
  }

  function loadMoreGrid() {
    fetchGridTemples(SearchController.getFilters(), false);
  }

  function renderGridCards(templesList, append = false) {
    if (!append) {
      templeCardsGrid.innerHTML = '';
    }

    if (!templesList || templesList.length === 0) {
      if (!append) {
        templeCardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
            <p style="font-size: 1.1rem; font-family: var(--font-serif); color: var(--accent-sandstone);">No sanctuaries matched your current filters.</p>
            <p style="font-size: 0.85rem; margin-top: 6px;">Try broadening your search term or clearing the state/deity filters.</p>
          </div>
        `;
      }
      return;
    }

    const html = templesList.map(t => {
      const img = t.image || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=75';
      const loc = [t.district, t.state].filter(Boolean).join(', ') || 'India';
      const distBadge = t.distanceKm != null 
        ? `<div class="card-dist-badge">${t.distanceKm} km away</div>` 
        : '';
      const deityBadge = t.deity 
        ? `<div class="card-deity-badge">${t.deity}</div>` 
        : '';

      return `
        <article class="temple-card" onclick="Dossier.open('${t.id}')">
          <div class="card-thumb-frame">
            <img class="card-thumb" src="${img}" alt="${t.name}" loading="lazy">
            ${deityBadge}
            ${distBadge}
          </div>
          <div class="card-info">
            <h3 class="card-title">${t.name}</h3>
            <div class="card-location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--accent-amber);">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${loc}</span>
            </div>
            <p class="card-summary">${t.summary || (t.nativeName ? `Known natively as ${t.nativeName}.` : 'An ancient sacred temple of Indian heritage.')}</p>
            <div class="card-footer-tags">
              ${t.architectureStyle ? `<span class="tag-pill">${t.architectureStyle}</span>` : ''}
              ${t.dynasty ? `<span class="tag-pill">${t.dynasty}</span>` : ''}
              ${t.century ? `<span class="tag-pill">${t.century}</span>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');

    templeCardsGrid.insertAdjacentHTML('beforeend', html);
  }

  // Toast Notification System
  function showToast(message, duration = 3200) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--accent-gold);">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return {
    start,
    fetchGridTemples,
    renderGridCards,
    showToast
  };
})();

// Boot on DOM Ready
document.addEventListener('DOMContentLoaded', App.start);
