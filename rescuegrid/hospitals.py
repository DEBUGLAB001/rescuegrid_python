"""Hospital suitability evaluation and destination selection logic.

CONTEST BUG #4:
A hospital destination must provide ALL required treatment services AND have sufficient
available bed capacity for the incoming patient count.

In this baseline implementation, destination selection simply picks the closest hospital
by Euclidean distance, completely ignoring required services and available bed capacity.
This results in patients requiring burn or trauma care being dispatched to a small clinic
(H-01) with only 2 beds and no burn unit.
"""

import math
from typing import List, Dict, Optional, Any
from rescuegrid.models import Hospital, Incident


def _distance(p1: Dict[str, int], p2: Dict[str, int]) -> float:
    return math.hypot(p1["x"] - p2["x"], p1["y"] - p2["y"])


def is_hospital_suitable(hospital: Hospital, incident: Incident) -> bool:
    """Check if hospital satisfies services and capacity requirements."""
    services_met = set(incident.required_services).issubset(set(hospital.services))
    capacity_met = hospital.available_beds >= incident.patient_count
    return services_met and capacity_met


def select_destination_hospital(incident: Incident, hospitals: List[Hospital]) -> Optional[Hospital]:
    """Select the best destination hospital for an incident."""
    if not hospitals or incident.patient_count == 0:
        return None

    # BUGGY BASELINE IMPLEMENTATION:
    # Selects nearest hospital purely by distance, ignoring services and capacity!
    nearest_hospital = min(
        hospitals,
        key=lambda h: _distance(incident.coordinates, h.coordinates)
    )
    return nearest_hospital


def evaluate_hospital_destinations(incidents: List[Incident], hospitals: List[Hospital]) -> Dict[str, Any]:
    """Evaluate destinations for all incidents and provide suitability breakdown."""
    destinations = {}
    details = []

    for inc in incidents:
        if inc.status != "active":
            continue
        hospital = select_destination_hospital(inc, hospitals)
        inc.destination_hospital_id = hospital.id if hospital else None

        if hospital:
            services_met = set(inc.required_services).issubset(set(hospital.services))
            capacity_met = hospital.available_beds >= inc.patient_count
            missing_services = [s for s in inc.required_services if s not in hospital.services]

            destinations[inc.id] = hospital.id
            details.append({
                "incident_id": inc.id,
                "incident_title": inc.title,
                "patient_count": inc.patient_count,
                "required_services": inc.required_services,
                "hospital_id": hospital.id,
                "hospital_name": hospital.name,
                "available_beds": hospital.available_beds,
                "total_beds": hospital.total_beds,
                "services": hospital.services,
                "services_met": services_met,
                "capacity_met": capacity_met,
                "missing_services": missing_services,
                "is_suitable": services_met and capacity_met,
                "distance_km": round(_distance(inc.coordinates, hospital.coordinates) / 10.0, 1)
            })

    return {
        "destinations": destinations,
        "details": details
    }
