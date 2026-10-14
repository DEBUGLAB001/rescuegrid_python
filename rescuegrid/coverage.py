"""Standby resource coverage optimization logic.

CONTEST BUG #6:
Given a limited deployment budget, select standby units that maximize the total priority
of distinct incidents they can cover. An incident can only contribute its priority ONCE,
even if multiple selected units cover it.

In this baseline implementation, a greedy heuristic is used: it repeatedly picks the unit
with the highest priority-to-cost ratio that fits in the remaining budget.
Because unit ST-1 has an appealing individual ratio (150/7 = 21.43), greedy selects it and
runs out of remaining budget (3 remaining), achieving only 150 priority.
The optimal global solution requires selecting ST-2 (cost 5) and ST-3 (cost 5), which together
cover all four incidents achieving a total priority of 200 within the budget of 10.
"""

from typing import List, Dict, Any, Set
from rescuegrid.models import StandbyUnit


def optimize_standby_coverage_greedy(
    budget: int,
    units: List[StandbyUnit],
    incident_priorities: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """BUGGY BASELINE: Greedily selects units by individual priority/cost ratio.
    
    Fails to achieve global maximum coverage under budget constraints.
    """
    remaining_budget = budget
    selected_unit_ids: List[str] = []
    covered_incident_ids: Set[str] = set()

    # Calculate individual priority and ratio for each unit
    unit_stats = []
    for u in units:
        prio_sum = sum(incident_priorities.get(cid, {}).get("priority", 0) for cid in u.covered_incident_ids)
        ratio = prio_sum / u.cost if u.cost > 0 else 0
        unit_stats.append((ratio, prio_sum, u))

    # Sort units by ratio descending
    unit_stats.sort(key=lambda item: (item[0], item[1]), reverse=True)

    for ratio, prio_sum, unit in unit_stats:
        if unit.cost <= remaining_budget:
            selected_unit_ids.append(unit.id)
            remaining_budget -= unit.cost
            for cid in unit.covered_incident_ids:
                covered_incident_ids.add(cid)

    # Compute distinct covered priority
    total_priority = sum(
        incident_priorities.get(cid, {}).get("priority", 0)
        for cid in covered_incident_ids
    )

    return {
        "budget_limit": budget,
        "budget_used": budget - remaining_budget,
        "budget_remaining": remaining_budget,
        "selected_unit_ids": selected_unit_ids,
        "covered_incident_ids": sorted(list(covered_incident_ids)),
        "total_priority": total_priority,
        "is_optimal": False  # Marker indicating greedy result
    }


def compute_standby_coverage(
    budget: int,
    units: List[StandbyUnit],
    incident_priorities: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """Execute coverage calculation and package detailed summary for dashboard."""
    # BASELINE: Calls buggy greedy coverage
    result = optimize_standby_coverage_greedy(budget, units, incident_priorities)

    unit_lookup = {u.id: u for u in units}
    selected_units_details = []
    for uid in result["selected_unit_ids"]:
        u = unit_lookup.get(uid)
        if u:
            selected_units_details.append({
                "id": u.id,
                "name": u.name,
                "cost": u.cost,
                "covered_incidents": u.covered_incident_ids
            })

    covered_details = []
    for cid in result["covered_incident_ids"]:
        info = incident_priorities.get(cid, {})
        covered_details.append({
            "id": cid,
            "title": info.get("title", cid),
            "priority": info.get("priority", 0)
        })

    result["selected_units"] = selected_units_details
    result["covered_details"] = covered_details
    return result
