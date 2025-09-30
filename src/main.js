/**
 * Startup script: Initializes map, UI, layers, and URL state.
 */

import { loadGeoFiles, GEODATA, GEOLAYERS } from './loader.js';
import { map } from './map.js';
import { buildSidebar, attachSidebarListeners } from './ui/sidebar.js';
import { setupSearch } from './ui/search.js';
import { getLayersFromURL, updateURLFromMap } from './url-handler.js';

let ACTIVE_STATION = 'tracon';
window.CALLSIGN_MODE;

// Helper functions
function toggleCheckbox(id, checked = true) {
  const checkbox = document.getElementById(id);
  if (checkbox) {
    if (checkbox.checked !== checked) {
      checkbox.checked = checked;
      checkbox.dispatchEvent(new Event('change'));
    }
  }
}
function getLayer(station, airport, category, name, position = null) {
  const base = GEOLAYERS[station]?.[airport]?.[category]?.[name];
  if (!base) return null;
  return position ? base[position] : base;
}
function activateLayer(layer) {
  if (layer && !map.hasLayer(layer)) map.addLayer(layer);
}
function deactivateLayer(layer) {
  if (layer && map.hasLayer(layer)) map.removeLayer(layer);
}

// Switching between terminal and enroute selections
function switchDomain(newDomain) {
  ACTIVE_STATION = newDomain;

  document.querySelectorAll('[id^="sidebar-station-"]').forEach(div => {
    div.style.display = (div.id === `sidebar-station-${ACTIVE_STATION}`) ? "block" : "none";
  });

  updateURLFromMap();
}

/**
 * LayerControl: Tracks active layers and syncs with URL.
 * 
 * 
 * getActive: Returns currently active layers by station/airport/category
 * setActive: Activates layers based on decoded state objects, syncs checkboxes and map layers
 */
window.LayerControl = {
  getActive() {
    const active = {};

    for (const [station, airports] of Object.entries(GEOLAYERS)) {
      active[station] = {};

      for (const [apt, cats] of Object.entries(airports)) {
        active[station][apt] = {};

        for (const [cat, files] of Object.entries(cats)) {
          if (cat === 'sectors') {
            // Sectors: collect active positions per file
            const actSec = {};
            for (const [file, posObj] of Object.entries(files)) {
              const actPos = Object.entries(posObj).filter(([_, lyr]) => map.hasLayer(lyr)).map(([pos]) => pos);
              if (actPos.length) actSec[file] = actPos;
            }
            if (Object.keys(actSec).length) active[station][apt][cat] = actSec;
          } else {
            // Other categories: collect active layer names
            const actNames = Object.entries(files).filter(([_, lyr]) => map.hasLayer(lyr)).map(([name]) => name);
            if (actNames.length) active[station][apt][cat] = actNames;
          }
        }
      }
    }
    return active;
  },

  setActive(decoded) {
    for (const [station, airports] of Object.entries(decoded)) {
      for (const [apt, cats] of Object.entries(airports)) {
        for (const [cat, val] of Object.entries(cats)) {
          if (cat === 'sectors') {
            if (station === 'enroute' && Array.isArray(val)) {
              // Enroute: activate all positions for each sector file
              val.forEach(file => {
                const posObj = getLayer(station, apt, cat, file);

                if (!posObj) return;

                Object.entries(posObj).forEach(([pos, lyr]) => {
                  activateLayer(lyr);
                  toggleCheckbox(`toggle-${apt}sectors${file}${pos}`);
                });
                toggleCheckbox(`toggle-${apt}sectors${file}`);
              });
            } else {
              // Tracon: activate specific positions per sector file
              for (const [file, actPos] of Object.entries(val)) {
                const posObj = getLayer(station, apt, cat, file);

                if (!posObj) continue;

                const allPos = Object.keys(posObj);
                let toAct = [];

                if (Array.isArray(actPos) && actPos.length) {
                  // If actPos are suffixes, match them
                  toAct = actPos.every(p => allPos.includes(p))
                    ? actPos
                    : allPos.filter(p => actPos.some(sfx => p.endsWith(sfx)));
                }
                // Main sector checkbox
                const mainId = `toggle-${apt}sectors${file}`;
                const mainCb = document.getElementById(mainId);
                
                if (mainCb) {
                  mainCb.checked = !!toAct.length;
                  mainCb.dispatchEvent(new Event('change'));
                }

                // Activate/deactivate positions
                Object.entries(posObj).forEach(([pos, lyr]) => {
                  if (toAct.includes(pos)) activateLayer(lyr);
                  else deactivateLayer(lyr);
                  toggleCheckbox(`toggle-${apt}sectors${file}${pos}`, toAct.includes(pos));
                });
              }
            }
          } else {
            // Other categories: activate layers by name
            val.forEach(name => {
              const lyr = getLayer(station, apt, cat, name);
              if (lyr) {
                activateLayer(lyr);
                toggleCheckbox(`toggle-${apt}${cat}${name}`);
              }
            });
          }
        }
      }
    }
    updateURLFromMap();
  }
};

// Initialize
fetch('data/file-index.json')
  .then(res => {
    if (!res.ok) throw new Error('Failed to load file-index.json');
    return res.json();
  })
  .then(geoFiles => loadGeoFiles(geoFiles, map))
  .then(() => {
    buildSidebar(GEODATA, GEOLAYERS, map, updateURLFromMap, ACTIVE_STATION);
    attachSidebarListeners(document.getElementById("sidebar"));
    setupSearch(GEODATA, GEOLAYERS, map, updateURLFromMap);

    const callsignBtn = document.getElementById("toggle-callsign");
    const enabled = getLayersFromURL();

    window.LABEL_MODE = 'pos';

    if (enabled) {
      window.LayerControl.setActive(enabled);
    }

    document.getElementById("btn-tracon").addEventListener("click", () => switchDomain("tracon"));
    document.getElementById("btn-enroute").addEventListener("click", () => switchDomain("enroute"));
    callsignBtn.addEventListener("click", () => {
      if (window.LABEL_MODE === 'pos') {
        window.LABEL_MODE = 'sector';
        callsignBtn.innerHTML = '<i class="fa-solid fa-headset"></i> Callsign';
      } else {
        window.LABEL_MODE = 'pos';
        callsignBtn.innerHTML = '<i class="fa-solid fa-id-badge"></i> ID';
      }

      // Refresh hover and rightbar labels
      const box = document.getElementById('feature-info-box');
      if (box) box.style.display = 'none';
      window.refreshRightbarLabels?.();
    });
  })
  .catch(err => {
    console.error("Failed to initialize app:", err);
  });
