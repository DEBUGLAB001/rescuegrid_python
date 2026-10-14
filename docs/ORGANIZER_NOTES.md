# RESCUEGRID CONTEST ORGANIZER ANSWER KEY & REFERENCE
*CONFIDENTIAL — EXCLUDED FROM PARTICIPANT DISTRIBUTION*

This reference guide provides tournament judges and organizers with the complete defect analysis, baseline bug mechanisms, and expected solutions for all six domain modules.

---

## Challenge Summary

| # | Domain Module | Defect Description | Baseline Manifestation | Expected Solved State |
|---|---|---|---|---|
| 1 | `rescuegrid/priority.py` | Priority formula subtracts age instead of adding urgency, and ignores `escalation_indicator`. | INC-101 receives score 173.0 and ranks below INC-103 (210.0). | INC-101 receives score 311.0, INC-103 262.5, INC-102 195.0, INC-104 107.0. INC-101 ranks #1. |
| 2 | `rescuegrid/eligibility.py` | Unit eligibility checks if unit has ANY required skill and completely ignores equipment requirements. | U-02 (lacking heavy extrication and hydraulic spreader) is marked eligible for INC-101. | U-02 is marked ineligible (`is_unit_eligible == False`). Only U-01 is eligible. |
| 3 | `rescuegrid/dispatch.py` | Dispatch assigns units greedily to nearest incidents without augmenting paths. | U-01 is assigned to INC-102, leaving critical incident INC-101 unassigned. | Augmenting path maximum matching assigns INC-101 -> U-01, INC-102 -> U-03, INC-103 -> U-04. |
| 4 | `rescuegrid/hospitals.py` | Destination selection picks nearest hospital purely by distance, ignoring services and capacity. | Clinic H-01 (2 beds, no burn unit) is selected for INC-101 (5 patients, burn/trauma needed). | H-03 (St. Jude Regional Trauma & Burn Center) is selected. |
| 5 | `rescuegrid/routing.py` | Shortest path router fails to filter out closed road segments (`is_closed == True`). | Route traverses closed road SEG-WC (cost 4.0 km). | Route bypasses SEG-WC via North District: segments SEG-WN + SEG-NC (cost 6.5 km). Avoids SEG-WC. |
| 6 | `rescuegrid/coverage.py` | Greedy selection picks unit by individual ratio, running out of budget prematurely. | Greedy selects ST-1 (cost 7, priority 150), achieving only 150 points. | Optimization chooses ST-2 (cost 5) + ST-3 (cost 5), covering all 4 incidents with priority 200. |

---

## Module Fix Implementations

### 1. `rescuegrid/priority.py`
```python
def calculate_incident_priority(incident: Incident) -> float:
    score = (
        (incident.base_severity * 25.0) +
        (incident.people_at_risk * 10.0) +
        (incident.age_minutes * 1.5) +
        (30.0 if incident.escalation_indicator else 0.0)
    )
    return round(score, 1)

def prioritize_incidents(incidents: List[Incident]) -> List[Incident]:
    for inc in incidents:
        inc.priority_score = calculate_incident_priority(inc)
    return sorted(incidents, key=lambda inc: (inc.priority_score or 0.0), reverse=True)
```

### 2. `rescuegrid/eligibility.py`
```python
def is_unit_eligible(unit: Unit, incident: Incident) -> bool:
    skills_met = set(incident.required_skills).issubset(set(unit.skills))
    equipment_met = set(incident.required_equipment).issubset(set(unit.equipment))
    return skills_met and equipment_met
```

### 3. `rescuegrid/dispatch.py`
```python
def assign_dispatch_maximum_matching(incidents: List[Incident], units: List[Unit]) -> Dict[str, Optional[str]]:
    active_incidents = [inc for inc in incidents if inc.status == "active"]
    available_units = sorted([u for u in units if u.status != "standby"], key=lambda u: u.id)
    
    # Priority order for incidents
    sorted_incidents = sorted(active_incidents, key=lambda inc: (inc.priority_score or 0.0), reverse=True)

    # Kuhn's algorithm for Maximum Bipartite Matching
    match_unit_to_inc: Dict[str, str] = {}  # unit_id -> inc_id

    def try_augment(inc: Incident, visited: Set[str]) -> bool:
        for unit in available_units:
            if not is_unit_eligible(unit, inc):
                continue
            if unit.id in visited:
                continue
            visited.add(unit.id)
            if unit.id not in match_unit_to_inc:
                match_unit_to_inc[unit.id] = inc.id
                return True
            assigned_inc = next((i for i in active_incidents if i.id == match_unit_to_inc[unit.id]), None)
            if assigned_inc and try_augment(assigned_inc, visited):
                match_unit_to_inc[unit.id] = inc.id
                return True
        return False

    for inc in sorted_incidents:
        try_augment(inc, set())

    # Invert mapping
    assignments = {inc.id: None for inc in active_incidents}
    for uid, iid in match_unit_to_inc.items():
        assignments[iid] = uid

    return assignments
```

### 4. `rescuegrid/hospitals.py`
```python
def select_destination_hospital(incident: Incident, hospitals: List[Hospital]) -> Optional[Hospital]:
    if not hospitals or incident.patient_count == 0:
        return None
    suitable = [
        h for h in hospitals
        if set(incident.required_services).issubset(set(h.services))
        and h.available_beds >= incident.patient_count
    ]
    if not suitable:
        return None
    return min(suitable, key=lambda h: _distance(incident.coordinates, h.coordinates))
```

### 5. `rescuegrid/routing.py`
```python
# In find_shortest_route, skip closed segments:
for s in segments:
    if s.is_closed:
        continue
    if s.from_node not in adj:
        adj[s.from_node] = []
    if s.to_node not in adj:
        adj[s.to_node] = []
    adj[s.from_node].append((s.to_node, s.distance, s))
    adj[s.to_node].append((s.from_node, s.distance, s))
```

### 6. `rescuegrid/coverage.py`
```python
def optimize_standby_coverage_optimal(
    budget: int,
    units: List[StandbyUnit],
    incident_priorities: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    # Subset dynamic programming / exhaustive search over unit combinations
    best_priority = -1
    best_combo = []
    best_cost = 0
    best_covered = set()

    import itertools
    for r in range(1, len(units) + 1):
        for combo in itertools.combinations(units, r):
            total_cost = sum(u.cost for u in combo)
            if total_cost > budget:
                continue
            covered = set()
            for u in combo:
                for cid in u.covered_incident_ids:
                    covered.add(cid)
            prio = sum(incident_priorities.get(cid, {}).get("priority", 0) for cid in covered)
            if prio > best_priority or (prio == best_priority and total_cost < best_cost):
                best_priority = prio
                best_combo = [u.id for u in combo]
                best_cost = total_cost
                best_covered = covered

    return {
        "budget_limit": budget,
        "budget_used": best_cost,
        "budget_remaining": budget - best_cost,
        "selected_unit_ids": best_combo,
        "covered_incident_ids": sorted(list(best_covered)),
        "total_priority": best_priority,
        "is_optimal": True
    }
```

---

## Git State Switching Instructions

### Switch to Solved State:
```bash
git checkout rescuegrid-challenge-solved
```

### Switch to Baseline State:
```bash
git checkout rescuegrid-challenge-baseline
```
