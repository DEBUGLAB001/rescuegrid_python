"""RescueGrid Contest Test Runner.

Executes all six domain challenge test cases and outputs strict JSON to stdout.
Diagnostics and stack traces are directed to stderr.
"""

import sys
import os
import time
import json
import traceback

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from rescuegrid.data import (
    get_initial_incidents,
    get_initial_units,
    get_initial_hospitals,
    get_initial_road_segments,
    get_standby_budget,
    get_standby_incidents,
    get_standby_units
)
from rescuegrid.priority import prioritize_incidents
from rescuegrid.eligibility import is_unit_eligible
from rescuegrid.dispatch import compute_dispatch
from rescuegrid.hospitals import select_destination_hospital
from rescuegrid.routing import find_shortest_route
from rescuegrid.coverage import compute_standby_coverage


def test_incident_priority_ordering():
    """Verify Bug 1: Deterministic priority calculation and descending sorting."""
    incidents = [inc for inc in get_initial_incidents() if inc.status == "active"]
    sorted_incidents = prioritize_incidents(incidents)

    inc_lookup = {inc.id: inc for inc in sorted_incidents}
    inc_101 = inc_lookup.get("INC-101")
    inc_103 = inc_lookup.get("INC-103")
    inc_102 = inc_lookup.get("INC-102")
    inc_104 = inc_lookup.get("INC-104")

    if not inc_101:
        raise AssertionError("Missing incident INC-101")

    # Intended score: 5*25 + 12*10 + 24*1.5 + 30 = 125 + 120 + 36 + 30 = 311.0
    if inc_101.priority_score != 311.0:
        raise AssertionError(
            f"INC-101 score is {inc_101.priority_score} (expected 311.0); "
            f"age urgency and escalation indicator must be correctly added"
        )

    # Ordering check: INC-101 (311.0) must be first
    if sorted_incidents[0].id != "INC-101":
        first_id = sorted_incidents[0].id
        raise AssertionError(
            f"Incident INC-101 was ranked below {first_id}; expected highest priority incident to be first"
        )

    if inc_103 and inc_103.priority_score != 262.5:
        raise AssertionError(f"INC-103 score is {inc_103.priority_score} (expected 262.5)")

    if inc_102 and inc_102.priority_score != 195.0:
        raise AssertionError(f"INC-102 score is {inc_102.priority_score} (expected 195.0)")


def test_unit_capability_eligibility():
    """Verify Bug 2: Unit capability eligibility requires all skills AND all equipment."""
    incidents = {inc.id: inc for inc in get_initial_incidents()}
    units = {u.id: u for u in get_initial_units()}

    inc_101 = incidents["INC-101"]
    u_01 = units["U-01"]  # Has all skills and equipment
    u_02 = units["U-02"]  # Missing heavy_extrication skill and hydraulic_spreader equipment

    if not is_unit_eligible(u_01, inc_101):
        raise AssertionError("Fully capable unit U-01 was marked ineligible for INC-101")

    if is_unit_eligible(u_02, inc_101):
        raise AssertionError(
            "Unit U-02 was marked eligible for INC-101 despite missing required equipment: hydraulic_spreader"
        )


def test_global_dispatch_maximum_matching():
    """Verify Bug 3: Global dispatch assignment uses maximum matching with augmenting paths."""
    incidents = [inc for inc in get_initial_incidents() if inc.status == "active"]
    units = get_initial_units()

    # Prioritize active incidents
    prioritized = prioritize_incidents(incidents)
    dispatch_result = compute_dispatch(prioritized, units)
    assignments = dispatch_result.get("assignments", {})

    assigned_101 = assignments.get("INC-101")
    assigned_102 = assignments.get("INC-102")
    assigned_103 = assignments.get("INC-103")

    if not assigned_101:
        raise AssertionError(
            "High-priority incident INC-101 was left unassigned; flexible unit was consumed without augmenting path"
        )

    if assigned_101 != "U-01":
        raise AssertionError(
            f"INC-101 assigned to {assigned_101}; only U-01 possesses required hazmat + heavy extrication"
        )

    if assigned_102 != "U-03":
        raise AssertionError(f"INC-102 assigned to {assigned_102}; expected U-03")

    if assigned_103 != "U-04":
        raise AssertionError(f"INC-103 assigned to {assigned_103}; expected U-04")

    # Verify no unit is assigned twice
    assigned_unit_ids = [uid for uid in assignments.values() if uid is not None]
    if len(assigned_unit_ids) != len(set(assigned_unit_ids)):
        raise AssertionError("Duplicate unit assignment detected in active dispatch")


