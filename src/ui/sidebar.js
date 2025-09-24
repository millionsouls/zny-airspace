/**
 * Dynamically creates sidebar options based on loaded .geojson files.
 */

const CAT_LABELS = {
  sectors: "Sectors",
  stars: "STARs",
  sids: "SIDs",
  videomap: "Videomap"
};

window.refreshRightbarLabels = refreshRightbarLabels;

// Create a checkbox element
function makeCheckbox(id, label, checked = false) {
  const div = document.createElement("div");
  div.innerHTML = `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''}> <label for="${id}">${label}</label>`;
  return div;
}

/**
 * Crawl a Leaflet layer (which may be a group) and return the first feature.properties we find.
 */
function findAnyFeatureProps(layer) {
  let props = null;
  const visit = (lyr) => {
    if (props) return;
    if (lyr && lyr.feature && lyr.feature.properties) {
      props = lyr.feature.properties;
      return;
    }
    if (typeof lyr.eachLayer === "function") {
      lyr.eachLayer(visit);
    }
  };
  visit(layer);
  return props || {};
}

/**
 * Given a position-key and its layer, compute the two label variants:
 * - posLabel: Position (from the key or the feature)
 * - sectorLabel: Sector (from feature props; fallback to posLabel)
 */
function computeLabelsForPosition(posKey, layerForPos) {
  const props = findAnyFeatureProps(layerForPos);
  const posLabel = posKey || props.Position || props.position || "";
  const sectorLabel = props.Sector || props.sector || posLabel;
  return { posLabel, sectorLabel };
}

/**
 * Build toggles for sector positions (rightbar)
 * Uses the active global window.LABEL_MODE to decide which text to show.
 */
function makeSectorToggle(map, posLayers, fileId, apt, cat, name, updateURL) {
  const cont = document.createElement("div");
  cont.className = "rightbar-file";
  cont.id = fileId;

  const header = document.createElement("div");
  header.innerText = name;
  header.style.fontWeight = "600";
  cont.appendChild(header);

  Object.entries(posLayers).forEach(([posKey, layer]) => {
    const posId = `toggle-${apt}${cat}${name}${posKey}`;

    const { posLabel, sectorLabel } = computeLabelsForPosition(posKey, layer);
    const initialText = (window.LABEL_MODE === "sector") ? sectorLabel : posLabel;

    const cbDiv = makeCheckbox(posId, initialText, true);
    cbDiv.className = "position-id-toggle";

    // store both variants for live retitling when toggled
    cbDiv.dataset.posLabel = posLabel;
    cbDiv.dataset.sectorLabel = sectorLabel;

    cbDiv.querySelector("input").addEventListener("change", function () {
      this.checked ? map.addLayer(layer) : map.removeLayer(layer);
      updateURL();
    });

    cont.appendChild(cbDiv);
  });

  return cont;
}

/**
 * Position popup menu near trigger
 */
function positionPopupSidemenu(menu, trigger) {
  const rect = trigger.getBoundingClientRect();
  menu.style.display = "flex";
  menu.style.visibility = "hidden";

  const h = menu.offsetHeight;
  menu.style.visibility = "";
  menu.style.display = "flex";

  const vh = window.innerHeight;

  let top = rect.top;
  
  if (top + h > vh - 10) top = Math.max(10, vh - h - 10);
  menu.style.top = `${top - 20}px`;
}

/**
 * Build sidebar with layer toggles for both tracon and enroute.
 */
