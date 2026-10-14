"""Unit capability eligibility verification logic.

CONTEST BUG #2:
A response unit is eligible for an incident only if it possesses EVERY required skill
AND EVERY required equipment item.

In this baseline implementation, eligibility passes if the unit possesses ANY required
skill, and equipment requirements are completely ignored. This allows units missing
critical extrication or containment equipment to be assigned.
"""

from typing import Dict, Any, List
from rescuegrid.models import Unit, Incident


def is_unit_eligible(unit: Unit, incident: Incident) -> bool:
    """Determine whether a unit is eligible to respond to an incident."""
    # BUGGY BASELINE IMPLEMENTATION:
    # Only checks if the unit matches at least one skill, completely ignoring equipment!
    if not incident.required_skills and not incident.required_equipment:
        return True
    return any(skill in unit.skills for skill in incident.required_skills)


def get_eligibility_breakdown(unit: Unit, incident: Incident) -> Dict[str, Any]:
    """Return detailed capability breakdown for frontend inspection."""
    has_skills = [s for s in incident.required_skills if s in unit.skills]
    missing_skills = [s for s in incident.required_skills if s not in unit.skills]
    has_equipment = [e for e in incident.required_equipment if e in unit.equipment]
    missing_equipment = [e for e in incident.required_equipment if e not in unit.equipment]

    # Eligible per current module logic
    eligible = is_unit_eligible(unit, incident)

    return {
        "unit_id": unit.id,
        "unit_name": unit.name,
        "incident_id": incident.id,
        "is_eligible": eligible,
        "has_skills": has_skills,
        "missing_skills": missing_skills,
        "has_equipment": has_equipment,
        "missing_equipment": missing_equipment,
        "all_skills_met": len(missing_skills) == 0,
        "all_equipment_met": len(missing_equipment) == 0,
        "reason": "Eligible (Meets requirements)" if eligible else "Ineligible (Missing capabilities)"
    }
