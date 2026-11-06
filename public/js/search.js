// Search & Filter Controller Module
const SearchController = (() => {
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const deityChips = document.getElementById('deityChips');
  const filterToggleBtn = document.getElementById('filterToggleBtn');
  const advancedFilterPanel = document.getElementById('advancedFilterPanel');
  const stateFilter = document.getElementById('stateFilter');
  const styleFilter = document.getElementById('styleFilter');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const activeFilterBadge = document.getElementById('activeFilterBadge');
  const nearMeBtn = document.getElementById('nearMeBtn');

  let activeFilters = {
    q: '',
    deity: 'all',
    state: 'all',
    style: 'all',
    userLat: null,
    userLng: null
  };

  let debounceTimer = null;

  function init() {
    // 1. Search Input Typing with Debounce
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      clearSearchBtn.style.display = val ? 'flex' : 'none';

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        activeFilters.q = val;
        triggerFilter();
      }, 250);
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      activeFilters.q = '';
      clearSearchBtn.style.display = 'none';
      triggerFilter();
      searchInput.focus();
    });

    // 2. Keyboard Shortcuts: '/' or 'Cmd+K' / 'Ctrl+K'
    document.addEventListener('keydown', (e) => {
      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // 3. Quick Deity Chips
    deityChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      deityChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      activeFilters.deity = chip.dataset.deity || 'all';
      updateFilterBadge();
      triggerFilter();
    });

    // 4. Toggle Advanced Filters Panel
    filterToggleBtn.addEventListener('click', () => {
      const isVisible = advancedFilterPanel.style.display === 'flex';
      advancedFilterPanel.style.display = isVisible ? 'none' : 'flex';
      filterToggleBtn.classList.toggle('active', !isVisible);
    });

    // 5. State & Style Selectors
    stateFilter.addEventListener('change', (e) => {
      activeFilters.state = e.target.value;
      updateFilterBadge();
      triggerFilter();
    });

    styleFilter.addEventListener('change', (e) => {
      activeFilters.style = e.target.value;
      updateFilterBadge();
      triggerFilter();
    });

    // 6. Reset Filters
    resetFiltersBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      activeFilters.q = '';
      activeFilters.deity = 'all';
      activeFilters.state = 'all';
      activeFilters.style = 'all';

      deityChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      deityChips.querySelector('[data-deity="all"]')?.classList.add('active');

      stateFilter.value = 'all';
      styleFilter.value = 'all';

      updateFilterBadge();
      triggerFilter();
      advancedFilterPanel.style.display = 'none';
      filterToggleBtn.classList.remove('active');
      App.showToast('All filters reset');
    });

    // 7. Near Me Geolocation
    nearMeBtn.addEventListener('click', handleNearMe);
  }

  function updateFilterBadge() {
    let count = 0;
    if (activeFilters.deity !== 'all') count++;
    if (activeFilters.state !== 'all') count++;
    if (activeFilters.style !== 'all') count++;

    if (count > 0) {
      activeFilterBadge.textContent = count;
      activeFilterBadge.style.display = 'inline-block';
    } else {
      activeFilterBadge.style.display = 'none';
    }
  }

  function triggerFilter() {
    // Filter map pins
    TempleMap.filterMarkers(activeFilters);

    // Refresh grid view cards
    App.fetchGridTemples(activeFilters);
  }

  function handleNearMe() {
    if (!navigator.geolocation) {
      App.showToast('Geolocation is not supported by your browser');
      return;
    }

    App.showToast('Locating your position across India...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        activeFilters.userLat = latitude;
        activeFilters.userLng = longitude;

        TempleMap.setUserLocation(latitude, longitude);

        try {
          const res = await fetch(`/api/temples/nearby?lat=${latitude}&lng=${longitude}&radiusKm=250&limit=30`);
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            const nearest = data.data[0];
            App.showToast(`Found ${data.data.length} nearby temples. Closest: ${nearest.name} (${nearest.distanceKm} km away)`);
            App.renderGridCards(data.data);
          } else {
            App.showToast('No registered temples within 250 km. Zooming map.');
          }
        } catch (err) {
          console.error('Nearby fetch error:', err);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        App.showToast('Location permission denied or unavailable');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function populateStateDropdown(statesList) {
    if (!stateFilter || !statesList) return;
    stateFilter.innerHTML = '<option value="all">All States of India</option>';
    for (const [state, count] of statesList) {
      const opt = document.createElement('option');
      opt.value = state;
      opt.textContent = `${state} (${count})`;
      stateFilter.appendChild(opt);
    }
  }

  function getFilters() {
    return { ...activeFilters };
  }

  return {
    init,
    populateStateDropdown,
    getFilters
  };
})();
