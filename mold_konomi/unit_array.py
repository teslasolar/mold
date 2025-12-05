"""
🧊 UnitArray - 176-Unit Grid System
3D building grid: floor × wing × unit

Sparse storage for efficient memory usage.
Performance: 176 units with instant access.
"""

import numpy as np
from typing import Dict, Any, List, Tuple, Optional, Iterator
from dataclasses import dataclass, field
from datetime import datetime
import json

from .mold_llm import MoldLLM, Severity
from .evgpu import eVGPU


@dataclass
class UnitAssessment:
    """Complete unit assessment data"""
    unit_id: str
    floor: int
    wing: str
    unit: int
    sqft: float = 450.0
    severity: int = 0
    moisture_level: float = 0.0
    surfaces: List[str] = field(default_factory=list)
    source: str = "none"
    photos: List[str] = field(default_factory=list)
    priority_score: float = 0.0
    estimated_cost: float = 0.0
    estimated_hours: float = 0.0
    assessed_at: Optional[str] = None
    assessed_by: Optional[str] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            'unit_id': self.unit_id,
            'floor': self.floor,
            'wing': self.wing,
            'unit': self.unit,
            'sqft': self.sqft,
            'severity': self.severity,
            'moisture_level': self.moisture_level,
            'surfaces': self.surfaces,
            'source': self.source,
            'photos': self.photos,
            'priority_score': self.priority_score,
            'estimated_cost': self.estimated_cost,
            'estimated_hours': self.estimated_hours,
            'assessed_at': self.assessed_at,
            'assessed_by': self.assessed_by,
            'notes': self.notes
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UnitAssessment':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class UnitArray:
    """
    3D building grid for mold assessment tracking.

    Structure: floors × wings × units_per_wing
    Default: 4 × 4 × 11 = 176 units

    Wings mapped to indices:
    - NE=0, NW=1, SE=2, SW=3
    """

    # Wing name to index mapping
    WING_MAP = {'NE': 0, 'NW': 1, 'SE': 2, 'SW': 3}
    WING_NAMES = ['NE', 'NW', 'SE', 'SW']

    def __init__(
        self,
        floors: int = 4,
        wings: int = 4,
        units_per: int = 11,
        building_id: str = "building_001"
    ):
        """
        Initialize unit array.

        Args:
            floors: Number of floors (default 4)
            wings: Number of wings (default 4)
            units_per: Units per wing per floor (default 11)
            building_id: Building identifier
        """
        self.floors = floors
        self.wings = wings
        self.units_per = units_per
        self.building_id = building_id
        self.total_units = floors * wings * units_per

        # 3D severity array: floor × wing × unit
        self.arr = np.zeros((floors, wings, units_per), dtype=np.int8)

        # 3D moisture array
        self.moisture_arr = np.zeros((floors, wings, units_per), dtype=np.float32)

        # Sparse storage for full assessment data
        self.data: Dict[Tuple[int, int, int], UnitAssessment] = {}

        # Per-coordinate MoldLLM instances
        self.llms: Dict[Tuple[int, int, int], MoldLLM] = {}

        # Shared eVGPU instance
        self.gpu = eVGPU()

        # Global MoldLLM for new assessments
        self._global_llm = MoldLLM()

        # Metadata
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at

    def _make_unit_id(self, floor: int, wing: int, unit: int) -> str:
        """Generate unit ID string"""
        wing_name = self.WING_NAMES[wing] if isinstance(wing, int) else wing
        return f"{floor}-{wing_name}-{unit}"

    def _wing_to_index(self, wing) -> int:
        """Convert wing name or index to index"""
        if isinstance(wing, int):
            return wing
        return self.WING_MAP.get(wing.upper(), 0)

    def _validate_coords(self, floor: int, wing: int, unit: int) -> Tuple[int, int, int]:
        """Validate and normalize coordinates"""
        wing_idx = self._wing_to_index(wing)

        if not (0 <= floor < self.floors):
            raise ValueError(f"Floor {floor} out of range [0, {self.floors})")
        if not (0 <= wing_idx < self.wings):
            raise ValueError(f"Wing {wing} out of range")
        if not (0 <= unit < self.units_per):
            raise ValueError(f"Unit {unit} out of range [0, {self.units_per})")

        return floor, wing_idx, unit

    def set_severity(self, floor: int, wing, unit: int, level: int) -> None:
        """Set severity level for a unit"""
        f, w, u = self._validate_coords(floor, wing, unit)
        self.arr[f, w, u] = min(max(level, 0), 4)
        self.updated_at = datetime.now().isoformat()

    def get_severity(self, floor: int, wing, unit: int) -> int:
        """Get severity level for a unit"""
        f, w, u = self._validate_coords(floor, wing, unit)
        return int(self.arr[f, w, u])

    def set_moisture(self, floor: int, wing, unit: int, level: float) -> None:
        """Set moisture level for a unit"""
        f, w, u = self._validate_coords(floor, wing, unit)
        self.moisture_arr[f, w, u] = min(max(level, 0.0), 1.0)
        self.updated_at = datetime.now().isoformat()

    def get_moisture(self, floor: int, wing, unit: int) -> float:
        """Get moisture level for a unit"""
        f, w, u = self._validate_coords(floor, wing, unit)
        return float(self.moisture_arr[f, w, u])

    def get_unit(self, floor: int, wing, unit: int) -> Dict[str, Any]:
        """Get full unit data"""
        f, w, u = self._validate_coords(floor, wing, unit)
        key = (f, w, u)

        if key in self.data:
            return self.data[key].to_dict()

        # Return basic data from arrays
        return {
            'unit_id': self._make_unit_id(floor, wing, unit),
            'floor': f,
            'wing': self.WING_NAMES[w],
            'unit': u,
            'severity': int(self.arr[f, w, u]),
            'moisture_level': float(self.moisture_arr[f, w, u]),
            'sqft': 450.0,
            'surfaces': [],
            'source': 'none',
            'photos': [],
            'priority_score': 0.0,
            'estimated_cost': 0.0,
            'estimated_hours': 0.0
        }

    def assess(
        self,
        floor: int,
        wing,
        unit: int,
        data: Dict[str, Any],
        assessor: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log assessment from field.

        Args:
            floor: Floor number
            wing: Wing name or index
            unit: Unit number
            data: Assessment data dict
            assessor: Who performed assessment

        Returns:
            Complete assessment with calculated fields
        """
        f, w, u = self._validate_coords(floor, wing, unit)
        key = (f, w, u)

        # Get or create LLM for this unit
        if key not in self.llms:
            self.llms[key] = MoldLLM()

        llm = self.llms[key]

        # Calculate severity if not provided
        severity = data.get('severity')
        if severity is None:
            severity = llm.calc_severity(data)

        # Update arrays
        self.arr[f, w, u] = severity
        moisture = data.get('moisture_level', data.get('moisture', 0))
        self.moisture_arr[f, w, u] = moisture

        # Calculate priority and costs
        sqft = data.get('sqft_affected', data.get('sqft', 450))
        priority = self.gpu.priority_score(severity, sqft, moisture)
        cost = self.gpu.cost_estimate(severity, sqft)
        hours = self.gpu.estimate_hours(severity, sqft)

        # Create assessment record
        assessment = UnitAssessment(
            unit_id=self._make_unit_id(floor, wing, unit),
            floor=f,
            wing=self.WING_NAMES[w],
            unit=u,
            sqft=sqft,
            severity=severity,
            moisture_level=moisture,
            surfaces=data.get('surfaces', [data.get('surface', '')]) if data.get('surface') or data.get('surfaces') else [],
            source=data.get('source', 'none'),
            photos=data.get('photos', []),
            priority_score=round(priority, 4),
            estimated_cost=round(cost, 2),
            estimated_hours=round(hours, 1),
            assessed_at=datetime.now().isoformat(),
            assessed_by=assessor,
            notes=data.get('notes', '')
        )

        self.data[key] = assessment
        self.updated_at = datetime.now().isoformat()

        return assessment.to_dict()

    def update(self, floor: int, wing, unit: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing assessment"""
        f, w, u = self._validate_coords(floor, wing, unit)
        key = (f, w, u)

        current = self.data.get(key)
        if current is None:
            # Create new if doesn't exist
            return self.assess(floor, wing, unit, updates)

        # Update fields
        current_dict = current.to_dict()
        current_dict.update(updates)

        # Recalculate derived fields
        severity = current_dict.get('severity', 0)
        sqft = current_dict.get('sqft', 450)
        moisture = current_dict.get('moisture_level', 0)

        current_dict['priority_score'] = round(
            self.gpu.priority_score(severity, sqft, moisture), 4
        )
        current_dict['estimated_cost'] = round(
            self.gpu.cost_estimate(severity, sqft), 2
        )
        current_dict['estimated_hours'] = round(
            self.gpu.estimate_hours(severity, sqft), 1
        )

        # Update arrays
        self.arr[f, w, u] = severity
        self.moisture_arr[f, w, u] = moisture

        # Store updated assessment
        self.data[key] = UnitAssessment.from_dict(current_dict)
        self.updated_at = datetime.now().isoformat()

        return self.data[key].to_dict()

    def get_all_units(self) -> List[Dict[str, Any]]:
        """Get all units with data"""
        units = []
        for f in range(self.floors):
            for w in range(self.wings):
                for u in range(self.units_per):
                    units.append(self.get_unit(f, w, u))
        return units

    def get_affected_units(self, min_severity: int = 1) -> List[Dict[str, Any]]:
        """Get units with severity >= min_severity"""
        affected = []
        for f in range(self.floors):
            for w in range(self.wings):
                for u in range(self.units_per):
                    if self.arr[f, w, u] >= min_severity:
                        affected.append(self.get_unit(f, w, u))
        return affected

    def get_floor_units(self, floor: int) -> List[Dict[str, Any]]:
        """Get all units on a floor"""
        units = []
        for w in range(self.wings):
            for u in range(self.units_per):
                units.append(self.get_unit(floor, w, u))
        return units

    def get_wing_units(self, wing) -> List[Dict[str, Any]]:
        """Get all units in a wing"""
        w = self._wing_to_index(wing)
        units = []
        for f in range(self.floors):
            for u in range(self.units_per):
                units.append(self.get_unit(f, w, u))
        return units

    def get_priority_queue(self) -> List[Dict[str, Any]]:
        """Get units sorted by priority (highest first)"""
        affected = self.get_affected_units(min_severity=1)
        return sorted(affected, key=lambda x: x['priority_score'], reverse=True)

    def get_heatmap(self) -> Dict[str, Any]:
        """
        Get severity heatmap data for visualization.

        Returns:
            Heatmap data by floor and zone
        """
        heatmap = {
            'building_id': self.building_id,
            'floors': self.floors,
            'wings': self.WING_NAMES[:self.wings],
            'units_per_wing': self.units_per,
            'severity_matrix': self.arr.tolist(),
            'moisture_matrix': self.moisture_arr.tolist(),
            'floor_summaries': [],
            'zone_summaries': {}
        }

        # Floor summaries
        for f in range(self.floors):
            floor_data = self.arr[f]
            heatmap['floor_summaries'].append({
                'floor': f,
                'total_units': self.wings * self.units_per,
                'affected_units': int(np.sum(floor_data > 0)),
                'avg_severity': float(np.mean(floor_data)),
                'max_severity': int(np.max(floor_data)),
                'critical_count': int(np.sum(floor_data >= 4)),
                'severe_count': int(np.sum(floor_data >= 3))
            })

        # Zone summaries (wing + floor level: LOW=0-1, HIGH=2-3)
        for w, wing_name in enumerate(self.WING_NAMES[:self.wings]):
            for level in ['LOW', 'HIGH']:
                floors_range = range(0, 2) if level == 'LOW' else range(2, self.floors)
                zone_name = f"{wing_name}_{level}"

                zone_data = self.arr[list(floors_range), w, :]
                heatmap['zone_summaries'][zone_name] = {
                    'zone': zone_name,
                    'total_units': len(floors_range) * self.units_per,
                    'affected_units': int(np.sum(zone_data > 0)),
                    'avg_severity': float(np.mean(zone_data)),
                    'max_severity': int(np.max(zone_data))
                }

        return heatmap

    def get_statistics(self) -> Dict[str, Any]:
        """Get overall building statistics"""
        all_severities = self.arr.flatten()
        all_moisture = self.moisture_arr.flatten()

        total_cost = 0
        total_hours = 0
        for assessment in self.data.values():
            total_cost += assessment.estimated_cost
            total_hours += assessment.estimated_hours

        return {
            'building_id': self.building_id,
            'total_units': self.total_units,
            'assessed_units': len(self.data),
            'affected_units': int(np.sum(all_severities > 0)),
            'severity_distribution': {
                'NONE': int(np.sum(all_severities == 0)),
                'MINOR': int(np.sum(all_severities == 1)),
                'MODERATE': int(np.sum(all_severities == 2)),
                'SEVERE': int(np.sum(all_severities == 3)),
                'CRITICAL': int(np.sum(all_severities == 4))
            },
            'avg_severity': float(np.mean(all_severities)),
            'max_severity': int(np.max(all_severities)),
            'avg_moisture': float(np.mean(all_moisture)),
            'max_moisture': float(np.max(all_moisture)),
            'total_estimated_cost': round(total_cost, 2),
            'total_estimated_hours': round(total_hours, 1),
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def to_json(self) -> str:
        """Serialize to JSON"""
        return json.dumps({
            'building_id': self.building_id,
            'dimensions': [self.floors, self.wings, self.units_per],
            'severity_array': self.arr.tolist(),
            'moisture_array': self.moisture_arr.tolist(),
            'assessments': {
                f"{k[0]}-{k[1]}-{k[2]}": v.to_dict()
                for k, v in self.data.items()
            },
            'created_at': self.created_at,
            'updated_at': self.updated_at
        })

    @classmethod
    def from_json(cls, json_str: str) -> 'UnitArray':
        """Deserialize from JSON"""
        data = json.loads(json_str)
        dims = data['dimensions']

        ua = cls(
            floors=dims[0],
            wings=dims[1],
            units_per=dims[2],
            building_id=data['building_id']
        )

        ua.arr = np.array(data['severity_array'], dtype=np.int8)
        ua.moisture_array = np.array(data['moisture_array'], dtype=np.float32)
        ua.created_at = data.get('created_at', ua.created_at)
        ua.updated_at = data.get('updated_at', ua.updated_at)

        for key_str, assessment_data in data.get('assessments', {}).items():
            parts = key_str.split('-')
            key = (int(parts[0]), int(parts[1]), int(parts[2]))
            ua.data[key] = UnitAssessment.from_dict(assessment_data)

        return ua
