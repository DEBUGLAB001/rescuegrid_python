/**
 * RescueGrid Operations Console Client Application
 * Modern Light-Theme Interactive SVG Vector Map, Live Telemetry Polling,
 * Instant Click Handlers, Incident Inspector Drawer, and Dynamic Filter Controls.
 */

(function () {
  "use strict";

  let currentState = null;
  let lastStateHash = null;
  let lastAssetVersion = null;
  let isRecomputing = false;
  let selectedIncidentId = null;

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
    searchInput: document.getElementById("incident-search-input"),
    searchClear: document.getElementById("search-clear-btn"),
    filterPills: document.querySelectorAll(".filter-pill"),
    incidentCards: document.querySelectorAll(".incident-row-card"),
    toastContainer: document.getElementById("toast-container"),

    // Inspector Modal
    inspectorModal: document.getElementById("inspector-modal"),
    inspectorBackdrop: document.getElementById("inspector-backdrop"),
    inspCloseBtn: document.getElementById("insp-close-btn"),
    inspId: document.getElementById("insp-id"),
    inspTitle: document.getElementById("insp-title"),
    inspSubtitle: document.getElementById("insp-subtitle"),
    inspBaseSev: document.getElementById("insp-base-sev"),
    inspRisk: document.getElementById("insp-risk"),
    inspAge: document.getElementById("insp-age"),
    inspEscalation: document.getElementById("insp-escalation"),
    inspTotalPriority: document.getElementById("insp-total-priority"),
    inspDispatchCard: document.getElementById("insp-dispatch-card"),
    inspDispatchStatus: document.getElementById("insp-dispatch-status"),
    inspUnitName: document.getElementById("insp-unit-name"),
    inspDispatchDetails: document.getElementById("insp-dispatch-details"),
    inspRequiredSkills: document.getElementById("insp-required-skills"),
    inspHospitalCard: document.getElementById("insp-hospital-card"),
    inspHospStatus: document.getElementById("insp-hosp-status"),
    inspHospName: document.getElementById("insp-hosp-name"),
    inspHospDetails: document.getElementById("insp-hosp-details"),
    inspRouteCard: document.getElementById("insp-route-card"),
    inspRouteStatus: document.getElementById("insp-route-status"),
    inspRouteDistance: document.getElementById("insp-route-distance"),
    inspRouteSteps: document.getElementById("insp-route-steps"),
    inspBtnAck: document.getElementById("insp-btn-ack"),
    inspBtnLocate: document.getElementById("insp-btn-locate"),
    inspBtnSiren: document.getElementById("insp-btn-siren")
  };

  // ==========================================================================
  // TOAST NOTIFICATIONS (Crisp, modern floating alerts)
  // ==========================================================================

  function showToast(title, message, type = "info") {
    if (!el.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    
    let iconSvg = "";
    if (type === "success") {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === "warning") {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2563eb" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon-wrapper">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
      <button class="toast-close" title="Dismiss">&times;</button>
    `;

    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        toast.classList.add("toast-fadeout");
        setTimeout(() => toast.remove(), 250);
      });
    }

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add("toast-fadeout");
        setTimeout(() => toast.remove(), 250);
      }
    }, 4500);
  }

  // ==========================================================================
  // VECTOR MAP RENDERER (920 x 440 Spacious Layout, Interactive Elements)
  // ==========================================================================

  function renderMap(data) {
    if (!el.svgMapWrapper || !data) return;
    currentState = data;

    const nodeCoords = data.node_coordinates || {
      "West End": { x: 160, y: 210 },
      "North District": { x: 460, y: 80 },
      "Central Plaza": { x: 460, y: 250 },
      "Eastside Industrial": { x: 780, y: 140 },
      "Harbor Medical": { x: 680, y: 370 }
    };
    
    const roadSegments = data.road_segments || [];
    const incidents = data.incidents || [];
    const activeIncidents = incidents.filter(i => i.status === "active");
    const units = data.units || [];
    const hospitals = data.hospitals || [];
    const route = data.routing || {};
    const routeSegmentIds = new Set(route.segment_ids || []);

    let svg = `
      <svg class="map-svg" viewBox="0 0 920 440" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
          </pattern>
          <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.12"/>
          </filter>
          <filter id="glow-selected" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#2563eb" flood-opacity="0.5"/>
          </filter>
        </defs>

        <!-- Base Background Grid -->
        <rect width="920" height="440" fill="#f8fafc" />
        <rect width="920" height="440" fill="url(#grid-pattern)" />

        <!-- Waterway River Corridor -->
        <path d="M 0 250 C 220 190, 360 280, 560 290 S 800 230, 920 240" fill="none" stroke="#e0f2fe" stroke-width="44" stroke-linecap="round"/>
        <path d="M 0 250 C 220 190, 360 280, 560 290 S 800 230, 920 240" fill="none" stroke="#bae6fd" stroke-width="22" stroke-linecap="round"/>
        <text x="35" y="240" fill="#0284c7" font-size="10" font-family="monospace" font-weight="700" letter-spacing="1">AETHELGARD CANAL</text>
    `;

    // 1. Road Segments
    roadSegments.forEach(seg => {
      const from = nodeCoords[seg.from_node];
      const to = nodeCoords[seg.to_node];
      if (!from || !to) return;

      const isRoute = routeSegmentIds.has(seg.id);
      const isClosed = seg.is_closed;

      let stroke = "#94a3b8";
      let width = 3.5;
      let dash = "none";

      if (isClosed) {
        stroke = "#dc2626";
        width = 4.5;
        dash = "8,5";
      } else if (isRoute) {
        stroke = "#0284c7";
        width = 5.5;
      }

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;

      svg += `
        <!-- Road Segment ${seg.id} -->
        <g class="map-road-group" data-road-id="${seg.id}" title="${seg.from_node} to ${seg.to_node} (${seg.distance}km)">
          <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" 
                stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" stroke-linecap="round"/>
          
          <!-- Distance Badge -->
          <g transform="translate(${midX}, ${midY})">
            <rect x="-22" y="-10" width="44" height="20" rx="4" 
                  fill="#ffffff" stroke="${isClosed ? '#f87171' : isRoute ? '#0284c7' : '#cbd5e1'}" 
                  stroke-width="${isRoute ? '2' : '1.2'}" filter="url(#soft-shadow)" />
            <text x="0" y="4" fill="${isClosed ? '#b91c1c' : isRoute ? '#0369a1' : '#334155'}" 
                  font-size="10" font-family="monospace" text-anchor="middle" font-weight="700">
              ${seg.distance}km
            </text>
          </g>
      `;

      if (isClosed) {
        svg += `
          <!-- Road Closure Warning Tag -->
          <g transform="translate(${midX}, ${midY - 18})">
            <rect x="-30" y="-8" width="60" height="16" rx="3" fill="#dc2626" />
            <text x="0" y="3.5" fill="#ffffff" font-size="8.5" font-family="sans-serif" font-weight="800" text-anchor="middle">
              CLOSED
            </text>
          </g>
        `;
      }

      svg += `</g>`;
    });

    // 2. Active Guidance / Leader Lines for Selected Incident
    if (selectedIncidentId) {
      const selectedInc = incidents.find(i => i.id === selectedIncidentId);
      if (selectedInc && selectedInc.coordinates) {
        const incPos = selectedInc.coordinates;

        // Leader line to Assigned Unit
        if (selectedInc.assigned_unit_id) {
          const assignedUnit = units.find(u => u.id === selectedInc.assigned_unit_id);
          if (assignedUnit && assignedUnit.coordinates) {
            svg += `
              <line x1="${incPos.x}" y1="${incPos.y}" x2="${assignedUnit.coordinates.x}" y2="${assignedUnit.coordinates.y}" 
                    stroke="#059669" stroke-width="2" stroke-dasharray="5,4" opacity="0.8" />
            `;
          }
        }

        // Leader line to Destination Hospital
        if (selectedInc.destination_hospital_id) {
          const destHosp = hospitals.find(h => h.id === selectedInc.destination_hospital_id);
          if (destHosp && destHosp.coordinates) {
            svg += `
              <line x1="${incPos.x}" y1="${incPos.y}" x2="${destHosp.coordinates.x}" y2="${destHosp.coordinates.y}" 
                    stroke="#0284c7" stroke-width="2" stroke-dasharray="5,4" opacity="0.8" />
            `;
          }
        }
      }
    }

    // 3. District Intersection Nodes
    Object.entries(nodeCoords).forEach(([name, pos]) => {
      let labelOffset = -18;
      if (name === "Central Plaza") labelOffset = -16;
      if (name === "Harbor Medical") labelOffset = 24;

      svg += `
        <g class="map-district-node" data-district="${name}" transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="8" fill="#ffffff" stroke="#1d4ed8" stroke-width="3" filter="url(#soft-shadow)"/>
          <circle cx="0" cy="0" r="3" fill="#1d4ed8"/>
          
          <rect x="-65" y="${labelOffset > 0 ? labelOffset - 5 : labelOffset - 14}" width="130" height="18" rx="4"
                fill="rgba(255,255,255,0.92)" stroke="#cbd5e1" stroke-width="1" />
          <text x="0" y="${labelOffset > 0 ? labelOffset + 8 : labelOffset - 1}" fill="#0f172a" 
                font-size="11" font-family="sans-serif" font-weight="800" text-anchor="middle">
            ${name}
          </text>
        </g>
      `;
    });

    // 4. Hospitals
    hospitals.forEach(h => {
      const pos = h.coordinates;
      if (!pos) return;

      svg += `
        <g class="map-interactive-marker map-hosp-marker" data-hosp-id="${h.id}" transform="translate(${pos.x}, ${pos.y})"
           title="Click to view hospital ${h.name} (${h.available_beds}/${h.total_beds} beds)">
          <rect x="-14" y="-14" width="28" height="28" rx="6" fill="#f0f9ff" stroke="#0284c7" stroke-width="2" filter="url(#soft-shadow)"/>
          <path d="M 0 -8 L 0 8 M -8 0 L 8 0" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
          
          <!-- Hospital Bed Availability Pill -->
          <g transform="translate(18, 0)">
            <rect x="0" y="-10" width="88" height="20" rx="4" fill="#ffffff" stroke="#7dd3fc" stroke-width="1.2" filter="url(#soft-shadow)"/>
            <text x="6" y="4" fill="#0369a1" font-size="10" font-family="monospace" font-weight="700">
              ${h.id}: ${h.available_beds} beds
            </text>
          </g>
        </g>
      `;
    });

    // 5. Units
    units.forEach(u => {
      const pos = u.coordinates;
      if (!pos) return;
      const isAssigned = u.status === "assigned";
      const strokeColor = isAssigned ? "#059669" : "#2563eb";
      const fillColor = isAssigned ? "#ecfdf5" : "#eff6ff";
      const textColor = isAssigned ? "#065f46" : "#1e40af";

      svg += `
        <g class="map-interactive-marker map-unit-marker" data-unit-id="${u.id}" transform="translate(${pos.x}, ${pos.y})"
           title="Unit ${u.id}: ${u.name} (${u.status.toUpperCase()})">
          <circle cx="0" cy="0" r="14" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5" filter="url(#soft-shadow)"/>
          <text x="0" y="4" fill="${textColor}" font-size="10" font-family="monospace" font-weight="800" text-anchor="middle">
            ${u.id.replace('U-0', 'U')}
          </text>
          <g transform="translate(0, 22)">
            <rect x="-24" y="-7" width="48" height="15" rx="3" fill="#ffffff" stroke="${strokeColor}" stroke-width="1"/>
            <text x="0" y="4" fill="${textColor}" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="middle">
              ${isAssigned ? 'ACTIVE' : 'READY'}
            </text>
          </g>
        </g>
      `;
    });

    // 6. Active Incidents
    activeIncidents.forEach(inc => {
      const pos = inc.coordinates;
      if (!pos) return;
      const isCritical = inc.base_severity >= 4;
      const isSelected = inc.id === selectedIncidentId;
      const primaryColor = isCritical ? "#dc2626" : "#d97706";
      const bgColor = isCritical ? "#fee2e2" : "#fef3c7";
      const textColor = isCritical ? "#991b1b" : "#92400e";

      svg += `
        <g class="map-interactive-marker map-inc-marker ${isSelected ? 'is-map-selected' : ''}" 
           data-incident-id="${inc.id}" 
           transform="translate(${pos.x}, ${pos.y})"
           title="Click to inspect ${inc.id} (${inc.title})">
      `;

      if (isSelected) {
        svg += `
          <!-- Pulsing Target Locator Rings -->
          <circle cx="0" cy="0" r="26" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,4" class="pulse-ring"/>
          <circle cx="0" cy="0" r="32" fill="none" stroke="#2563eb" stroke-width="1.2" opacity="0.6"/>
          <line x1="-36" y1="0" x2="-26" y2="0" stroke="#2563eb" stroke-width="2"/>
          <line x1="26" y1="0" x2="36" y2="0" stroke="#2563eb" stroke-width="2"/>
          <line x1="0" y1="-36" x2="0" y2="-26" stroke="#2563eb" stroke-width="2"/>
          <line x1="0" y1="26" x2="0" y2="36" stroke="#2563eb" stroke-width="2"/>
        `;
      }

      svg += `
          <!-- Incident Radar Beacon -->
          <circle cx="0" cy="0" r="18" fill="none" stroke="${primaryColor}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.8"/>
          <circle cx="0" cy="0" r="13" fill="${bgColor}" stroke="${primaryColor}" stroke-width="2.5" filter="url(#soft-shadow)"/>
          
          <text x="0" y="4.5" fill="${textColor}" font-size="11" font-family="monospace" font-weight="900" text-anchor="middle">
            ${inc.base_severity}
          </text>
          
          <!-- Incident ID Pill -->
          <g transform="translate(0, 24)">
            <rect x="-30" y="-8" width="60" height="17" rx="3" 
                  fill="${isSelected ? '#2563eb' : '#ffffff'}" 
                  stroke="${isSelected ? '#1d4ed8' : primaryColor}" stroke-width="1.5" filter="url(#soft-shadow)"/>
            <text x="0" y="4" fill="${isSelected ? '#ffffff' : textColor}" font-size="9" font-family="monospace" font-weight="800" text-anchor="middle">
              ${inc.id}
            </text>
          </g>
        </g>
      `;
    });

    svg += `</svg>`;
    el.svgMapWrapper.innerHTML = svg;

    // Attach Click Handlers to Vector Map Markers
    attachMapMarkerListeners();
  }

  function attachMapMarkerListeners() {
    // Incident Pins
    const incPins = el.svgMapWrapper.querySelectorAll(".map-inc-marker");
    incPins.forEach(pin => {
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        const incId = pin.getAttribute("data-incident-id");
        if (incId) selectIncident(incId, true);
      });
    });

    // Unit Pins
    const unitPins = el.svgMapWrapper.querySelectorAll(".map-unit-marker");
    unitPins.forEach(pin => {
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        const unitId = pin.getAttribute("data-unit-id");
        if (!currentState || !currentState.units) return;
        const u = currentState.units.find(x => x.id === unitId);
        if (u) {
          showToast(`Unit ${u.id}: ${u.name}`, `Status: ${u.status.toUpperCase()} &bull; Location: ${u.location}<br>Skills: ${u.skills.join(', ')}`, "info");
        }
      });
    });

    // Hospital Pins
    const hospPins = el.svgMapWrapper.querySelectorAll(".map-hosp-marker");
    hospPins.forEach(pin => {
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        const hospId = pin.getAttribute("data-hosp-id");
        if (!currentState || !currentState.hospitals) return;
        const h = currentState.hospitals.find(x => x.id === hospId);
        if (h) {
          showToast(`Hospital ${h.id}: ${h.name}`, `Available Beds: ${h.available_beds}/${h.total_beds}<br>Specialties: ${h.services.join(', ')}`, "info");
        }
      });
    });

    // District Nodes
    const distNodes = el.svgMapWrapper.querySelectorAll(".map-district-node");
    distNodes.forEach(node => {
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        const district = node.getAttribute("data-district");
        showToast(`District Intersection: ${district}`, `Metropolitan road corridor node with continuous traffic telemetry.`, "info");
      });
    });
  }

  // ==========================================================================
  // INCIDENT INSPECTOR & SELECTION (Instant Click Response)
  // ==========================================================================

  function selectIncident(incId, openModal = true) {
    selectedIncidentId = incId;

    // Highlight card in queue
    const cards = document.querySelectorAll(".incident-row-card");
    cards.forEach(card => {
      if (card.getAttribute("data-incident-id") === incId) {
        card.classList.add("is-selected");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        card.classList.remove("is-selected");
      }
    });

    // Re-render map to draw guidance lines and radar target
    if (currentState) {
      renderMap(currentState);
    }

    if (openModal) {
      populateAndOpenInspector(incId);
    }
  }

  function populateAndOpenInspector(incId) {
    if (!currentState || !currentState.incidents) return;
    const inc = currentState.incidents.find(i => i.id === incId);
    if (!inc) return;

    // Basic Header
    el.inspId.textContent = inc.id;
    el.inspTitle.textContent = inc.title;
    el.inspSubtitle.textContent = `${inc.location} &bull; Severity ${inc.base_severity}/5 &bull; ${inc.status.toUpperCase()}`;

    // Math Formula Breakdown
    const baseVal = inc.base_severity * 25;
    const riskVal = inc.people_at_risk * 10;
    const ageVal = Math.round(inc.age_minutes * 1.5 * 10) / 10;
    const escVal = inc.escalation_indicator ? "+30" : "0";

    el.inspBaseSev.textContent = `${inc.base_severity} × 25 = ${baseVal}`;
    el.inspRisk.textContent = `${inc.people_at_risk} × 10 = ${riskVal}`;
    el.inspAge.textContent = `${inc.age_minutes}m × 1.5 = ${ageVal}`;
    el.inspEscalation.textContent = escVal;
    el.inspTotalPriority.textContent = inc.priority_score !== null ? `${inc.priority_score} Points` : "Computing...";

    // Unit Dispatch Status
    if (inc.assigned_unit_id) {
      el.inspDispatchStatus.textContent = "ASSIGNED";
      el.inspDispatchStatus.className = "badge badge-ok";
      el.inspUnitName.textContent = `Unit ${inc.assigned_unit_id}`;
      el.inspDispatchDetails.textContent = `Response unit allocated with required tactical skills.`;
    } else {
      el.inspDispatchStatus.textContent = "UNASSIGNED";
      el.inspDispatchStatus.className = "badge badge-err";
      el.inspUnitName.textContent = "Critical Capability Deficit";
      el.inspDispatchDetails.textContent = "No single unit currently possesses both required skills and equipment for this incident.";
    }

    // Required Skills Chips
    let skillsHtml = "";
    (inc.required_skills || []).forEach(s => {
      skillsHtml += `<span class="chip chip-skill">${s}</span>`;
    });
    (inc.required_equipment || []).forEach(e => {
      skillsHtml += `<span class="chip chip-equip">${e}</span>`;
    });
    el.inspRequiredSkills.innerHTML = skillsHtml;

    // Hospital Status
    if (inc.destination_hospital_id) {
      el.inspHospStatus.textContent = "SUITABLE";
      el.inspHospStatus.className = "badge badge-ok";
      el.inspHospName.textContent = `Facility ${inc.destination_hospital_id}`;
      el.inspHospDetails.textContent = `Hospital has verified available beds and required medical specialty departments for ${inc.patient_count} casualty patients.`;
    } else {
      el.inspHospStatus.textContent = "TRIAGE PENDING";
      el.inspHospStatus.className = "badge badge-warn";
      el.inspHospName.textContent = "Medical Center Unassigned";
      el.inspHospDetails.textContent = `Casualty load (${inc.patient_count} patients) requires trauma center triage.`;
    }

    // Road Corridor Routing
    if (currentState.routing) {
      el.inspRouteStatus.textContent = currentState.routing.is_valid ? "SAFE CORRIDOR" : "HAZARD BLOCKED";
      el.inspRouteStatus.className = `badge ${currentState.routing.is_valid ? 'badge-ok' : 'badge-err'}`;
      el.inspRouteDistance.textContent = `Distance: ${currentState.routing.total_cost} km`;
      el.inspRouteSteps.textContent = `Primary path: ${currentState.routing.path ? currentState.routing.path.join(' → ') : 'N/A'}`;
    }

    // Show modal
    el.inspectorModal.classList.remove("hidden");
  }

  function closeInspector() {
    if (el.inspectorModal) {
      el.inspectorModal.classList.add("hidden");
    }
  }

  // ==========================================================================
  // SEARCH & FILTER CONTROLS (Live Queue Updates)
  // ==========================================================================

  function applyQueueFilters() {
    const activeTab = document.querySelector(".tab-item.active");
    const activeFilterPill = document.querySelector(".filter-pill.active");
    const searchTerm = (el.searchInput ? el.searchInput.value : "").trim().toLowerCase();

    const tabMode = activeTab ? activeTab.getAttribute("data-tab") : "active";
    const pillMode = activeFilterPill ? activeFilterPill.getAttribute("data-filter") : "all";

    const cards = document.querySelectorAll(".incident-row-card");
    let matchCount = 0;

    cards.forEach(card => {
      const status = card.getAttribute("data-status");
      const severity = parseInt(card.getAttribute("data-severity") || "1", 10);
      const isEscalated = card.getAttribute("data-escalated") === "true";
      const isAssigned = card.getAttribute("data-assigned") === "true";
      const text = card.textContent.toLowerCase();

      let visible = true;

      // 1. Tab filter
      if (tabMode === "active" && status !== "active") visible = false;
      if (tabMode === "completed" && status !== "completed") visible = false;

      // 2. Pill filter
      if (pillMode === "critical" && severity < 4) visible = false;
      if (pillMode === "escalated" && !isEscalated) visible = false;
      if (pillMode === "unassigned" && isAssigned) visible = false;

      // 3. Search query
      if (searchTerm && !text.includes(searchTerm)) visible = false;

      card.style.display = visible ? "flex" : "none";
      if (visible) matchCount++;
    });

    const badge = document.getElementById("incident-count-badge");
    if (badge) badge.textContent = matchCount;
  }

  function initQueueInteractions() {
    // Incident Card Click
    const cards = document.querySelectorAll(".incident-row-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-incident-id");
        if (id) selectIncident(id, true);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const id = card.getAttribute("data-incident-id");
          if (id) selectIncident(id, true);
        }
      });
    });

    // Tab Filters
    const tabs = [el.tabActive, el.tabCompleted, el.tabAll].filter(Boolean);
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        applyQueueFilters();
      });
    });

    // Quick Filter Pills
    el.filterPills.forEach(pill => {
      pill.addEventListener("click", () => {
        el.filterPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        applyQueueFilters();
      });
    });

    // Search Input
    if (el.searchInput) {
      el.searchInput.addEventListener("input", applyQueueFilters);
    }
    if (el.searchClear) {
      el.searchClear.addEventListener("click", () => {
        if (el.searchInput) {
          el.searchInput.value = "";
          applyQueueFilters();
        }
      });
    }

    // Modal Close
    if (el.inspCloseBtn) el.inspCloseBtn.addEventListener("click", closeInspector);
    if (el.inspectorBackdrop) el.inspectorBackdrop.addEventListener("click", closeInspector);

    // Inspector Action Buttons
    if (el.inspBtnAck) {
      el.inspBtnAck.addEventListener("click", () => {
        el.inspBtnAck.textContent = "Acknowledged ✓";
        el.inspBtnAck.classList.add("btn-acknowledged");
        showToast("Incident Acknowledged", `Telemetry for ${selectedIncidentId} confirmed by Operations Command.`, "success");
      });
    }

    if (el.inspBtnLocate) {
      el.inspBtnLocate.addEventListener("click", () => {
        closeInspector();
        if (selectedIncidentId) {
          selectIncident(selectedIncidentId, false);
          if (el.svgMapWrapper) {
            el.svgMapWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      });
    }

    if (el.inspBtnSiren) {
      el.inspBtnSiren.addEventListener("click", () => {
        showToast("Tactical Siren Broadcast", `Alert tone dispatched to field response units in sector.`, "warning");
      });
    }
  }

  // ==========================================================================
  // API SYNC & RECOMPUTE
  // ==========================================================================

  async function checkLiveUpdate() {
    try {
      const res = await fetch("api/state", { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error("Connection failed");
      const data = await res.json();
      currentState = data;

      if (el.connectionStatus) {
        el.connectionStatus.classList.remove("reconnecting");
        el.connectionText.textContent = "LIVE STREAM";
      }

      // Check if state changed
      const stateHash = JSON.stringify({
        incidents: data.incidents.map(i => [i.id, i.priority_score, i.assigned_unit_id, i.destination_hospital_id]),
        routing: [data.routing.total_cost, data.routing.path],
        coverage: [data.standby_coverage.total_priority, data.standby_coverage.selected_unit_ids]
      });

      if (lastStateHash === null) {
        lastStateHash = stateHash;
        renderMap(data);
      } else if (lastStateHash !== stateHash) {
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
      el.btnRecompute.innerHTML = `
        <svg class="icon spin" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
        Optimizing Dispatch...
      `;
    }

    showToast("Recomputing Dispatch", "Executing Dijkstra shortest paths, bipartite unit matching, and knapsack standby optimization...", "info");

    try {
      const res = await fetch("api/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        showToast("Optimization Complete", "Municipal emergency dispatch telemetry recalculated successfully.", "success");
        setTimeout(() => window.location.reload(), 300);
      }
    } catch (e) {
      showToast("Recompute Error", "Failed to communicate with municipal server.", "warning");
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

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  document.addEventListener("DOMContentLoaded", () => {
    initQueueInteractions();

    if (el.btnRecompute) {
      el.btnRecompute.addEventListener("click", triggerRecompute);
    }

    if (el.btnRefresh) {
      el.btnRefresh.addEventListener("click", () => {
        showToast("Synchronizing", "Refreshing operations telemetry from municipal core...", "info");
        setTimeout(() => window.location.reload(), 200);
      });
    }

    // Initial state fetch & render
    fetch("api/state")
      .then(r => r.json())
      .then(data => {
        currentState = data;
        renderMap(data);
      })
      .catch(() => {});

    // Live polling intervals
    setInterval(checkLiveUpdate, 1500);
    setInterval(checkVersion, 2000);
  });

})();
