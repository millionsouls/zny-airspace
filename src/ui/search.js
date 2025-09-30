/**
 * Handles search mechanics for looking something up
 */

/**
 * Setup search input event, filtering, rendering results and toggling layers
 * 
 */
function setupSearch(GEODATA, GEOLAYERS, map, updateURLFromMapState) {
  const searchInput = document.getElementById("search-input");
  const resultsContainer = document.getElementById("search-results");

  // Position results container next to search input
  const rect = searchInput.getBoundingClientRect();
  resultsContainer.style.top = `${rect.top - searchInput.offsetHeight + 8}px`;
  resultsContainer.style.left = `${rect.left + searchInput.offsetWidth - 2}px`;

  // Hide results on outside click
  document.body.addEventListener("click", (e) => {
    if (!e.target.closest("#search-results") && e.target !== searchInput) {
      resultsContainer.style.display = "none";
    }
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    resultsContainer.innerHTML = "";

    if (!query) {
      resultsContainer.style.display = "none";
      return;
    }

    const keywords = query.split(/\s+/).filter(k => k).map(k => k.toLowerCase());
    const matches = [];

    ['tracon', 'enroute'].forEach(domain => {
      const domainData = GEODATA[domain];

      Object.entries(domainData).forEach(([airport, categories]) => {
        Object.entries(categories).forEach(([category, data]) => {
          if (category === 'sectors' && typeof data === 'object' && !Array.isArray(data)) {
            Object.keys(data).forEach(filename => {
              const combined = `[${domain}] [${airport}] ${filename}`.toLowerCase();
              const allMatch = keywords.every(kw => combined.includes(kw));

              if (allMatch) {
                matches.push({ domain, airport, category, name: filename });
              }
            });
          } else if (Array.isArray(data)) {
            data.forEach(name => {
              const combined = `[${domain}] [${airport}] ${name}`.toLowerCase();
              const allMatch = keywords.every(kw => combined.includes(kw));

              if (allMatch) {
                matches.push({ domain, airport, category, name });
              }
            });
          }
        });
      });
    });

    if (matches.length === 0) {
      resultsContainer.style.display = "none";
      return;
    }

    matches.forEach(({ domain, airport, category, name }) => {
      const id = `toggle-${airport}${category}${name}`;
      const layer = GEOLAYERS[domain]?.[airport]?.[category]?.[name];
      const checkbox = document.getElementById(id);

      const wrapper = document.createElement("div");
      wrapper.className = "search-result";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checkbox?.checked || false;
      cb.id = `search-${id}`;

      cb.addEventListener("change", () => {
        if (!layer || !checkbox) return;
          checkbox.checked = cb.checked;
          checkbox.dispatchEvent(new Event("change"));


        const handleLayer = (l, action) => {
          if (l instanceof L.Layer || l instanceof L.LayerGroup) {
            action === 'add' ? map.addLayer(l) : map.removeLayer(l);
          }
        };

        if (cb.checked) {
          if (typeof layer === 'object' && !Array.isArray(layer)) {
            Object.values(layer).forEach(l => handleLayer(l, 'add'));
          } else {
            handleLayer(layer, 'add');
          }
        } else {
          if (typeof layer === 'object' && !Array.isArray(layer)) {
            Object.values(layer).forEach(l => handleLayer(l, 'remove'));
          } else {
            handleLayer(layer, 'remove');
          }
        }

        updateURLFromMapState();
      });

      const label = document.createElement("label");
      label.htmlFor = cb.id;
      label.textContent = `[${domain.toUpperCase()}] [${airport.toUpperCase()}] [${category.toUpperCase()}] ${name.toUpperCase()}`;

      wrapper.appendChild(cb);
      wrapper.appendChild(label);
      resultsContainer.appendChild(wrapper);
    });

    resultsContainer.style.display = "flex";
  });
}

export { setupSearch };

