"""Incident priority scoring and ordering logic.

CONTEST BUG #1:
The intended policy is that all four factors (base severity, people at risk,
age in minutes, and escalation indicator) contribute positively to a deterministic
priority score, sorting higher urgency first:
    score = (base_severity * 25.0) + (people_at_risk * 10.0) + (age_minutes * 1.5) + (30.0 if escalation_indicator else 0.0)

In this baseline implementation, age is subtracted instead of added, and the escalation
indicator is ignored, corrupting the ordering so urgent aging incidents rank below newer ones.
"""

from typing import List
from rescuegrid.models import Incident


def calculate_incident_priority(incident: Incident) -> float:
    """Calculate the deterministic priority score for an incident."""
    # BUGGY BASELINE IMPLEMENTATION:
    # Subtracts age penalty instead of adding urgency, and ignores escalation_indicator!
    score = (incident.base_severity * 25.0) + (incident.people_at_risk * 10.0) - (incident.age_minutes * 3.0)
    return round(score, 1)


def prioritize_incidents(incidents: List[Incident]) -> List[Incident]:
    """Assign priority scores and return incidents sorted by priority score descending."""
    for inc in incidents:
        inc.priority_score = calculate_incident_priority(inc)
    # Sort descending by priority score
    return sorted(incidents, key=lambda inc: (inc.priority_score or 0.0), reverse=True)
