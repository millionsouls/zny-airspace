/**
 * Generates and loads custom URL links to defined layer/feature settings
 * 
 */

const categoryAbbr = {
  sectors: 1,
  stars: 2,
  sids: 3,
  videomap: 4,
};
const categoryAbbrReverse = {
  1: 'sectors',
  2: 'stars',
  3: 'sids',
  4: 'videomap'
};
const includePositions = true;


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
 * Transforms dictionary into custom encoded string, then is base64'ed.
 * ex: tracon::ABE;1:ABE-D||enroute::AREA-A;1:N56
 *                          
 * @param {*} layersNested 
 * @returns 
 */
function encodeLayers(stationData) {
  const domainStrings = [];

  Object.entries(stationData).forEach(([station, data]) => {
    const airportStrings = [];

    Object.entries(data).forEach(([airport, categories]) => {
      const catStrings = [];

      for (const cat in categories) {
        const abbr = categoryAbbr[cat];
        if (!abbr) continue;
        const layers = categories[cat];
        if (!layers) continue;

        if (cat === 'sectors' && typeof layers === 'object' && !Array.isArray(layers)) {
          const sectorStrings = [];

          Object.entries(layers).forEach(([filename, positions]) => {
            // For enroute, only encode the filename if any positions are active
            if (station === 'enroute') {
              if (positions && positions.length > 0) {
                sectorStrings.push(filename);
              }
              return;
            }

            if (!positions || positions.length === 0) {
              if (!includePositions) {
                sectorStrings.push(filename);
              }
              return;
            }

            if (includePositions) {
              const suffixes = positions.map(p => p.slice(-1)).join(',');
              sectorStrings.push(`${filename}-${suffixes}`);
            } else {
              sectorStrings.push(filename);
            }
          });

          if (sectorStrings.length > 0) {
            catStrings.push(`${abbr}:${sectorStrings.join('|')}`);
          }
        } else if (Array.isArray(layers)) {
          if (layers.length > 0) {
            catStrings.push(`${abbr}:${layers.join(',')}`);
          }
        }
      }

      if (catStrings.length === 0) return;
      airportStrings.push(`${airport};${catStrings.join(';')}`);
    });

    if (airportStrings.length === 0) return;
    domainStrings.push(`${station}::${airportStrings.join('|')}`);
  });

  const compactStr = domainStrings.join('||');
  return compress(compactStr);
}

/**
 * Decode string into readable dictionary
 * 
 * @param {*} param 
 * @returns 
 */
function decodeLayers(encoded, GEOLAYERS) {
  if (!encoded) return {};
  console.log("url sees: ", encoded)
  try {
    const decoded = decompress(encoded);
    const domainParts = decoded.split('||');
    const result = {};

    domainParts.forEach(domainPart => {
      const [station, airportsRaw] = domainPart.split('::');
      if (!station || !airportsRaw) return;

      result[station] = {};

      const airportsArr = airportsRaw.split('|');
      airportsArr.forEach(airportStr => {
        const parts = airportStr.split(';');
        const airport = parts[0];
        if (!airport) return;

        result[station][airport] = {};

        parts.slice(1).forEach(catPart => {
          const [catAbbr, ...layerParts] = catPart.split(':');
          const layerStr = layerParts.join(':');
          if (!catAbbr || !layerStr) return;

          const cat = categoryAbbrReverse[catAbbr];
          if (!cat) return;

          if (cat === 'sectors') {
            if (station === 'enroute') {
              // ENROUTE: just an array of filenames
              const filenames = layerStr.split('|').filter(Boolean);
              if (filenames.length > 0) {
                result[station][airport][cat] = filenames;
              }
              return;
            }

            // TRACON: seperate out position names
            const sectorObj = {};
            const entries = layerStr.split('|');

            entries.forEach(entry => {
              const [filename, suffixStr] = entry.split('-');
              if (!filename) return;

              if (!suffixStr) {
                sectorObj[filename] = [];
              } else {
                const suffixes = suffixStr.split(',').filter(Boolean);
                sectorObj[filename] = suffixes;
              }
            });

            if (Object.keys(sectorObj).length > 0) {
              result[station][airport][cat] = sectorObj;
            }
          } else if (['sids', 'stars', 'videomap'].includes(cat)) {
            const items = layerStr.split(',').filter(Boolean);
            if (items.length > 0) {
              result[station][airport][cat] = items;
            }
          }
        });
      });
    });
    console.log("url out: ", result)
    return result;
  } catch (err) {
    console.error('URL Decode error:', err);
    return {};
  }
}

/**
 * Extract URL on page load and decode it
 * 
 * @returns 
 */
function getEnabledLayersFromURL(GEOLAYERS) {
  const params = new URLSearchParams(window.location.search);
  const layerParam = params.get("l");

  if (!layerParam) return {};

  return decodeLayers(layerParam, GEOLAYERS);
}

/**
 * Detects map state changes and reflects them in the URL
 * 
 * @returns 
 */
function updateURLFromMapState() {
  if (!window.LayerControl) return;
  const enabled = window.LayerControl.getActiveLayers()
  const url = new URL(window.location);

  if (Object.keys(enabled).length > 0) {
    url.searchParams.set("l", encodeLayers(enabled));
  } else {
    url.searchParams.delete("l");
  }
  history.replaceState(null, "", url);
}

export { getEnabledLayersFromURL, updateURLFromMapState };