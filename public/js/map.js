// Leaflet Map Manager with Custom Glowing Pins & High-Performance Clustering
const TempleMap = (() => {
  let map = null;
  let clusterGroup = null;
  let allMarkersData = [];
  let userMarker = null;

  function init() {
    // 1. Initialize Map centered on Indian Subcontinent
    map = L.map('leafletMap', {
      center: [22.8, 79.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true
    });

    // 2. High-aesthetic Dark Cartographic Basemap (Zero API Key, No Watermark)
    const darkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sacred Temple Atlas',
      maxZoom: 16
    }).addTo(map);

    const darkLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      opacity: 0.65
    }).addTo(map);

    const darkGroup = L.layerGroup([darkBase, darkLabels]);

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri &mdash; Satellite View',
      maxZoom: 18
    });

    const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    L.control.layers({
      'Dark Canvas': darkGroup,
      'Satellite Imagery': satellite,
      'OpenStreetMap': street
    }, null, { position: 'bottomright' }).addTo(map);

    // 3. Initialize Custom Marker Cluster Group
    clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        let size = 36;
        if (count > 100) size = 48;
        else if (count > 30) size = 42;

        return L.divIcon({
          html: `<div class="marker-cluster-custom" style="width:${size}px; height:${size}px;"><span class="cluster-count">${count}</span></div>`,
          className: 'custom-cluster-wrapper',
          iconSize: [size, size]
        });
      }
    });

    map.addLayer(clusterGroup);
  }

  // Custom Sacred Pin DivIcon
  function createPinIcon(temple) {
    return L.divIcon({
      html: `<div class="sacred-pin" title="${temple.name}"><div class="pin-core"></div></div>`,
      className: 'sacred-pin-wrapper',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  // Build sleek hover popup
  function buildPopupContent(t) {
    const imgHtml = t.image 
      ? `<img class="popup-img" src="${t.image}" alt="${t.name}" loading="lazy">` 
      : `<div class="popup-img" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:0.75rem;">No Photo Available</div>`;

    return `
      <div class="popup-mini-card" onclick="Dossier.open('${t.id}')">
        ${imgHtml}
        <div class="popup-details">
          <div class="popup-eyebrow">${t.deity || 'Sanctuary'}</div>
          <div class="popup-title">${t.name}</div>
          <div class="popup-loc">${t.state || 'India'}</div>
        </div>
      </div>
    `;
  }

  function setMarkers(markersData) {
    allMarkersData = markersData;
    renderMarkers(markersData);
  }

  function renderMarkers(dataList) {
    if (!clusterGroup) return;
    clusterGroup.clearLayers();

    const newMarkers = [];
    for (const t of dataList) {
      if (t.lat == null || t.lng == null) continue;

      const marker = L.marker([t.lat, t.lng], {
        icon: createPinIcon(t)
      });

      marker.bindPopup(buildPopupContent(t), {
        maxWidth: 240,
        className: 'custom-leaflet-popup'
      });

      marker.on('click', () => {
        Dossier.open(t.id);
      });

      newMarkers.push(marker);
    }

    clusterGroup.addLayers(newMarkers);
  }

  // Filter markers on the map
  function filterMarkers({ q, deity, state, style }) {
    if (!allMarkersData.length) return;

    let filtered = allMarkersData;

    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      filtered = filtered.filter(t => 
        (t.name && t.name.toLowerCase().includes(term)) ||
        (t.deity && t.deity.toLowerCase().includes(term)) ||
        (t.state && t.state.toLowerCase().includes(term))
      );
    }

    if (deity && deity !== 'all') {
      const dLower = deity.toLowerCase();
      filtered = filtered.filter(t => t.deity && t.deity.toLowerCase().includes(dLower));
    }

    if (state && state !== 'all') {
      const sLower = state.toLowerCase();
      filtered = filtered.filter(t => t.state && t.state.toLowerCase().includes(sLower));
    }

    renderMarkers(filtered);
  }

  function flyTo(lat, lng, zoom = 14) {
    if (!map) return;
    map.flyTo([lat, lng], zoom, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  }

  function setUserLocation(lat, lng) {
    if (!map) return;
    if (userMarker) {
      map.removeLayer(userMarker);
    }

    const userIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#38bdf8;border:2px solid #fff;border-radius:50%;box-shadow:0 0 14px #38bdf8;"></div>`,
      className: 'user-location-pin',
      iconSize: [16, 16]
    });

    userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
    flyTo(lat, lng, 10);
  }

  return {
    init,
    setMarkers,
    renderMarkers,
    filterMarkers,
    flyTo,
    setUserLocation
  };
})();
