"""Global dispatch assignment logic.

CONTEST BUG #3:
A response unit may serve at most one active incident, and must satisfy the incident's
skill and equipment requirements.

In this baseline implementation, dispatch uses a greedy nearest-assignment heuristic:
Flexible unit U-01 is greedily assigned to nearby incident INC-102. When capability
eligibility is properly enforced, high-priority incident INC-101 (requiring U-01's combined
hazmat and heavy extrication capabilities) is left unserved ("UNASSIGNED") because U-01
is already locked to INC-102, even though a valid global assignment exists where U-03 serves
INC-102 and U-01 serves INC-101.

The correct solution requires implementing an augmenting-path maximum bipartite matching
(e.g., Ford-Fulkerson / Hopcroft-Karp / Kuhn's algorithm) with deterministic tie-breaking.
"""

import math
from typing import List, Dict, Optional, Tuple, Any
from rescuegrid.models import Incident, Unit
from rescuegrid.eligibility import is_unit_eligible


def _distance(p1: Dict[str, int], p2: Dict[str, int]) -> float:
    return math.hypot(p1["x"] - p2["x"], p1["y"] - p2["y"])


def assign_dispatch_greedy(incidents: List[Incident], units: List[Unit]) -> Dict[str, Optional[str]]:
    """BUGGY BASELINE: Greedily assigns units to nearest eligible incidents without augmenting paths.
    
    Returns a mapping of incident_id -> assigned unit_id (or None).
    """
    assignments: Dict[str, Optional[str]] = {inc.id: None for inc in incidents if inc.status == "active"}
    assigned_units = set()

    # Consider available units sorted deterministically by ID
    available_units = sorted([u for u in units if u.status != "standby"], key=lambda u: u.id)
    active_incidents = [inc for inc in incidents if inc.status == "active"]

    # Greedy policy: each unit is assigned to its nearest eligible unassigned incident
    for unit in available_units:
        if unit.id in assigned_units:
            continue
        # Find eligible unassigned incidents
        eligible_candidates = [
            inc for inc in active_incidents
            if assignments[inc.id] is None and is_unit_eligible(unit, inc)
        ]
        if not eligible_candidates:
            continue
        # Pick nearest eligible incident
        nearest_inc = min(
            eligible_candidates,
            key=lambda inc: _distance(unit.coordinates, inc.coordinates)
        )
        assignments[nearest_inc.id] = unit.id
        assigned_units.add(unit.id)

    return assignments


def compute_dispatch(incidents: List[Incident], units: List[Unit]) -> Dict[str, Any]:
    """Execute dispatch coordination and update incident/unit objects."""
    # BASELINE: Calls greedy dispatch
    assignments = assign_dispatch_greedy(incidents, units)

    unit_lookup = {u.id: u for u in units}
    detailed_assignments = []

    for inc in incidents:
        if inc.status != "active":
            continue
        unit_id = assignments.get(inc.id)
        inc.assigned_unit_id = unit_id
        if unit_id and unit_id in unit_lookup:
            unit = unit_lookup[unit_id]
            unit.assigned_incident_id = inc.id
            unit.status = "assigned"
            detailed_assignments.append({
                "incident_id": inc.id,
                "incident_title": inc.title,
                "priority_score": inc.priority_score,
                "unit_id": unit.id,
                "unit_name": unit.name,
                "status": "assigned",
                "explanation": f"Assigned {unit.name} ({unit.id}) to {inc.id}"
            })
        else:
            detailed_assignments.append({
                "incident_id": inc.id,
                "incident_title": inc.title,
                "priority_score": inc.priority_score,
                "unit_id": None,
                "unit_name": "UNASSIGNED",
                "status": "unassigned",
                "explanation": "No eligible unit available under current dispatch policy"
            })

    return {
        "assignments": assignments,
        "details": detailed_assignments,
        "total_assigned": sum(1 for uid in assignments.values() if uid is not None),
        "total_unassigned": sum(1 for uid in assignments.values() if uid is None)
    }
