"""Domain models for RescueGrid operations."""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any


@dataclass
class Incident:
    id: str
    title: str
    location: str
    coordinates: Dict[str, int]
    base_severity: int
    people_at_risk: int
    age_minutes: float
    escalation_indicator: bool
    required_skills: List[str]
    required_equipment: List[str]
    required_services: List[str]
    patient_count: int
    status: str = "active"
    priority_score: Optional[float] = None
    assigned_unit_id: Optional[str] = None
    destination_hospital_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Unit:
    id: str
    name: str
    location: str
    coordinates: Dict[str, int]
    skills: List[str]
    equipment: List[str]
    status: str = "available"  # "available", "assigned", "standby"
    assigned_incident_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Hospital:
    id: str
    name: str
    location: str
    coordinates: Dict[str, int]
    services: List[str]
    total_beds: int
    available_beds: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RoadSegment:
    id: str
    from_node: str
    to_node: str
    distance: float
    is_closed: bool = False
    closure_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StandbyUnit:
    id: str
    name: str
    cost: int
    covered_incident_ids: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