def test_hospital_service_and_capacity():
    """Verify Bug 4: Hospital destination satisfies all services and capacity."""
    incidents = {inc.id: inc for inc in get_initial_incidents()}
    hospitals = get_initial_hospitals()

    inc_101 = incidents["INC-101"]  # Requires trauma_center, burn_unit and capacity >= 5
    chosen_hospital = select_destination_hospital(inc_101, hospitals)

    if not chosen_hospital:
        raise AssertionError("No destination hospital was selected for INC-101")

    if chosen_hospital.id != "H-03":
        raise AssertionError(
            f"Hospital {chosen_hospital.id} selected for INC-101 despite lacking required burn_unit/capacity; expected H-03"
        )

    if chosen_hospital.available_beds < inc_101.patient_count:
        raise AssertionError(
            f"Hospital {chosen_hospital.id} available capacity ({chosen_hospital.available_beds}) is less than patient count ({inc_101.patient_count})"
        )


def test_route_avoids_closed_roads():
    """Verify Bug 5: Routing excludes closed road segments and computes accurate cost."""
    segments = get_initial_road_segments()
    route = find_shortest_route("West End", "Central Plaza", segments)

    if not route.get("is_valid", False):
        traversed = route.get("traversed_closed_roads", [])
        raise AssertionError(f"Route traversed closed road segment: {', '.join(traversed)}")

    if "SEG-WC" in route.get("segment_ids", []):
        raise AssertionError("Computed route traversed closed road segment SEG-WC")

    expected_cost = 6.5
    actual_cost = route.get("total_cost", 0.0)
    if actual_cost != expected_cost:
        raise AssertionError(
            f"Route total cost is {actual_cost} km (expected detour cost {expected_cost} km around closed SEG-WC)"
        )


def test_resource_coverage_optimum():
    """Verify Bug 6: Standby resource coverage finds global maximum priority under budget."""
    budget = get_standby_budget()
    units = get_standby_units()
    incident_priorities = get_standby_incidents()

    result = compute_standby_coverage(budget, units, incident_priorities)

    total_priority = result.get("total_priority", 0)
    selected_unit_ids = set(result.get("selected_unit_ids", []))
    budget_used = result.get("budget_used", 0)

    if total_priority < 200:
        raise AssertionError(
            f"Standby coverage achieved suboptimal priority {total_priority}; expected optimal priority 200 via ['ST-2', 'ST-3']"
        )

    if selected_unit_ids != {"ST-2", "ST-3"}:
        raise AssertionError(
            f"Selected units {sorted(list(selected_unit_ids))} do not match optimal subset ['ST-2', 'ST-3']"
        )

    if budget_used > budget:
        raise AssertionError(f"Budget exceeded: {budget_used} > {budget}")


TEST_SUITE = [
    ("test_incident_priority_ordering", test_incident_priority_ordering),
    ("test_unit_capability_eligibility", test_unit_capability_eligibility),
    ("test_global_dispatch_maximum_matching", test_global_dispatch_maximum_matching),
    ("test_hospital_service_and_capacity", test_hospital_service_and_capacity),
    ("test_route_avoids_closed_roads", test_route_avoids_closed_roads),
    ("test_resource_coverage_optimum", test_resource_coverage_optimum),
]


def run_all_tests():
    total_start = time.perf_counter()
    results = {}
    passed_count = 0
    failed_count = 0

    for name, test_fn in TEST_SUITE:
        start_time = time.perf_counter()
        try:
            test_fn()
            duration_ms = max(1, int((time.perf_counter() - start_time) * 1000))
            results[name] = {
                "Status": "passed",
                "Execution time": f"{duration_ms}ms"
            }
            passed_count += 1
        except Exception as e:
            duration_ms = max(1, int((time.perf_counter() - start_time) * 1000))
            # Send full traceback to stderr
            print(f"[ERROR in {name}]:\n{traceback.format_exc()}", file=sys.stderr)
            results[name] = {
                "Status": "failed",
                "Execution time": f"{duration_ms}ms",
                "Error": str(e)
            }
            failed_count += 1

    total_duration_ms = max(1, int((time.perf_counter() - total_start) * 1000))

    results["Passed"] = passed_count
    results["Failed"] = failed_count
    results["Total bugs"] = len(TEST_SUITE)
    results["Total Execution time"] = f"{total_duration_ms}ms"

    # Strictly output single valid JSON to stdout
    print(json.dumps(results, indent=2))

    # Exit 0 only if all passed, nonzero if any failed
    sys.exit(0 if failed_count == 0 else 1)


if __name__ == "__main__":
    run_all_tests()
