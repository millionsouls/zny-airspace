/**
 * Handles encoding/decoding of layer settings in the URL for map state sharing
 */

// Category abbreviations for encoding
const CAT_ABBR = { sectors: 1, stars: 2, sids: 3, videomap: 4 };
const CAT_ABBR_REV = { 1: 'sectors', 2: 'stars', 3: 'sids', 4: 'videomap' };
const INCLUDE_POS = true;

/**
 * Utility functions for encoding/decoding and compression
 */
function encBase64(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decBase64(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}
function compress(str) {
  return LZString.compressToEncodedURIComponent(str);
}
function decompress(str) {
  return LZString.decompressFromEncodedURIComponent(str);
}

/**
 * Encodes layer data into a compact string for URL usage
 * @param {Object} stationLayers - Layer data for a station
 * @returns {string} - Encoded string
 */
function encodeLayers(stationLayers) {
  const airports = [];
  const [[station, data]] = Object.entries(stationLayers);

  Object.entries(data).forEach(([apt, cats]) => {
    const catStrs = [];
    for (const cat in cats) {
      const abbr = CAT_ABBR[cat];
      if (!abbr) continue;
      const layers = cats[cat];
      if (!layers) continue;

      // Handle sectors (special case for positions)
      if (cat === 'sectors' && typeof layers === 'object' && !Array.isArray(layers)) {
        const sectorStrs = [];
        Object.entries(layers).forEach(([file, pos]) => {
          if (station === 'enroute') {
            if (pos && pos.length > 0) sectorStrs.push(file);
            return;
          }
          if (!pos || pos.length === 0) {
            if (!INCLUDE_POS) sectorStrs.push(file);
            return;
          }
          if (INCLUDE_POS) {
            const suffix = pos.map(p => p.slice(-1)).join(',');
            sectorStrs.push(`${file}-${suffix}`);
          } else {
            sectorStrs.push(file);
          }
        });
        if (sectorStrs.length) catStrs.push(`${abbr}:${sectorStrs.join('|')}`);
      } else if (Array.isArray(layers) && layers.length) {
        catStrs.push(`${abbr}:${layers.join(',')}`);
      }
    }
    if (catStrs.length) airports.push(`${apt};${catStrs.join(';')}`);
  });

  if (!airports.length) return "";
  return compress(airports.join('||'));
}

/**
 * Decodes layer data from a compact URL string
 * @param {string} encoded - Encoded string from URL
 * @param {string} station - Station type ('enroute' or 'tracon')
 * @returns {Object} - Decoded layer data
 */
function decodeLayers(encoded, station) {
  if (!encoded) return {};
  try {
    const decoded = decompress(encoded);
    const airports = decoded.split('||').filter(Boolean);
    const result = {};

    console.log(result)

    airports.forEach(aptStr => {
      const parts = aptStr.split(';');
      const apt = parts[0];
      if (!apt) return;
      result[apt] = {};

      parts.slice(1).forEach(catPart => {
        const [abbr, ...layerParts] = catPart.split(':');
        const layerStr = layerParts.join(':');
        if (!abbr || !layerStr) return;
        const cat = CAT_ABBR_REV[abbr];
        if (!cat) return;

        if (cat === 'sectors') {
          if (station === 'enroute') {
            const files = layerStr.split('|').filter(Boolean);
            if (files.length) result[apt][cat] = files;
            return;
          }

          // TRACON: handle positions
          const sectorObj = {};
          layerStr.split('|').forEach(entry => {
            const dashIdx = entry.lastIndexOf('-');
            if (dashIdx === -1) {
              sectorObj[entry] = [];
            } else {
              const file = entry.slice(0, dashIdx);
              const suffixes = entry.slice(dashIdx + 1).split(',').filter(Boolean);
              sectorObj[file] = suffixes;
            }
          });
          if (Object.keys(sectorObj).length) result[apt][cat] = sectorObj;
        } else if (['sids', 'stars', 'videomap'].includes(cat)) {
          const items = layerStr.split(',').filter(Boolean);
          if (items.length) result[apt][cat] = items;
        }
      });
    });
    return result;
  } catch (err) {
    console.error('URL Decode error:', err);
    return {};
  }
}

/**
 * Reads enabled layers from the URL parameters
 * @returns {Object} - Enabled layers by station
 */
function getLayersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const enrouteParam = params.get("e");
  const traconParam = params.get("t");
  const result = {};

  if (enrouteParam) result.enroute = decodeLayers(enrouteParam, 'enroute');
  if (traconParam) result.tracon = decodeLayers(traconParam, 'tracon');
  return result;
}

/**
 * Updates the URL to reflect the current map state
 */
function updateURLFromMap() {
  if (!window.LayerControl) return;
  const active = window.LayerControl.getActive();
  const url = new URL(window.location);

  if (active.enroute && Object.keys(active.enroute).length) {
    url.searchParams.set("e", encodeLayers({ enroute: active.enroute }));
  } else {
    url.searchParams.delete("e");
  }

  if (active.tracon && Object.keys(active.tracon).length) {
    url.searchParams.set("t", encodeLayers({ tracon: active.tracon }));
  } else {
    url.searchParams.delete("t");
  }

  history.replaceState(null, "", url);
}

export { getLayersFromURL, updateURLFromMap };