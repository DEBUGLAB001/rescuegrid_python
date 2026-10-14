"""Deterministic fixture data for RescueGrid control room operations."""

from typing import List, Dict, Any
from rescuegrid.models import Incident, Unit, Hospital, RoadSegment, StandbyUnit


def get_city_metadata() -> Dict[str, str]:
    return {
        "city_name": "Aethelgard Metro",
        "jurisdiction": "Central Operations Command",
        "operating_status": "DEFCON 2 - ACTIVE MONITORING",
        "emergency_level": "Level 3 Multi-Agency Incident"
    }


def get_initial_incidents() -> List[Incident]:
    return [
        Incident(
            id="INC-101",
            title="Industrial Chemical Spill & Structural Breach",
            location="West End",
            coordinates={"x": 90, "y": 130},
            base_severity=5,
            people_at_risk=12,
            age_minutes=24.0,
            escalation_indicator=True,
            required_skills=["hazmat", "heavy_extrication"],
            required_equipment=["hazmat_containment", "hydraulic_spreader"],
            required_services=["trauma_center", "burn_unit"],
            patient_count=5,
            status="active"
        ),
        Incident(
            id="INC-102",
            title="Subway Concourse Ceiling Collapse",
            location="Central Plaza",
            coordinates={"x": 360, "y": 320},
            base_severity=4,
            people_at_risk=8,
            age_minutes=10.0,
            escalation_indicator=False,
            required_skills=["heavy_extrication"],
            required_equipment=["hydraulic_spreader"],
            required_services=["trauma_center"],
            patient_count=3,
            status="active"
        ),
        Incident(
            id="INC-103",
            title="Multi-Story Residential Complex Fire",
            location="North District",
            coordinates={"x": 570, "y": 70},
            base_severity=3,
            people_at_risk=15,
            age_minutes=5.0,
            escalation_indicator=True,
            required_skills=["fire_suppression", "paramedic"],
            required_equipment=["thermal_imager"],
            required_services=["general_emergency"],
            patient_count=2,
            status="active"
        ),
        Incident(
            id="INC-104",
            title="Expressway Transit Van Rollover",
            location="Eastside Industrial",
            coordinates={"x": 840, "y": 90},
            base_severity=2,
            people_at_risk=3,
            age_minutes=18.0,
            escalation_indicator=False,
            required_skills=["paramedic"],
            required_equipment=["first_aid_kit"],
            required_services=["general_emergency"],
            patient_count=1,
            status="active"
        ),
        Incident(
            id="INC-105",
            title="Substation Transformer Smoke Cleared",
            location="Harbor Medical",
            coordinates={"x": 580, "y": 400},
            base_severity=1,
            people_at_risk=0,
            age_minutes=65.0,
            escalation_indicator=False,
            required_skills=["fire_suppression"],
            required_equipment=["thermal_imager"],
            required_services=["general_emergency"],
            patient_count=0,
            status="completed",
            assigned_unit_id="U-04",
            destination_hospital_id="H-01"
        )
    ]


def get_initial_units() -> List[Unit]:
    return [
        Unit(
            id="U-01",
            name="Rescue Task Force 1",
            location="Central Plaza",
            coordinates={"x": 460, "y": 180},
            skills=["hazmat", "heavy_extrication", "fire_suppression", "paramedic"],
            equipment=["hazmat_containment", "hydraulic_spreader", "thermal_imager", "first_aid_kit"],
            status="available"
        ),
        Unit(
            id="U-02",
            name="Hazmat Engine 7",
            location="West End",
            coordinates={"x": 90, "y": 270},
            skills=["hazmat", "fire_suppression"],
            equipment=["hazmat_containment"],
            status="available"
        ),
        Unit(
            id="U-03",
            name="Rescue Ladder 4",
            location="Central Plaza",
            coordinates={"x": 550, "y": 280},
            skills=["heavy_extrication", "paramedic"],
            equipment=["hydraulic_spreader", "first_aid_kit"],
            status="available"
        ),
        Unit(
            id="U-04",
            name="Medic Ambulance 12",
            location="North District",
            coordinates={"x": 360, "y": 70},
            skills=["fire_suppression", "paramedic"],
            equipment=["thermal_imager", "first_aid_kit"],
            status="available"
        )
    ]


