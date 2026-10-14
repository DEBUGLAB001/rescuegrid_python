/**
 * RescueGrid Operations Console Client Application
 * Clean light-theme SVG vector map, live state updates, and Jinja2 synchronization
 */

(function () {
  "use strict";

  let lastStateHash = null;
  let lastAssetVersion = null;
  let isRecomputing = false;

  // DOM Elements
  const el = {
    btnRecompute: document.getElementById("btn-recompute"),
    btnRefresh: document.getElementById("btn-refresh"),
    lastUpdated: document.getElementById("last-updated-time"),
    connectionStatus: document.getElementById("connection-status"),
    connectionText: document.getElementById("connection-text"),
    svgMapWrapper: document.getElementById("svg-map-wrapper"),
    tabActive: document.getElementById("tab-active"),
    tabCompleted: document.getElementById("tab-completed"),
    tabAll: document.getElementById("tab-all"),
    incidentCards: document.querySelectorAll(".incident-row-card")
  };

  // ==========================================================================
  // VECTOR MAP RENDERER (Clean, readable light theme map)
  // ==========================================================================

  function renderMap(data) {
    if (!el.svgMapWrapper || !data) return;

    const nodeCoords = data.node_coordinates || {};
    const roadSegments = data.road_segments || [];
    const incidents = (data.incidents || []).filter(i => i.status === "active");
    const units = data.units || [];
    const hospitals = data.hospitals || [];
    const route = data.routing || {};
    const routeSegmentIds = new Set(route.segment_ids || []);

    let svg = `
      <svg class="map-svg" viewBox="50 40 500 370" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
          </pattern>
        </defs>

        <!-- Base grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- River waterway -->
        <path d="M 50 210 Q 220 180 320 280 T 550 300" fill="none" stroke="#e0f2fe" stroke-width="28" stroke-linecap="round"/>
        <path d="M 50 210 Q 220 180 320 280 T 550 300" fill="none" stroke="#bae6fd" stroke-width="14" stroke-linecap="round"/>
    `;

    // Road segments
    roadSegments.forEach(seg => {
      const from = nodeCoords[seg.from_node];
      const to = nodeCoords[seg.to_node];
      if (!from || !to) return;

      const isRoute = routeSegmentIds.has(seg.id);
      const isClosed = seg.is_closed;

      let stroke = "#94a3b8";
      let width = 3;
      let dash = "none";

      if (isClosed) {
        stroke = "#dc2626";
        width = 4;
        dash = "6,4";
      } else if (isRoute) {
        stroke = "#0284c7";
        width = 4.5;
      }

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;

      svg += `
        <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" 
              stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" />
        
        <rect x="${midX - 18}" y="${midY - 8}" width="36" height="16" rx="3" 
              fill="#ffffff" stroke="${isClosed ? '#f87171' : '#cbd5e1'}" stroke-width="1.2" />
        <text x="${midX}" y="${midY + 3.5}" fill="${isClosed ? '#b91c1c' : '#334155'}" 
              font-size="9" font-family="monospace" text-anchor="middle" font-weight="700">
          ${seg.distance}km
        </text>
      `;

      if (isClosed) {
        svg += `
          <circle cx="${midX}" cy="${midY - 14}" r="7" fill="#dc2626"/>
          <text x="${midX}" y="${midY - 10}" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">!</text>
        `;
      }
    });

    // Intersections / Districts
    Object.entries(nodeCoords).forEach(([name, pos]) => {
      svg += `
        <circle cx="${pos.x}" cy="${pos.y}" r="6" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
        <text x="${pos.x}" y="${pos.y - 12}" fill="#0f172a" font-size="10.5" font-family="sans-serif" font-weight="700" text-anchor="middle">
          ${name}
        </text>
      `;
    });

    // Hospitals
    hospitals.forEach(h => {
      const pos = h.coordinates;
      if (!pos) return;
      svg += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.8"/>
          <path d="M 0 -6 L 0 6 M -6 0 L 6 0" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round"/>
          <text x="14" y="3.5" fill="#0369a1" font-size="9.5" font-family="monospace" font-weight="700">
            ${h.id} (${h.available_beds} beds)
          </text>
        </g>
      `;
    });

    // Units
    units.forEach(u => {
      const pos = u.coordinates;
      if (!pos) return;
      const isAssigned = u.status === "assigned";
      svg += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="9" fill="${isAssigned ? '#ecfdf5' : '#eff6ff'}" stroke="${isAssigned ? '#059669' : '#2563eb'}" stroke-width="2"/>
          <text x="0" y="3.5" fill="${isAssigned ? '#065f46' : '#1e40af'}" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="middle">
            ${u.id.replace('U-0', 'U')}
          </text>
        </g>
      `;
    });

    // Incidents
    incidents.forEach(inc => {
      const pos = inc.coordinates;
      if (!pos) return;
      const isCritical = inc.base_severity >= 4;
      svg += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="14" fill="none" stroke="${isCritical ? '#dc2626' : '#d97706'}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.85"/>
          <circle cx="0" cy="0" r="9" fill="${isCritical ? '#fee2e2' : '#fef3c7'}" stroke="${isCritical ? '#dc2626' : '#d97706'}" stroke-width="2"/>
          <text x="0" y="3.5" fill="${isCritical ? '#991b1b' : '#92400e'}" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="middle">
            ${inc.base_severity}
          </text>
          <text x="0" y="24" fill="${isCritical ? '#b91c1c' : '#b45309'}" font-size="9.5" font-family="monospace" font-weight="800" text-anchor="middle">
            ${inc.id}
          </text>
        </g>
      `;
    });

    svg += `</svg>`;
    el.svgMapWrapper.innerHTML = svg;
  }

  // ==========================================================================
  // API SYNC & AUTO-UPDATE
  // ==========================================================================

  async function checkLiveUpdate() {
    try {
      const res = await fetch("api/state", { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error("Connection failed");
      const data = await res.json();

      if (el.connectionStatus) {
        el.connectionStatus.classList.remove("reconnecting");
        el.connectionText.textContent = "LIVE STREAM";
      }

      // Check if state changed (new scores, new assignments, new route)
      const stateHash = JSON.stringify({
        incidents: data.incidents.map(i => [i.id, i.priority_score, i.assigned_unit_id, i.destination_hospital_id]),
        routing: [data.routing.total_cost, data.routing.path],
        coverage: [data.standby_coverage.total_priority, data.standby_coverage.selected_unit_ids]
      });

      if (lastStateHash === null) {
        lastStateHash = stateHash;
        renderMap(data);
      } else if (lastStateHash !== stateHash) {
        // Backend logic changed! Reload page to re-render fresh Jinja2 template
        lastStateHash = stateHash;
        window.location.reload();
      }
    } catch (err) {
      if (el.connectionStatus) {
        el.connectionStatus.classList.add("reconnecting");
        el.connectionText.textContent = "RECONNECTING...";
      }
    }
  }

  async function checkVersion() {
    try {
      const res = await fetch("api/version", { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) return;
      const data = await res.json();
      const currentVer = data.asset_version;

      if (!lastAssetVersion) {
        lastAssetVersion = currentVer;
        return;
      }

      if (currentVer && currentVer !== lastAssetVersion) {
        lastAssetVersion = currentVer;
        window.location.reload();
      }
    } catch (e) {}
  }

  async function triggerRecompute() {
    if (isRecomputing) return;
    isRecomputing = true;
    if (el.btnRecompute) {
      el.btnRecompute.disabled = true;
      el.btnRecompute.textContent = "Computing...";
    }

    try {
      const res = await fetch("api/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      isRecomputing = false;
      if (el.btnRecompute) {
        el.btnRecompute.disabled = false;
        el.btnRecompute.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Recompute Dispatch
        `;
      }
    }
  }

  // Tab filter
  function initTabs() {
    const tabs = [el.tabActive, el.tabCompleted, el.tabAll].filter(Boolean);
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const mode = tab.getAttribute("data-tab");

        const cards = document.querySelectorAll(".incident-row-card");
        cards.forEach(card => {
          const isCompleted = card.classList.contains("is-completed");
          if (mode === "active") {
            card.style.display = isCompleted ? "none" : "flex";
          } else if (mode === "completed") {
            card.style.display = isCompleted ? "flex" : "none";
          } else {
            card.style.display = "flex";
          }
        });
      });
    });
  }

  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    if (el.btnRecompute) el.btnRecompute.addEventListener("click", triggerRecompute);
    if (el.btnRefresh) el.btnRefresh.addEventListener("click", () => window.location.reload());

    // Initial map render from initial state
    fetch("api/state")
      .then(r => r.json())
      .then(data => renderMap(data))
      .catch(() => {});

    // Live polling intervals
    setInterval(checkLiveUpdate, 1500);
    setInterval(checkVersion, 2000);
  });

})();
