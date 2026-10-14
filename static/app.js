/**
 * RescueGrid Operations Console Client Application
 * Live state polling, dynamic SVG map telemetry, asset version reload
 */

(function () {
  "use strict";

  // Application state store
  const state = {
    currentTab: "active",
    data: null,
    initialAssetVersion: null,
    isRecomputing: false,
    pollTimer: null,
    versionTimer: null,
    isOffline: false
  };

  // DOM Elements cache
  const elements = {
    operatingStatusBadge: document.getElementById("operating-status-badge"),
    operatingStatusText: document.getElementById("operating-status-text"),
    connectionStatus: document.getElementById("connection-status"),
    connectionText: document.getElementById("connection-text"),
    lastUpdatedTime: document.getElementById("last-updated-time"),
    cityJurisdiction: document.getElementById("city-jurisdiction"),
    btnRecompute: document.getElementById("btn-recompute"),
    btnRefresh: document.getElementById("btn-refresh"),
    
    // Metrics
    metricActiveIncidents: document.getElementById("metric-active-incidents"),
    metricActiveSub: document.getElementById("metric-active-sub"),
    metricUnitsAssigned: document.getElementById("metric-units-assigned"),
    metricUnitsSub: document.getElementById("metric-units-sub"),
    metricUnassigned: document.getElementById("metric-unassigned"),
    metricUnassignedSub: document.getElementById("metric-unassigned-sub"),
    metricClosedRoads: document.getElementById("metric-closed-roads"),
    metricStandbyPrio: document.getElementById("metric-standby-prio"),
    metricStandbySub: document.getElementById("metric-standby-sub"),

    // Panels
    incidentQueueContainer: document.getElementById("incident-queue-container"),
    incidentCountBadge: document.getElementById("incident-count-badge"),
    svgMapWrapper: document.getElementById("svg-map-wrapper"),
    routeCorridorName: document.getElementById("route-corridor-name"),
    routeCostBadge: document.getElementById("route-cost-badge"),
    routeSegmentsList: document.getElementById("route-segments-list"),
    routeClosureAlert: document.getElementById("route-closure-alert"),
    dispatchStatBadge: document.getElementById("dispatch-stat-badge"),
    dispatchAssignmentsList: document.getElementById("dispatch-assignments-list"),
    hospitalSuitabilityList: document.getElementById("hospital-suitability-list"),
    standbyCoverageContainer: document.getElementById("standby-coverage-container"),
    coverageStatusBadge: document.getElementById("coverage-status-badge"),
    assetHashDisplay: document.getElementById("asset-hash-display"),

    // Tabs
    tabActive: document.getElementById("tab-active"),
    tabCompleted: document.getElementById("tab-completed"),
    tabAll: document.getElementById("tab-all")
  };

  // ==========================================================================
  // API INTERACTIONS (Using strictly relative URLs)
  // ==========================================================================

  async function fetchState() {
    try {
      const response = await fetch("api/state", {
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      handleFetchSuccess(data);
    } catch (err) {
      handleFetchError(err);
    }
  }

  async function triggerRecompute() {
    if (state.isRecomputing) return;
    state.isRecomputing = true;
    elements.btnRecompute.disabled = true;
    elements.btnRecompute.textContent = "Computing...";

    try {
      const response = await fetch("api/recompute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      handleFetchSuccess(data);
    } catch (err) {
      console.error("Recompute error:", err);
    } finally {
      state.isRecomputing = false;
      elements.btnRecompute.disabled = false;
      elements.btnRecompute.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
        Recompute Dispatch
      `;
    }
  }

  async function checkAssetVersion() {
    try {
      const response = await fetch("api/version", {
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) return;
      const data = await response.json();
      const currentVersion = data.asset_version;

      if (!state.initialAssetVersion) {
        state.initialAssetVersion = currentVersion;
        if (elements.assetHashDisplay) {
          elements.assetHashDisplay.textContent = `BUILD: ${currentVersion.substring(0, 8)}`;
        }
        return;
      }

      if (currentVersion && currentVersion !== state.initialAssetVersion) {
        console.log("Frontend assets modified. Reloading preview...");
        // Prevent infinite reload loops with session guard
        const lastReload = sessionStorage.getItem("rescuegrid_last_reload_time");
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 3000) {
          sessionStorage.setItem("rescuegrid_last_reload_time", now.toString());
          window.location.reload();
        }
      }
    } catch (e) {
      // Ignore network hiccups during asset version check
    }
  }

  function handleFetchSuccess(data) {
    state.data = data;
    if (state.isOffline) {
      state.isOffline = false;
      elements.connectionStatus.classList.remove("reconnecting");
      elements.connectionText.textContent = "LIVE FEED";
    }

    renderDashboard(data);
  }

  function handleFetchError(err) {
    state.isOffline = true;
    elements.connectionStatus.classList.add("reconnecting");
    elements.connectionText.textContent = "RECONNECTING...";
    console.warn("Connection pending backend reload:", err.message);
  }

  // ==========================================================================
  // DASHBOARD RENDERING
  // ==========================================================================

  function renderDashboard(data) {
    if (!data) return;

    // Header info
    if (data.city) {
      elements.cityJurisdiction.textContent = `${data.city.city_name} • ${data.city.jurisdiction}`;
      elements.operatingStatusText.textContent = data.city.operating_status || "ACTIVE MONITORING";
    }
    elements.lastUpdatedTime.textContent = data.last_updated ? data.last_updated.split(" ")[1] : "--:--:--";

    // Metrics
    const metrics = data.metrics || {};
    elements.metricActiveIncidents.textContent = metrics.active_incidents_count ?? 0;
    elements.metricUnitsAssigned.textContent = metrics.total_units_assigned ?? 0;
    elements.metricUnitsSub.textContent = `Available: ${metrics.total_units_available ?? 0}`;
    
    const unassignedCount = metrics.critical_unassigned_count ?? 0;
    elements.metricUnassigned.textContent = unassignedCount;
    elements.metricUnassigned.className = `metric-value ${unassignedCount > 0 ? "text-red" : "text-teal"}`;
    elements.metricUnassignedSub.textContent = unassignedCount > 0 ? "CRITICAL DEFICIT" : "ALL SERVED";

    elements.metricClosedRoads.textContent = metrics.closed_roads_count ?? 0;

    const coverage = data.standby_coverage || {};
    elements.metricStandbyPrio.textContent = `${coverage.total_priority ?? 0} pts`;
    elements.metricStandbySub.textContent = `Budget: ${coverage.budget_used ?? 0}/${coverage.budget_limit ?? 10} used`;

    // Render panels
    renderIncidentQueue(data.incidents || []);
    renderSvgMap(data);
    renderRouteDetails(data.routing || {});
    renderDispatchCoordination(data.dispatch || {}, data.eligibility_matrix || []);
    renderHospitalSuitability(data.hospital_suitability || {});
    renderStandbyCoverage(coverage);
  }

  // 1. INCIDENT QUEUE
  function renderIncidentQueue(incidents) {
    let filtered = incidents;
    if (state.currentTab === "active") {
      filtered = incidents.filter(i => i.status === "active");
    } else if (state.currentTab === "completed") {
      filtered = incidents.filter(i => i.status === "completed");
    }

    elements.incidentCountBadge.textContent = filtered.length;

    if (filtered.length === 0) {
      elements.incidentQueueContainer.innerHTML = `
        <div class="loading-state">
          <span>No incidents match current filter (${state.currentTab}).</span>
        </div>
      `;
      return;
    }

    elements.incidentQueueContainer.innerHTML = filtered.map(inc => {
      const isCritical = inc.base_severity >= 4;
      const isWarning = inc.base_severity === 3;
      const cardClass = inc.status === "completed" ? "completed" : (isCritical ? "critical" : (isWarning ? "warning" : "normal"));

      const skillsHtml = (inc.required_skills || []).map(s => `<span class="tag tag-skill">${s}</span>`).join("");
      const equipHtml = (inc.required_equipment || []).map(e => `<span class="tag tag-equip">${e}</span>`).join("");
      const escalatedHtml = inc.escalation_indicator ? `<span class="tag tag-escalated">ESCALATED</span>` : "";

      const assignedText = inc.assigned_unit_id
        ? `<span class="unit-assigned-label">Unit: ${inc.assigned_unit_id}</span>`
        : `<span class="unit-unassigned-label">UNASSIGNED</span>`;

      const hospText = inc.destination_hospital_id
        ? `<span class="badge">Hosp: ${inc.destination_hospital_id}</span>`
        : "";

      return `
        <div class="incident-card ${cardClass}" data-incident-id="${inc.id}">
          <div class="incident-header">
            <span class="incident-id-tag">${inc.id}</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${escalatedHtml}
              <span class="priority-score-badge ${inc.priority_score >= 200 ? 'high' : ''}">
                PRIO: ${inc.priority_score !== null && inc.priority_score !== undefined ? inc.priority_score : '--'}
              </span>
            </div>
          </div>
          <div class="incident-title">${inc.title}</div>
          <div class="incident-meta">
            <span>&bull; ${inc.location}</span>
            <span>&bull; Sev: ${inc.base_severity}/5</span>
            <span>&bull; Risk: ${inc.people_at_risk}</span>
            <span>&bull; Age: ${inc.age_minutes}m</span>
          </div>
          <div class="incident-tag-cloud">
            ${skillsHtml}
            ${equipHtml}
          </div>
          <div class="incident-assignment-footer">
            ${assignedText}
            ${hospText}
          </div>
        </div>
      `;
    }).join("");
  }

  // 2. CENTRAL SVG MAP VISUALIZATION (Light Theme Optimized)
  function renderSvgMap(data) {
    const nodeCoords = data.node_coordinates || {};
    const roadSegments = data.road_segments || [];
    const incidents = (data.incidents || []).filter(i => i.status === "active");
    const units = data.units || [];
    const hospitals = data.hospitals || [];
    const route = data.routing || {};
    const routeSegmentIds = new Set(route.segment_ids || []);

    let svgHtml = `
      <svg class="map-svg" viewBox="50 40 500 370" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Grid Pattern -->
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
          </pattern>
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Background grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- River feature -->
        <path d="M 50 210 Q 220 180 320 280 T 550 300" fill="none" stroke="#e0f2fe" stroke-width="26" stroke-linecap="round"/>
        <path d="M 50 210 Q 220 180 320 280 T 550 300" fill="none" stroke="#bae6fd" stroke-width="14" stroke-linecap="round"/>
    `;

    // Render Road Segments
    roadSegments.forEach(seg => {
      const from = nodeCoords[seg.from_node];
      const to = nodeCoords[seg.to_node];
      if (!from || !to) return;

      const isRouteSeg = routeSegmentIds.has(seg.id);
      const isClosed = seg.is_closed;

      let strokeColor = "#94a3b8";
      let strokeWidth = 3;
      let strokeDash = "none";
      let filterAttr = "";

      if (isClosed) {
        strokeColor = "#dc2626";
        strokeWidth = 3.5;
        strokeDash = "6,4";
      } else if (isRouteSeg) {
        strokeColor = "#0284c7";
        strokeWidth = 4.5;
        filterAttr = 'filter="url(#glow-cyan)"';
      }

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;

      svgHtml += `
        <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" 
              stroke="${strokeColor}" stroke-width="${strokeWidth}" 
              stroke-dasharray="${strokeDash}" ${filterAttr} />
        <rect x="${midX - 18}" y="${midY - 8}" width="36" height="16" rx="3" fill="#ffffff" stroke="${isClosed ? '#f87171' : '#cbd5e1'}" stroke-width="1.2" />
        <text x="${midX}" y="${midY + 3.5}" fill="${isClosed ? '#b91c1c' : '#334155'}" font-size="9" font-family="monospace" text-anchor="middle" font-weight="700">
          ${seg.distance}km
        </text>
      `;

      if (isClosed) {
        svgHtml += `
          <circle cx="${midX}" cy="${midY - 14}" r="7" fill="#dc2626"/>
          <text x="${midX}" y="${midY - 10}" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">!</text>
        `;
      }
    });

    // Render Intersections / Nodes
    Object.entries(nodeCoords).forEach(([name, pos]) => {
      svgHtml += `
        <circle cx="${pos.x}" cy="${pos.y}" r="6" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
        <text x="${pos.x}" y="${pos.y - 12}" fill="#0f172a" font-size="10.5" font-family="sans-serif" font-weight="700" text-anchor="middle">
          ${name}
        </text>
      `;
    });

    // Render Hospitals
    hospitals.forEach(h => {
      const pos = h.coordinates;
      if (!pos) return;
      svgHtml += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.8"/>
          <path d="M 0 -6 L 0 6 M -6 0 L 6 0" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round"/>
          <text x="14" y="3.5" fill="#0369a1" font-size="9.5" font-family="monospace" font-weight="700">
            ${h.id} (${h.available_beds} beds)
          </text>
        </g>
      `;
    });

    // Render Response Units
    units.forEach(u => {
      const pos = u.coordinates;
      if (!pos) return;
      const isAssigned = u.status === "assigned";
      svgHtml += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="9" fill="${isAssigned ? '#ecfdf5' : '#eff6ff'}" stroke="${isAssigned ? '#059669' : '#2563eb'}" stroke-width="2"/>
          <text x="0" y="3.5" fill="${isAssigned ? '#065f46' : '#1e40af'}" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="middle">
            ${u.id.replace('U-0', 'U')}
          </text>
        </g>
      `;
    });

    // Render Active Incidents
    incidents.forEach(inc => {
      const pos = inc.coordinates;
      if (!pos) return;
      const isCritical = inc.base_severity >= 4;
      svgHtml += `
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

    svgHtml += `</svg>`;
    elements.svgMapWrapper.innerHTML = svgHtml;
  }

  // 3. ROUTE DETAILS
  function renderRouteDetails(route) {
    if (!route || !route.path || route.path.length === 0) {
      elements.routeCorridorName.textContent = "No Route Available";
      elements.routeCostBadge.textContent = "Cost: -- km";
      elements.routeSegmentsList.innerHTML = `<span style="color: var(--text-muted);">Awaiting route computation</span>`;
      elements.routeClosureAlert.innerHTML = "";
      return;
    }

    elements.routeCorridorName.textContent = `${route.start} → ${route.destination}`;
    elements.routeCostBadge.textContent = `Total Cost: ${route.total_cost || 0} km`;

    // Render nodes flow
    elements.routeSegmentsList.innerHTML = (route.path || []).map((node, idx) => {
      const isLast = idx === route.path.length - 1;
      return `
        <span class="segment-node">${node}</span>
        ${!isLast ? '<span class="segment-arrow">&rarr;</span>' : ''}
      `;
    }).join("");

    // Render Alert Box
    const traversedClosed = route.traversed_closed_roads || [];
    const closuresAvoided = route.closures_avoided || [];

    if (traversedClosed.length > 0) {
      elements.routeClosureAlert.className = "route-alert hazard";
      elements.routeClosureAlert.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>
        </svg>
        <span>CRITICAL HAZARD: Route traverses closed road segment(s): <strong>${traversedClosed.join(", ")}</strong>!</span>
      `;
    } else {
      const avoidedNames = closuresAvoided.map(c => `${c.id} (${c.from_node}↔${c.to_node})`).join(", ");
      elements.routeClosureAlert.className = "route-alert success";
      elements.routeClosureAlert.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Active route safely avoids closed segments: <strong>${avoidedNames || "Hazard Zones"}</strong></span>
      `;
    }
  }

  // 4. DISPATCH COORDINATION PANEL
  function renderDispatchCoordination(dispatch, eligibilityMatrix) {
    const details = dispatch.details || [];
    const totalAssigned = dispatch.total_assigned || 0;
    const totalUnassigned = dispatch.total_unassigned || 0;

    elements.dispatchStatBadge.textContent = `${totalAssigned} Assigned / ${totalUnassigned} Unassigned`;

    if (details.length === 0) {
      elements.dispatchAssignmentsList.innerHTML = `<div style="color: var(--text-muted); padding: 8px;">No active dispatch requests.</div>`;
      return;
    }

    elements.dispatchAssignmentsList.innerHTML = details.map(item => {
      const isAssigned = item.status === "assigned";
      
      // Look up eligibility breakdown if assigned
      let capabilityNotice = "";
      if (isAssigned && item.unit_id) {
        const matrixEntry = eligibilityMatrix.find(e => e.incident_id === item.incident_id && e.unit_id === item.unit_id);
        if (matrixEntry) {
          if (!matrixEntry.all_skills_met || !matrixEntry.all_equipment_met) {
            capabilityNotice = `
              <div class="capability-mismatch">
                ⚠ MISMATCH: Missing ${matrixEntry.missing_skills.join(", ") || ""} ${matrixEntry.missing_equipment.join(", ") || ""}
              </div>
            `;
          }
        }
      }

      return `
        <div class="dispatch-item">
          <div class="dispatch-item-top">
            <span class="dispatch-inc-id">${item.incident_id}: ${item.incident_title}</span>
            <span class="eligibility-pill ${isAssigned ? 'pill-success' : 'pill-danger'}">
              ${isAssigned ? item.unit_name : 'UNASSIGNED'}
            </span>
          </div>
          <div class="dispatch-details">
            ${item.explanation}
          </div>
          ${capabilityNotice}
        </div>
      `;
    }).join("");
  }

  // 5. HOSPITAL SUITABILITY PANEL
  function renderHospitalSuitability(hospitalSuitability) {
    const details = hospitalSuitability.details || [];
    if (details.length === 0) {
      elements.hospitalSuitabilityList.innerHTML = `<div style="color: var(--text-muted); padding: 8px;">No casualty transports pending.</div>`;
      return;
    }

    elements.hospitalSuitabilityList.innerHTML = details.map(item => {
      const isSuitable = item.is_suitable;
      let mismatchMsg = "";
      if (!item.services_met) {
        mismatchMsg += `Missing: ${item.missing_services.join(", ")}. `;
      }
      if (!item.capacity_met) {
        mismatchMsg += `Over capacity (${item.available_beds} beds for ${item.patient_count} pts). `;
      }

      return `
        <div class="hospital-item">
          <div class="hospital-item-top">
            <span class="hosp-inc-id">${item.incident_id} (${item.patient_count} pts)</span>
            <span class="suitability-pill ${isSuitable ? 'pill-success' : 'pill-danger'}">
              ${isSuitable ? 'SUITABLE' : 'UNSUITABLE'}
            </span>
          </div>
          <div class="hospital-details">
            Dest: <strong>${item.hospital_name}</strong> (${item.distance_km} km) &bull; Beds: ${item.available_beds}/${item.total_beds}
          </div>
          ${mismatchMsg ? `<div class="capability-mismatch">${mismatchMsg}</div>` : ''}
        </div>
      `;
    }).join("");
  }

  // 6. STANDBY COVERAGE PANEL
  function renderStandbyCoverage(coverage) {
    const budgetLimit = coverage.budget_limit || 10;
    const budgetUsed = coverage.budget_used || 0;
    const totalPriority = coverage.total_priority || 0;
    const selectedUnits = coverage.selected_units || [];
    const coveredDetails = coverage.covered_details || [];
    const isOptimal = totalPriority >= 200;

    elements.coverageStatusBadge.textContent = isOptimal ? "OPTIMAL (200 PTS)" : "SUBOPTIMAL (150 PTS)";
    elements.coverageStatusBadge.style.color = isOptimal ? "var(--color-teal)" : "var(--color-amber)";

    const progressPct = Math.min(100, (budgetUsed / budgetLimit) * 100);

    const unitsHtml = selectedUnits.map(u => `
      <div class="standby-unit-badge">
        <span>${u.id}: ${u.name} (Cost: ${u.cost})</span>
        <span class="badge">Covers: ${u.covered_incidents.join(", ")}</span>
      </div>
    `).join("");

    const coveredHtml = coveredDetails.map(c => `
      <span class="tag tag-skill">${c.id}: ${c.title} (${c.priority} pts)</span>
    `).join("");

    elements.standbyCoverageContainer.innerHTML = `
      <div class="standby-metric-row">
        <span>Budget Utilization:</span>
        <span><strong>${budgetUsed} / ${budgetLimit} units</strong></span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${progressPct}%;"></div>
      </div>

      <div class="standby-metric-row" style="margin-top: 4px;">
        <span>Distinct Priority Covered:</span>
        <span style="color: ${isOptimal ? 'var(--color-teal)' : 'var(--color-amber)'}; font-weight: 700;">
          ${totalPriority} points ${isOptimal ? '★ OPTIMAL' : '⚠ SUBOPTIMAL'}
        </span>
      </div>

      <div class="standby-units-list">
        ${unitsHtml}
      </div>

      <div class="incident-tag-cloud" style="margin-top: 4px;">
        ${coveredHtml}
      </div>
    `;
  }

  // ==========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // ==========================================================================

  function bindEvents() {
    elements.btnRecompute.addEventListener("click", triggerRecompute);
    elements.btnRefresh.addEventListener("click", fetchState);

    // Tab switching
    const tabs = [elements.tabActive, elements.tabCompleted, elements.tabAll];
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        state.currentTab = tab.getAttribute("data-tab");
        if (state.data) {
          renderIncidentQueue(state.data.incidents || []);
        }
      });
    });
  }

  function startPolling() {
    // Initial fetch
    fetchState();
    checkAssetVersion();

    // Poll live state every 1.5 seconds
    state.pollTimer = setInterval(fetchState, 1500);

    // Poll asset version every 2.0 seconds
    state.versionTimer = setInterval(checkAssetVersion, 2000);
  }

  // Boot on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    startPolling();
  });

})();