def get_initial_hospitals() -> List[Hospital]:
    return [
        Hospital(
            id="H-01",
            name="West End Urgent Care Clinic",
            location="West End",
            coordinates={"x": 230, "y": 260},
            services=["general_emergency"],
            total_beds=10,
            available_beds=2
        ),
        Hospital(
            id="H-02",
            name="Mercy General Medical Center",
            location="Central Plaza",
            coordinates={"x": 460, "y": 350},
            services=["trauma_center", "general_emergency"],
            total_beds=40,
            available_beds=8
        ),
        Hospital(
            id="H-03",
            name="St. Jude Regional Trauma & Burn Center",
            location="Harbor Medical",
            coordinates={"x": 780, "y": 370},
            services=["trauma_center", "burn_unit", "general_emergency"],
            total_beds=50,
            available_beds=15
        )
    ]


def get_initial_road_segments() -> List[RoadSegment]:
    return [
        RoadSegment(
            id="SEG-WC",
            from_node="West End",
            to_node="Central Plaza",
            distance=4.0,
            is_closed=True,
            closure_reason="Hazardous chemical containment perimeter closed"
        ),
        RoadSegment(
            id="SEG-WN",
            from_node="West End",
            to_node="North District",
            distance=3.0,
            is_closed=False
        ),
        RoadSegment(
            id="SEG-NC",
            from_node="North District",
            to_node="Central Plaza",
            distance=3.5,
            is_closed=False
        ),
        RoadSegment(
            id="SEG-CE",
            from_node="Central Plaza",
            to_node="Eastside Industrial",
            distance=4.5,
            is_closed=False
        ),
        RoadSegment(
            id="SEG-CH",
            from_node="Central Plaza",
            to_node="Harbor Medical",
            distance=5.0,
            is_closed=False
        ),
        RoadSegment(
            id="SEG-EH",
            from_node="Eastside Industrial",
            to_node="Harbor Medical",
            distance=3.0,
            is_closed=False
        )
    ]


def get_node_coordinates() -> Dict[str, Dict[str, int]]:
    return {
        "West End": {"x": 160, "y": 210},
        "North District": {"x": 460, "y": 80},
        "Central Plaza": {"x": 460, "y": 250},
        "Eastside Industrial": {"x": 780, "y": 140},
        "Harbor Medical": {"x": 680, "y": 370}
    }


def get_standby_budget() -> int:
    return 10


def get_standby_incidents() -> Dict[str, Dict[str, Any]]:
    return {
        "COV-1": {"title": "West Grid Chemical Vulnerability", "priority": 50},
        "COV-2": {"title": "Central Transit Junction Risk", "priority": 50},
        "COV-3": {"title": "North Substation Power Failure Risk", "priority": 50},
        "COV-4": {"title": "Harbor Fuel Depot Evacuation Risk", "priority": 50}
    }


def get_standby_units() -> List[StandbyUnit]:
    return [
        StandbyUnit(
            id="ST-1",
            name="Tactical Hazmat Tender",
            cost=7,
            covered_incident_ids=["COV-1", "COV-2", "COV-3"]
        ),
        StandbyUnit(
            id="ST-2",
            name="Rapid Rescue Squad Alpha",
            cost=5,
            covered_incident_ids=["COV-1", "COV-2"]
        ),
        StandbyUnit(
            id="ST-3",
            name="Rapid Rescue Squad Bravo",
            cost=5,
            covered_incident_ids=["COV-3", "COV-4"]
        ),
        StandbyUnit(
            id="ST-4",
            name="Auxiliary Medical Van",
            cost=4,
            covered_incident_ids=["COV-4"]
        )
    ]
