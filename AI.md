# RescueGrid

## Description

RescueGrid is an emergency operations control room application built with Python Flask and vanilla JavaScript that coordinates incident monitoring, capability-based unit dispatch, hospital triage, and route planning.

## Repository Structure

```text
Rescuegrid_python/
├── challenge.json          Runtime, port, startup, and test runner configuration
├── requirements.txt        Python dependencies (Flask)
├── start.sh                Startup script launching Flask development server with hot reload
├── app.py                  Flask HTTP server, page routes, and live state REST API endpoints
├── rescuegrid/
│   ├── __init__.py         Package initializer
│   ├── models.py           Dataclass definitions for Incident, Unit, Hospital, RoadSegment, StandbyUnit
│   ├── data.py             Deterministic fixture data for incidents, units, hospitals, and road networks
│   ├── priority.py         Domain Module 1: Incident priority scoring and queue sorting logic
│   ├── eligibility.py      Domain Module 2: Unit capability, skill, and equipment eligibility validation
│   ├── dispatch.py         Domain Module 3: Global dispatch bipartite matching and unit allocation
│   ├── hospitals.py        Domain Module 4: Hospital suitability evaluation and patient triage routing
│   ├── routing.py          Domain Module 5: Road network shortest path routing and closure avoidance
│   ├── coverage.py         Domain Module 6: Standby resource coverage combinatorial optimization
│   └── service.py          Central control room service coordinator aggregating full operational state
├── static/
│   ├── app.js              Client-side application logic, state polling, and dynamic SVG map rendering
│   └── styles.css          Visual design system, layout grid, dark theme, and status indicator styles
├── templates/
│   ├── base.html           Master layout template with navigation header, status banner, and metrics bar
│   ├── index.html          Unified operations dashboard containing all system modules and panels
│   ├── map.html            Dedicated metropolitan SVG map view with interactive overlays
│   ├── incidents.html      Incident operations queue view with priority scores and details
│   ├── dispatch.html       Unit assignment view with capability matrix and dispatch recommendations
│   ├── facilities.html     Hospital status and casualty destination triage inspection view
│   ├── routing.html        Road network navigation and closed segment detour visualizer
│   └── standby.html        Standby resource deployment budget and incident coverage planner
├── tests/
│   └── run_tests.py        Automated test suite executing the six challenge domain verifications
├── docs/
│   └── ORGANIZER_NOTES.md  Contest reference guide documenting defect analysis and baseline manifests
└── README.md               Candidate challenge documentation, domain policies, and instructions
```

## Bugs and Bug Locations

### 1. Incident priority calculation subtracts age penalty and ignores escalation

- **Bug location:** `rescuegrid/priority.py`
- **How to observe it:** Open `/incidents` or run `python tests/run_tests.py` (`test_incident_priority_ordering`).
- **Failure:** Priority calculation subtracts age penalty instead of adding urgency and ignores the escalation indicator, causing incident INC-101 to score 173.0 instead of 311.0 and rank behind newer incidents.
- **Expected:** Priority adds base severity, people at risk, age urgency, and escalation bonus, ranking INC-101 first with a score of 311.0.

### 2. Unit capability check permits incomplete skills and ignores equipment

- **Bug location:** `rescuegrid/eligibility.py`
- **How to observe it:** View `/dispatch` capability matrix or run `python tests/run_tests.py` (`test_unit_capability_eligibility`).
- **Failure:** Eligibility only requires any single matching skill and completely ignores equipment requirements, incorrectly marking unit U-02 eligible for INC-101.
- **Expected:** Units must possess all required skills and all required equipment items, correctly marking unit U-02 ineligible for INC-101.

### 3. Greedy dispatch heuristic locks multi-specialist units without augmenting paths

- **Bug location:** `rescuegrid/dispatch.py`
- **How to observe it:** View `/dispatch` or run `python tests/run_tests.py` (`test_global_dispatch_maximum_matching`).
- **Failure:** Greedy assignment binds flexible unit U-01 to nearby incident INC-102 without augmenting paths, leaving highest-priority incident INC-101 unassigned.
- **Expected:** Augmenting-path maximum bipartite matching assigns U-01 to INC-101, U-03 to INC-102, and U-04 to INC-103 so all active incidents are served.

### 4. Hospital destination selection ignores service suitability and bed capacity

- **Bug location:** `rescuegrid/hospitals.py`
- **How to observe it:** View `/facilities` or run `python tests/run_tests.py` (`test_hospital_service_and_capacity`).
- **Failure:** Selects the closest clinic (H-01) by distance alone, ignoring that it has only 2 beds and lacks burn care needed for INC-101's 5 patients.
- **Expected:** Filters facilities by required services and capacity before distance, assigning INC-101 to St. Jude Regional Trauma & Burn Center (H-03).

### 5. Road network pathfinder fails to exclude closed road segments

- **Bug location:** `rescuegrid/routing.py`
- **How to observe it:** View `/routing` or run `python tests/run_tests.py` (`test_route_avoids_closed_roads`).
- **Failure:** Route calculation includes closed segments in graph search, steering emergency traffic through hazardous closed corridor SEG-WC (cost 4.0 km).
- **Expected:** Closed segments are excluded from graph construction, safely routing around SEG-WC via North District with a detour cost of 6.5 km.

### 6. Standby coverage heuristic selects suboptimal unit ratio over global maximum

- **Bug location:** `rescuegrid/coverage.py`
- **How to observe it:** View `/standby` or run `python tests/run_tests.py` (`test_resource_coverage_optimum`).
- **Failure:** Greedy selection picks unit ST-1 by individual cost ratio, exhausting 7 of 10 budget and covering only 3 incidents for 150 priority.
- **Expected:** Combinatorial optimization selects units ST-2 and ST-3 within budget 10, covering all 4 incidents for the maximum priority of 200.

## Expected Behaviour After Fixing All Bugs

- Incidents are sorted descending by their true priority score with critical emergencies ranked first.
- Response units are dispatched only when meeting all required skills and equipment.
- Global dispatch maximizes incident coverage using augmenting paths so no critical incident is stranded.
- Patient transport routes casualties to nearest hospitals with matching specialized services and adequate bed capacity.
- Navigation routes bypass closed or hazardous road corridors.
- Standby unit allocation achieves global maximum incident priority coverage within the deployment budget.
- All 6 tests in `python tests/run_tests.py` pass with exit code 0.