function buildSidebar(GEODATA, GEOLAYERS, map, updateURL, activeDomain = 'tracon') {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";

  ['tracon', 'enroute'].forEach(domain => {
    const domainDiv = document.createElement("div");
    domainDiv.id = `sidebar-station-${domain}`;
    domainDiv.style.display = (domain === activeDomain) ? "block" : "none";

    Object.entries(GEODATA[domain] || {}).forEach(([apt, cats]) => {
      const dd = document.createElement("div");
      dd.className = "dropdown";

      const ddToggle = document.createElement("div");
      ddToggle.className = "dropdown-toggle";
      ddToggle.innerHTML = `<span>${apt}</span><i class="fa fa-caret-left"></i>`;

      const ddCont = document.createElement("div");
      ddCont.className = "dropdown-container";

      Object.entries(cats).forEach(([cat, items]) => {
        let names = (cat === 'sectors' && typeof items === 'object') ? Object.keys(items) : items;
        if (!Array.isArray(names) || !names.length) return;
        names = names.slice().sort((b, a) => b.localeCompare(a));

        const label = CAT_LABELS[cat] || cat;
        const popup = names.length >= 99; // LIMIT FOR POP-UP
        const tgt = popup ? document.createElement("div") : ddCont;

        if (popup) {
          tgt.className = "popup-sidemenu";
          tgt.style.display = "none";

          const groupDiv = document.createElement("div");
          groupDiv.className = "sidemenu-toggle";
          groupDiv.innerHTML = `<span>${label}</span><i class="fa fa-caret-right"></i>`;

          groupDiv.addEventListener("click", e => {
            sidebar.querySelectorAll(".popup-sidemenu").forEach(p => {
              if (p !== tgt) p.style.display = "none";
            });
            tgt.style.display = tgt.style.display === "none" ? "flex" : "none";
            if (tgt.style.display === "flex") positionPopupSidemenu(tgt, groupDiv);
            e.stopPropagation();
          });

          ddCont.appendChild(groupDiv);
          ddCont.appendChild(tgt);
        } else {
          const lbl = document.createElement("div");
          lbl.style.fontWeight = "600";
          lbl.style.marginTop = "6px";
          lbl.style.fontSize = "14px";
          lbl.innerHTML = label;
          ddCont.appendChild(lbl);
        }

        names.forEach(name => {
          const cbId = `toggle-${apt}${cat}${name}`;
          const cbDiv = makeCheckbox(cbId, name);
          tgt.appendChild(cbDiv);

          const cb = cbDiv.querySelector("input");
          const entry = GEOLAYERS[domain]?.[apt]?.[cat]?.[name];

          cb.addEventListener("change", function () {
            if (!entry) return;
            const layers = (entry instanceof L.Layer || entry instanceof L.LayerGroup)
              ? [entry]
              : Object.values(entry);
            layers.forEach(layer => this.checked ? map.addLayer(layer) : map.removeLayer(layer));
            updateURL();
          });

          // Sectors: show position toggles in rightbar
          if (cat === 'sectors') {
            cb.addEventListener("change", function () {
              const rightbar = document.getElementById("rightbar");
              const groupId = `rightbar-airport-${apt}`;
              const fileId = `rightbar-file-${apt}-${name}`;

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
                header.innerText = apt;

                group.appendChild(header);
                rightbar.appendChild(group);
              }

              // entry is the position -> LayerGroup mapping
              const fileCont = makeSectorToggle(map, entry, fileId, apt, cat, name, updateURL);
              group.appendChild(fileCont);
            });
          }
        });
      });

      dd.appendChild(ddToggle);
      dd.appendChild(ddCont);
      domainDiv.appendChild(dd);
    });
    attachFilterListeners();
    sidebar.appendChild(domainDiv);
  });
}

/**
 * Handles dropdown expand/collapse.
 */
function attachSidebarListeners(sidebar) {
  sidebar.addEventListener("click", function (e) {
    const toggle = e.target.closest(".dropdown-toggle");
    if (toggle) {
      const cont = toggle.nextElementSibling;
      if (cont?.classList.contains("dropdown-container")) {
        const open = cont.style.display === "block";
        cont.style.display = open ? "none" : "block";
        toggle.classList.toggle("open", !open);
      }
      e.stopPropagation();
    }
  });
}

// Filter sidebar by category
function filterCategory(catKey) {
  const label = CAT_LABELS[catKey].toLowerCase();

  document.querySelectorAll("#sidebar .dropdown").forEach(dd => {
    const toggle = dd.querySelector(".dropdown-toggle");
    const cont = dd.querySelector(".dropdown-container");
    let found = false;

    Array.from(cont.children).forEach(child => {
      if (child.tagName === "DIV" && child.style.fontWeight === "600") {
        child.style.display = "none";
        return;
      }
      if (child.classList.contains("popup-sidemenu")) {
        const match = child.previousSibling?.textContent?.toLowerCase().includes(label);
        child.style.display = match ? "flex" : "none";
        if (match) found = true;
        return;
      }
      if (child.classList.contains("sidemenu-toggle")) {
        const match = child.textContent.toLowerCase().includes(label);
        child.style.display = match ? "" : "none";
        return;
      }
      if (child.querySelector) {
        const cb = child.querySelector("input[type=checkbox]");
        if (cb) {
          const belongs = cb.id.toLowerCase().includes(catKey.toLowerCase());
          child.style.display = belongs ? "" : "none";
          if (belongs) found = true;
        }
      }
    });

    dd.style.display = found ? "block" : "none";
    cont.style.display = found ? "block" : "none";
    toggle.classList.toggle("open", found);
  });
}

// Attach listeners for category filter buttons
function attachFilterListeners() {
  let activeFilter = null;
  const buttons = document.querySelectorAll(".category-filter");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.category;
      buttons.forEach(b => b.classList.remove("active-filter"));

      if (activeFilter === cat) {
        resetCategoryFilter();
        activeFilter = null;
      } else {
        filterCategory(cat);
        activeFilter = cat;
        btn.classList.add("active-filter");
      }
    });
  });
}

// Reset all category filters
function resetCategoryFilter() {
  document.querySelectorAll("#sidebar .dropdown").forEach(dd => {
    dd.style.display = "block";
    const cont = dd.querySelector(".dropdown-container");
    cont.style.display = "none";
    dd.querySelector(".dropdown-toggle")?.classList.remove("open");
    cont.querySelectorAll(":scope > div").forEach(grp => { grp.style.display = ""; });
  });
}

/**
 * Live-update rightbar labels when label mode is toggled (no rebuild).
 * Looks for elements created by makeSectorToggle and flips their <label> text.
 */
function refreshRightbarLabels() {
  const wantSector = (window.LABEL_MODE === "sector");
  document.querySelectorAll("#rightbar .position-id-toggle").forEach(div => {
    const lab = div.querySelector("label");
    if (!lab) return;
    const posText = div.dataset.posLabel || "";
    const secText = div.dataset.sectorLabel || posText;
    lab.textContent = wantSector ? secText : posText;
  });
}

export { buildSidebar, attachSidebarListeners };
