/**
 * Dynamically creates a sidebar and autofills with options based on loaded .geojson files
 */

const categoryMap = {
  sectors: "Sectors",
  stars: "STARs",
  sids: "SIDs",
  videomap: "Videomap"
};

function buildCheckbox(id, label, checked = false) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''}> <label for="${id}">${label}</label>`;
  return wrapper;
}

/**
 * Constructs the checkboxes
 * 
 * @param {*} map 
 * @param {*} positionLayers 
 * @param {*} fileId 
 * @param {*} airport 
 * @param {*} categoryLabel 
 * @param {*} name 
 * @param {*} updateURL 
 * @returns 
 */
function buildToggle(map, positionLayers, fileId, airport, categoryLabel, name, updateURL) {
  const container = document.createElement("div");
  container.className = "rightbar-file";
  container.id = fileId;

  const header = document.createElement("div");
  header.innerText = name;
  header.style.fontWeight = "600";
  container.appendChild(header);

  Object.entries(positionLayers).forEach(([positionName, layer]) => {
    const posId = `toggle-${airport}${categoryLabel}${name}${positionName}`;
    const checkboxDiv = buildCheckbox(posId, positionName, true);
    checkboxDiv.className = "position-id-toggle";

    checkboxDiv.querySelector("input").addEventListener("change", function () {
      this.checked ? map.addLayer(layer) : map.removeLayer(layer);
      updateURL();
    });

    container.appendChild(checkboxDiv);
  });

  return container;
}

/**
 * Construct the sidebar containing options for toggling layers. This creates options for both tracon and enroute but hides enroute initally.
 * 
 * @param {*} GEODATA 
 * @param {*} GEOLAYERS 
 * @param {*} map 
 * @param {*} updateURL 
 * @param {*} activeDomain 
 */
function buildSidebar(GEODATA, GEOLAYERS, map, updateURL, activeDomain = 'tracon') {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";

  ['tracon', 'enroute'].forEach(domain => {
    const domainWrapper = document.createElement("div");
    domainWrapper.id = `sidebar-station-${domain}`;
    domainWrapper.style.display = (domain === activeDomain) ? "block" : "none";

    Object.entries(GEODATA[domain] || {}).forEach(([airport, categories]) => {
      const dropdown = document.createElement("div");
      dropdown.className = "dropdown";

      const toggle = document.createElement("div");
      toggle.className = "dropdown-toggle";
      toggle.innerHTML = `<span>${airport}</span><i class="fa fa-caret-left"></i>`;

      const container = document.createElement("div");
      container.className = "dropdown-container";

      Object.entries(categories).forEach(([category, items]) => {
        const names = (category === 'sectors' && typeof items === 'object') ? Object.keys(items) : items;
        if (!Array.isArray(names) || names.length === 0) return;

        const displayName = categoryMap[category] || category;
        const usePopup = names.length >= 5;
        const targetContainer = usePopup ? document.createElement("div") : container;

        if (usePopup) {
          targetContainer.className = "popup-sidemenu";
          targetContainer.style.display = "none";

          const groupDiv = document.createElement("div");
          groupDiv.className = "sidemenu-toggle";
          groupDiv.innerHTML = `<span>${displayName}</span><i class="fa fa-caret-right"></i>`;

          groupDiv.addEventListener("click", e => {
            sidebar.querySelectorAll(".popup-sidemenu").forEach(p => {
              if (p !== targetContainer) p.style.display = "none";
            });
            targetContainer.style.display = targetContainer.style.display === "none" ? "flex" : "none";
            targetContainer.style.top = `${groupDiv.getBoundingClientRect().top}px`;
            e.stopPropagation();
          });

          container.appendChild(groupDiv);
          container.appendChild(targetContainer);
        } else {
          const label = document.createElement("div");
          label.style.fontWeight = "600";
          label.style.marginTop = "6px";
          label.innerHTML = displayName;
          container.appendChild(label);
        }

        names.forEach(name => {
          const checkboxId = `toggle-${airport}${category}${name}`;
          const checkboxDiv = buildCheckbox(checkboxId, name);
          targetContainer.appendChild(checkboxDiv);

          const checkbox = checkboxDiv.querySelector("input");
          const entry = GEOLAYERS[domain]?.[airport]?.[category]?.[name];

          checkbox.addEventListener("change", function () {
            if (!entry) return;
            const layers = (entry instanceof L.Layer || entry instanceof L.LayerGroup)
              ? [entry]
              : Object.values(entry);

            layers.forEach(layer => this.checked ? map.addLayer(layer) : map.removeLayer(layer));
            updateURL();
          });

          if (category === 'sectors') {
            checkbox.addEventListener("change", function () {
              const rightbar = document.getElementById("rightbar");
              const groupId = `rightbar-airport-${airport}`;
              const fileId = `rightbar-file-${airport}-${name}`;

              if (!this.checked) {
                document.getElementById(fileId)?.remove();
                const group = document.getElementById(groupId);
                if (group && group.querySelectorAll('.rightbar-file').length === 0) group.remove();
                return;
              }

              let group = document.getElementById(groupId);
              if (!group) {
                group = document.createElement("div");
                group.id = groupId;
                group.className = "rightbar-airport-group";
                group.style.marginBottom = "16px";

                const header = document.createElement("div");
                header.className = "position-airport-header dropdown-toggle";
                header.innerText = airport;

                group.appendChild(header);
                rightbar.appendChild(group);
              }

              const fileContainer = buildToggle(map, entry, fileId, airport, category, name, updateURL);
              group.appendChild(fileContainer);
            });
          }
        });
      });

      dropdown.appendChild(toggle);
      dropdown.appendChild(container);
      domainWrapper.appendChild(dropdown);
    });
    attachFilterListeners();

    sidebar.appendChild(domainWrapper);
  });
}

/**
 * Event handles when user clicks on a dropdown, expand and show the menu
 * @param {*} sidebar 
 */
function attachSidebarListeners(sidebar) {
  sidebar.addEventListener("click", function (e) {
    const toggle = e.target.closest(".dropdown-toggle");
    if (toggle) {
      const container = toggle.nextElementSibling;
      if (container?.classList.contains("dropdown-container")) {
        const isOpen = container.style.display === "block";
        container.style.display = isOpen ? "none" : "block";
        toggle.classList.toggle("open", !isOpen);
      }
      e.stopPropagation();
    }
  });
}

function filterCategory(categoryKey) {
  const displayLabel = categoryMap[categoryKey].toLowerCase();

  document.querySelectorAll("#sidebar .dropdown").forEach(dropdown => {
    const toggle = dropdown.querySelector(".dropdown-toggle");
    const container = dropdown.querySelector(".dropdown-container");

    let foundMatchingItems = false;

    Array.from(container.children).forEach(child => {
      if (child.tagName === "DIV" && child.style.fontWeight === "600") {
        child.style.display = "none";
        return; // skip further checks for this element
      }

      if (child.classList.contains("popup-sidemenu")) {
        // Show popup container only if matches filter
        const matchesCategory = child.previousSibling?.textContent?.toLowerCase().includes(displayLabel);
        child.style.display = matchesCategory ? "flex" : "none";
        if (matchesCategory) foundMatchingItems = true;
        return;
      }

      if (child.classList.contains("sidemenu-toggle")) {
        const matchesCategory = child.textContent.toLowerCase().includes(displayLabel);
        child.style.display = matchesCategory ? "" : "none";
        return;
      }

      if (child.querySelector) {
        const checkbox = child.querySelector("input[type=checkbox]");
        if (checkbox) {
          // Check if checkbox id contains categoryKey (like "sectors", "stars", etc)
          const belongsToCategory = checkbox.id.toLowerCase().includes(categoryKey.toLowerCase());
          if (belongsToCategory) {
            child.style.display = "";
            foundMatchingItems = true;
          } else {
            child.style.display = "none";
          }
        }
      }
    });

    // Show or hide entire dropdown and container depending on matches found
    if (foundMatchingItems) {
      dropdown.style.display = "block";
      container.style.display = "block";
      toggle.classList.add("open");
    } else {
      dropdown.style.display = "none";
      container.style.display = "none";
      toggle.classList.remove("open");
    }
  });
}


function attachFilterListeners() {
  document.querySelectorAll(".category-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.category;
      filterCategory(category);
    });
  });

  document.getElementById("reset-category-filter").addEventListener("click", () => {
    resetCategoryFilter();
  });
}

function resetCategoryFilter() {
  document.querySelectorAll("#sidebar .dropdown").forEach(dropdown => {
    dropdown.style.display = "block";
    const container = dropdown.querySelector(".dropdown-container");
    container.style.display = "none";
    dropdown.querySelector(".dropdown-toggle")?.classList.remove("open");

    // Show all sub-sections inside dropdown
    container.querySelectorAll(":scope > div").forEach(group => {
      group.style.display = "";
    });
  });
}



export { buildSidebar, attachSidebarListeners };
