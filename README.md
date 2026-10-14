# RescueGrid — Emergency Operations Control Room Coding Challenge

RescueGrid is a municipal emergency response operations platform for the fictional metropolitan area of **Aethelgard Metro**. Dispatchers monitor incidents, units, hospitals, and road networks, coordinating emergency resources under high-concurrency operating conditions.

This challenge contains **exactly six intentional domain logic bugs**, each isolated in its own backend module in `rescuegrid/`. Your goal is to identify and fix these six defects. Correcting each defect will pass its automated test and immediately update the live operations dashboard in your browser preview.

---

## Architecture Overview

```
Rescuegrid_python/
├── app.py                      # Flask web server and live state API
├── challenge.json              # Challenge runtime and command specification
├── requirements.txt            # Python dependencies
├── start.sh                    # Startup script with hot-reload enabled
├── rescuegrid/
│   ├── __init__.py
│   ├── models.py               # Domain models (Incident, Unit, Hospital, RoadSegment, StandbyUnit)
│   ├── data.py                 # Deterministic scenario fixtures
│   ├── priority.py             # Domain Module 1: Incident priority scoring
│   ├── eligibility.py          # Domain Module 2: Unit capability eligibility
│   ├── dispatch.py             # Domain Module 3: Global dispatch matching
│   ├── hospitals.py            # Domain Module 4: Hospital suitability & triage
│   ├── routing.py              # Domain Module 5: Road network shortest path routing
│   ├── coverage.py             # Domain Module 6: Standby resource coverage
│   └── service.py              # Central operations service coordinator
├── templates/
│   └── index.html              # Dashboard shell
├── static/
│   ├── styles.css              # Emergency operations visual system
│   └── app.js                  # Live state polling and SVG map renderer
└── tests/
    └── run_tests.py            # Automated test suite (emits strict JSON telemetry)
```

---

## Domain Rules & Specification

### 1. Incident Priority Scoring (`rescuegrid/priority.py`)
Each incident has four urgency factors:
- `base_severity`: Integer from 1 to 5.
- `people_at_risk`: Count of individuals endangered.
- `age_minutes`: Elapsed duration since initial emergency report.
- `escalation_indicator`: Boolean flag indicating rapid condition escalation.

**Intended Policy:**
All four factors must contribute positively to a deterministic priority score:
$$\text{Priority Score} = (\text{base\_severity} \times 25.0) + (\text{people\_at\_risk} \times 10.0) + (\text{age\_minutes} \times 1.5) + (30.0 \text{ if escalation\_indicator else } 0.0)$$
Incidents must be sorted descending by their computed priority score so the most critical incidents appear first in the dispatch queue.

---

### 2. Unit Capability Eligibility (`rescuegrid/eligibility.py`)
Emergency incidents have required capabilities consisting of `required_skills` and `required_equipment`.

**Intended Policy:**
A response unit is eligible to respond to an incident **only if** it possesses:
1. **Every** required skill: `set(incident.required_skills).issubset(set(unit.skills))`
2. **Every** required equipment item: `set(incident.required_equipment).issubset(set(unit.equipment))`

If any skill or equipment item is missing, the unit cannot be deployed to that incident.

---

### 3. Global Dispatch Assignment (`rescuegrid/dispatch.py`)
Emergency dispatch must maximize the number of served active incidents while respecting capability requirements and 1-to-1 unit constraints (a unit can serve at most one active incident).

**Intended Policy:**
Naive greedy matching may assign a flexible unit (capable of handling multiple incident types) to a nearby incident that has an alternative specialist unit available, leaving a high-priority incident unserved.
The global dispatch engine must implement an **augmenting-path maximum bipartite matching** algorithm (e.g., augmenting DFS / Kuhn's algorithm / Hopcroft-Karp) with deterministic tie-breaking (order candidates by `unit_id` ascending). All feasible active incidents must be assigned.

---

### 4. Hospital Destination Suitability (`rescuegrid/hospitals.py`)
Casualty transport requires delivering patients to suitable medical facilities.

**Intended Policy:**
A hospital destination is suitable for an incident **only if**:
1. It provides **all** required treatment services: `set(incident.required_services).issubset(set(hospital.services))`
2. It has sufficient bed capacity: `hospital.available_beds >= incident.patient_count`

Among suitable hospitals, the facility closest to the incident coordinates must be selected. Hospitals failing services or bed capacity must never be selected.

---

### 5. Road Network Routing (`rescuegrid/routing.py`)
Emergency responders travel through a weighted city road network. Road segments have distance weights and an `is_closed` boolean status.

**Intended Policy:**
The shortest-path routing algorithm (e.g., Dijkstra's algorithm) must compute the lowest-cost path between the origin and destination while **strictly excluding** any road segment where `is_closed == True`. The route must never traverse closed or hazardous road segments.

---

### 6. Standby Resource Coverage (`rescuegrid/coverage.py`)
Emergency planners pre-position standby reserve units under a fixed deployment budget (e.g. 10 units of resource/fuel). Each standby unit has a deployment cost and covers a set of potential vulnerable incidents.

**Intended Policy:**
Maximize the **total priority of distinct covered incidents** subject to total deployment cost $\le \text{budget}$. An incident's priority counts **only once**, even if covered by multiple selected units:
$$\max \sum_{i \in \bigcup_{u \in S} \text{covered}(u)} \text{priority}(i) \quad \text{subject to} \sum_{u \in S} \text{cost}(u) \le \text{budget}$$
A greedy heuristic based on unit cost ratio can become trapped in a suboptimal subset. The standby planner must find the true optimal subset of units maximizing total covered priority under the budget constraint.

---

## Getting Started

### 1. Launch the Application
Run the start script:
```bash
bash start.sh
```
Or run Flask directly:
```bash
python -m flask --app app run --debug --reload --host 0.0.0.0 --port 5000
```

### 2. View the Live Dashboard
Open your preview browser at port `5000` (or the `/runtime/{runtime_id}/preview/` proxy path).
The dashboard automatically polls `api/state` every 1.5 seconds. Any backend code edits will trigger Flask to reload, and the already-open browser preview will immediately display the updated operational state without requiring a manual refresh.

### 3. Run Automated Tests
Execute the challenge test suite:
```bash
python tests/run_tests.py
```
The test runner outputs strict JSON telemetry to `stdout`. Diagnostics and tracebacks appear on `stderr`.
All six tests must pass with an exit code of `0`.
