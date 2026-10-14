"""Control room service coordinator.

Integrates domain modules to produce the unified RescueGrid operational state.
All dashboard views and API endpoints read live values through this service.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List
import copy

from rescuegrid.data import (
    get_city_metadata,
    get_initial_incidents,
    get_initial_units,
    get_initial_hospitals,
    get_initial_road_segments,
    get_node_coordinates,
    get_standby_budget,
    get_standby_incidents,
    get_standby_units
)
from rescuegrid.priority import prioritize_incidents
from rescuegrid.eligibility import get_eligibility_breakdown
from rescuegrid.dispatch import compute_dispatch
from rescuegrid.hospitals import evaluate_hospital_destinations
from rescuegrid.routing import find_shortest_route
from rescuegrid.coverage import compute_standby_coverage


class ControlRoomService:
    def __init__(self):
        self.last_recompute_time = datetime.now(timezone.utc).isoformat()

    def get_full_state(self) -> Dict[str, Any]:
        """Compute and return complete operational state for RescueGrid."""
        # Load fresh copies of fixtures
        incidents = get_initial_incidents()
        units = get_initial_units()
        hospitals = get_initial_hospitals()
        road_segments = get_initial_road_segments()
        node_coords = get_node_coordinates()
        standby_budget = get_standby_budget()
        standby_incidents = get_standby_incidents()
        standby_units = get_standby_units()
        city_meta = get_city_metadata()

        # Step 1: Priority scoring and ordering (Domain Module 1)
        # Separate active and completed
        active_incidents = [inc for inc in incidents if inc.status == "active"]
        completed_incidents = [inc for inc in incidents if inc.status == "completed"]

        # Prioritize active incidents
        sorted_active = prioritize_incidents(active_incidents)
        for comp in completed_incidents:
            comp.priority_score = 0.0

        all_incidents = sorted_active + completed_incidents

        # Step 2: Global Dispatch Matching (Domain Module 3, calling Module 2 Eligibility)
        dispatch_result = compute_dispatch(sorted_active, units)

        # Step 3: Eligibility Matrix for inspection
        eligibility_matrix = []
        for inc in sorted_active:
            for u in units:
                breakdown = get_eligibility_breakdown(u, inc)
                eligibility_matrix.append(breakdown)

        # Step 4: Hospital Destination Suitability (Domain Module 4)
        hospital_result = evaluate_hospital_destinations(sorted_active, hospitals)

        # Step 5: Road Routing (Domain Module 5)
        # Primary corridor: West End (INC-101) to Central Plaza (or hospital H-02/H-03)
        route_result = find_shortest_route("West End", "Central Plaza", road_segments)

        # Step 6: Standby Resource Coverage (Domain Module 6)
        coverage_result = compute_standby_coverage(
            standby_budget,
            standby_units,
            standby_incidents
        )

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        return {
            "city": city_meta,
            "last_updated": now_str,
            "metrics": {
                "active_incidents_count": len(sorted_active),
                "completed_incidents_count": len(completed_incidents),
                "total_units_available": sum(1 for u in units if u.status == "available"),
                "total_units_assigned": sum(1 for u in units if u.status == "assigned"),
                "critical_unassigned_count": dispatch_result.get("total_unassigned", 0),
                "closed_roads_count": sum(1 for r in road_segments if r.is_closed)
            },
            "incidents": [inc.to_dict() for inc in all_incidents],
            "units": [u.to_dict() for u in units],
            "hospitals": [h.to_dict() for h in hospitals],
            "road_segments": [r.to_dict() for r in road_segments],
            "node_coordinates": node_coords,
            "dispatch": dispatch_result,
            "eligibility_matrix": eligibility_matrix,
            "hospital_suitability": hospital_result,
            "routing": route_result,
            "standby_coverage": coverage_result
        }


# Singleton service instance
_service_instance = ControlRoomService()


def get_service() -> ControlRoomService:
    global _service_instance
    return _service_instance
