/**
 * map.js
 * 
 * Leaflet map configuration and base layers setup
 */

import { GEOLAYERS } from './loader.js'
import { updateURLFromMap } from './url-handler.js';

const CONFIG = {
  center: [40.703376, -74.015415],
  zoom: 7.5,
  minZoom: 5,
  maxZoom: 18,
  maxZoom: 18,
  bounds: [
    [20, -100],
    [50, -10]
  ],
}
const baseLayers = {
  "Standard": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }),
  "Satellite": L.esri.tiledMapLayer({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
  }),
  "Dark": L.esri.tiledMapLayer({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer'
  }),
};

let currentLayer = baseLayers["Standard"]
let basemapVisible = true

const map = L.map('map', {
  center: CONFIG.center,
  zoom: CONFIG.zoom,
  minZoom: CONFIG.minZoom,
  maxZoom: CONFIG.maxZoom,
  maxBounds: CONFIG.bounds,
  layers: [currentLayer],

  zoomControl: false,
  scrollWheelZoom: false, // disable original zoom function
  smoothWheelZoom: true,  // enable smooth zoom 
  smoothSensitivity: 5,   // zoom speed. default is 1
});

L.control.scale({ position: 'bottomright' }).addTo(map);
L.control.layers(baseLayers, null, { position: 'topright', collapsed: false }).addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

const mapToggle = document.getElementById('toggle-basemap');
const resetToggle = document.getElementById('reset-layers');
const markerToggle = document.getElementById('toggle-markers');
const darkToggle = document.getElementById('toggle-darkmode');

// Delay DOM restructuring to ensure controls exist
setTimeout(() => {
  const mapContainer = document.querySelector('.leaflet-top.leaflet-right');

  if (mapContainer) {
    const wrapper = document.createElement('div');
    wrapper.className = 'leaflet-custom-topright';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'row';
    wrapper.style.gap = '6px';

    // Move all children into wrapper
    while (mapContainer.firstChild) {
      wrapper.appendChild(mapContainer.firstChild);
    }
    mapContainer.appendChild(wrapper);
  }
}, 0);

// Toggles visibility of OSM map
mapToggle.addEventListener('click', function () {
  basemapVisible = !basemapVisible;

  if (basemapVisible) {
    map.addLayer(currentLayer);
    mapToggle.innerHTML = '<i class="fa-solid fa-map"></i> Map';
  } else {
    mapToggle.innerHTML= '<i class="fa-regular fa-map"></i> Map';
    Object.values(baseLayers).forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
  }
});

// Resets all toggled map layers/features to off
resetToggle.addEventListener('click', function () {
  // do a barrel roll
  const icon = resetToggle.querySelector('i');
  icon.classList.remove('spin-once');
  void icon.offsetWidth;
  icon.classList.add('spin-once');
  icon.addEventListener('animationend', function handler() {
    icon.classList.remove('spin-once');
    icon.removeEventListener('animationend', handler);
  });

  Object.entries(GEOLAYERS).forEach(([station, airports]) => {
    Object.entries(airports).forEach(([airport, categoryObj]) => {
      Object.entries(categoryObj).forEach(([category, subCategoryObj]) => {
        Object.entries(subCategoryObj).forEach(([name, layerOrDict]) => {
          const mainId = `toggle-${airport}${category}${name}`;
          const mainCheckbox = document.getElementById(mainId);

          // Remove the rightbar container for this file
          const fileContainer = document.getElementById(`rightbar-file-${airport}-${name}`);
          if (fileContainer) fileContainer.remove();

          // Handle standard Layer or LayerGroup
          if (layerOrDict instanceof L.Layer || layerOrDict instanceof L.LayerGroup) {
            if (map.hasLayer(layerOrDict)) {
              map.removeLayer(layerOrDict);
            }
          }
          // Handle sector with positions
          else if (typeof layerOrDict === 'object') {
            Object.entries(layerOrDict).forEach(([positionName, layer]) => {
              if (map.hasLayer(layer)) {
                map.removeLayer(layer);
              }

              // Reset individual position checkbox
              const posId = `toggle-${airport}${category}${name}${positionName}`;
              const posCheckbox = document.getElementById(posId);
              if (posCheckbox) posCheckbox.checked = false;
            });
          }

          // Reset main file checkbox
          if (mainCheckbox) {
            mainCheckbox.checked = false;
          }
        });
      });
    });
  });

  // Clean up empty airport containers in rightbar
  const rightbar = document.getElementById("rightbar");
  rightbar.querySelectorAll(".rightbar-airport-group").forEach(group => group.remove());

  updateURLFromMap();
});

// Toggles visibility of procedure markers (label only)
markerToggle.addEventListener('click', function () {
  const icons = document.querySelectorAll('.procedure-label');
  let anyVisible = Array.from(icons).some(el => el.style.display !== 'none');

  icons.forEach(icon => {
    icon.style.display = anyVisible ? 'none' : '';
  });

  this.classList.toggle('off', anyVisible);
});

darkToggle.addEventListener('click', function () {
  document.documentElement.classList.toggle('dark-mode')

  if (document.documentElement.classList.contains('dark-mode')) {
    map.removeLayer(currentLayer)
    currentLayer = baseLayers["Dark"]
    map.addLayer(currentLayer)
  } else {
    map.removeLayer(currentLayer)
    currentLayer = baseLayers["Standard"]
    map.addLayer(currentLayer)
  }

  // Re-style all active videomaps
  const lineColor = document.documentElement.classList.contains('dark-mode') ? '#d6d6d6' : '#000';

  Object.entries(GEOLAYERS).forEach(([station, airports]) => {
    Object.entries(airports).forEach(([airport, categoryObj]) => {
      if (!categoryObj.videomap) return;

      Object.entries(categoryObj.videomap).forEach(([name, layer]) => {
        if (layer instanceof L.GeoJSON && map.hasLayer(layer)) {
          layer.setStyle(feature => {
            return feature.geometry.type === "LineString" ? { color: lineColor, weight: 1.3 } : {};
          })
        }
      })
    })
  })
});


export { map }