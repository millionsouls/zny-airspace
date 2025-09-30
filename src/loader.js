/**
 * Loads geojson files
 */

import { buildMarker } from './constraints.js';
import { handleFeatureHover } from './ui/mouse-hover.js';

const GEODATA = { tracon: {}, enroute: {} };
const GEOLAYERS = { tracon: {}, enroute: {} };
const fetchPromises = [];

/**
 * Create map if does not exist
 * 
 */
function ensurePane(map, paneName, zIndex) {
  if (!map.getPane(paneName)) {
    map.createPane(paneName);
    map.getPane(paneName).style.zIndex = zIndex;
  }
}

/**
 * Guess what the file is: sector/pd/vm, used for single file facilties or those with less files that do not need extra folder dirs
 * 
 * @param {*} data 
 * @returns 
 */
function inferCategory(data) {
  const props = data.features[0]?.properties || {};
  if ('Position' in props) return 'sectors';
  if ('id' in props && ['STAR', 'SID'].includes(props.type.toUpperCase())) {
    return props.type.toLowerCase();
  }
  return 'videomap';
}

/**
 * Load and construct layers for procedures: star/sid. Build the markers and labels.
 * 
 */
function loadPD(map, data, fmtName) {
  const linePane = `pane-lines-${fmtName}`;
  const markerPane = `pane-markers-${fmtName}`;
  ensurePane(map, linePane, 800);
  ensurePane(map, markerPane, 900);

  const markers = [];
  const lines = [];

  data.features.forEach(f => {
    const props = f.properties || {};
    const color = props.color || "#0000ff";

    if (f.geometry.type === "Point") {
      const coords = f.geometry.coordinates;
      const markerDiv = document.createElement("div");
      markerDiv.style = 'display: flex; flex-direction: column; align-items: center;';
      markerDiv.innerHTML = 'Loading';

      const marker = L.marker([coords[1], coords[0]], {
        pane: markerPane,
        icon: L.divIcon({
          className: 'procedure-icon',
          html: markerDiv,
          iconAnchor: [6, 6]
        })
      });

      handleFeatureHover({ properties: props }, marker);
      buildMarker(props, props.type, props.icon).then(html => markerDiv.innerHTML = html);
      markers.push(marker);
    }

    if (f.geometry.type === "LineString") {
      lines.push(L.polyline(f.geometry.coordinates.map(([lng, lat]) => [lat, lng]), {
        color, weight: 3, opacity: 1, pane: linePane
      }));
    }
  });

  return L.layerGroup([L.layerGroup(lines), L.layerGroup(markers)]);
}

/**
 * Load a videomap, nothing special is done with these
 * 
 */
function loadVM(map, data, fmtName) {
  return L.geoJSON(data, {
    style: feature => feature.geometry.type === "LineString" ? { color: "#000", weight: 1.3, interactive: false } : { interactive: false },
    pointToLayer: () => null
  });
}


/**
 * Load in sector files (airspace). 
 * 
 */
function loadSector(map, data, upperKey, category, name) {
  const zIndex = data.features[0]?.properties?.style?.zIndex || 0;
  const featureGroups = {};

  for (const feature of data.features) {
    const props = feature.properties || {};
    const position = props.Position || "UNKNOWN";
    const color = props.Fill || "#3388ff";

    const paneName = `pane-${[upperKey, category, name, position].join('_').replace(/[^\w]/g, '')}`;
    ensurePane(map, paneName, 200 + zIndex);

    const geoJsonLayer = L.geoJSON(feature, {
      pane: paneName,
      style: { color, weight: 3, opacity: 1, fillColor: color, fillOpacity: 0.4 },
      onEachFeature: handleFeatureHover
    });

    featureGroups[position] ??= [];
    featureGroups[position].push(geoJsonLayer);
  }

  const positionGroups = {};
  for (const [pos, layers] of Object.entries(featureGroups)) {
    positionGroups[pos] = L.layerGroup(layers);
  }

  return positionGroups;
}

/**
 * Create directories and paths for all layers that are generated
 * 
 */
function storeMetadata(station, airport, category, name, group, isArray = false) {
  const layers = GEOLAYERS[station];
  const data = GEODATA[station];

  layers[airport] ??= {};
  layers[airport][category] ??= {};
  layers[airport][category][name] = group;

  data[airport] ??= {};
  data[airport][category] ??= isArray ? [] : {};
  if (isArray) {
    data[airport][category].push(name);
  } else {
    data[airport][category][name] = Object.keys(group);
  }
}

/**
 * Start point, loops through the file-index.json and loads it. Create promises to ensure files are loaded before anything else is done.
 * 
 */
function loadGeoFiles(GEOFILES, map) {
  Object.entries(GEOFILES).forEach(([station, domainFiles]) => {
    Object.entries(domainFiles).forEach(([airport, fileArray]) => {
      const upperKey = airport.toUpperCase();

      fileArray.forEach(file => {
        const fetchPromise = fetch(`data/${station}/${airport}/${file}`)
          .then(res => res.json())
          .then(data => {
            if (!data?.features) throw new Error("Missing features");

            const name = data.name || file.split("/").pop().split('.')[0];
            const fmtName = `${upperKey}_${name}`.replace(/[^\w]/g, '');
            const categoryHint = file.split("/")[0].toLowerCase();
            const category = ["sectors", "stars", "sids", "videomap"].includes(categoryHint) ? categoryHint : inferCategory(data);

            if (!category) return;

            let group;
            if (category === "stars" || category === "sids") {
              group = loadPD(map, data, fmtName);
              storeMetadata(station, upperKey, category, name, group, true);
            } else if (category === "videomap") {
              group = loadVM(map, data, fmtName);
              storeMetadata(station, upperKey, category, name, group, true);
            } else {
              group = loadSector(map, data, upperKey, category, name);
              storeMetadata(station, upperKey, category, name, group, false);
            }
          })
          .catch(err => console.error(`Failed to load ${file}:`, err));

        fetchPromises.push(fetchPromise);
      });
    });
  });

  return Promise.all(fetchPromises).then(() => ({ GEODATA, GEOLAYERS }));
}

export { loadGeoFiles, GEODATA, GEOLAYERS };
