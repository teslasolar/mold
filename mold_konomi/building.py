"""
🎲 Building - Zone System
8 zones + central ops

Zones: NE_LOW, NE_HIGH, NW_LOW, NW_HIGH, SE_LOW, SE_HIGH, SW_LOW, SW_HIGH
Performance: 8 zone concurrent analysis
"""

import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import heapq

from .mold_llm import MoldLLM, Severity
from .evgpu import eVGPU
from .unit_array import UnitArray


@dataclass
class PriorityItem:
    """Item in priority queue"""
    priority_score: float
    unit_id: str
    severity: int
    floor: int
    wing: str
    unit: int
    estimated_hours: float
    estimated_cost: float

    def __lt__(self, other):
        # Higher priority = should come first (negate for min heap)
        return self.priority_score > other.priority_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            'priority_score': self.priority_score,
            'unit_id': self.unit_id,
            'severity': self.severity,
            'floor': self.floor,
            'wing': self.wing,
            'unit': self.unit,
            'estimated_hours': self.estimated_hours,
            'estimated_cost': self.estimated_cost
        }


class Building:
    """
    Building zone management system.

    Manages 8 zones (4 wings × 2 levels each) with:
    - Zone-specific MoldLLM instances
    - Central aggregator LLM
    - Priority queue for remediation
    - Concurrent zone analysis
    """

    ZONES = [
        'NE_LOW', 'NE_HIGH',
        'NW_LOW', 'NW_HIGH',
        'SE_LOW', 'SE_HIGH',
        'SW_LOW', 'SW_HIGH'
    ]

    # Zone to wing/floor mapping
    ZONE_MAP = {
        'NE_LOW': ('NE', [0, 1]),
        'NE_HIGH': ('NE', [2, 3]),
        'NW_LOW': ('NW', [0, 1]),
        'NW_HIGH': ('NW', [2, 3]),
        'SE_LOW': ('SE', [0, 1]),
        'SE_HIGH': ('SE', [2, 3]),
        'SW_LOW': ('SW', [0, 1]),
        'SW_HIGH': ('SW', [2, 3]),
    }

    def __init__(self, building_id: str = "building_001"):
        """
        Initialize building with zone LLMs.

        Args:
            building_id: Building identifier
        """
        self.building_id = building_id

        # Zone-specific LLMs
        self.zones: Dict[str, MoldLLM] = {z: MoldLLM() for z in self.ZONES}

        # Central aggregator LLM
        self.central = MoldLLM()

        # eVGPU for calculations
        self.gpu = eVGPU()

        # Unit array for data storage
        self.unit_array = UnitArray(building_id=building_id)

        # Priority queue (heap)
        self.priority_queue: List[PriorityItem] = []

        # Zone status cache
        self._zone_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_time: Optional[str] = None

        # Metadata
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at

    def get_zone_for_unit(self, floor: int, wing: str) -> str:
        """Get zone name for a floor/wing combination"""
        level = 'LOW' if floor < 2 else 'HIGH'
        return f"{wing}_{level}"

    def get_units_in_zone(self, zone: str) -> List[Dict[str, Any]]:
        """Get all units in a zone"""
        if zone not in self.ZONE_MAP:
            raise ValueError(f"Unknown zone: {zone}")

        wing, floors = self.ZONE_MAP[zone]
        units = []

        for floor in floors:
            for u in range(self.unit_array.units_per):
                units.append(self.unit_array.get_unit(floor, wing, u))

        return units

    def scan_unit(self, floor: int, wing: str, unit: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Scan/assess a single unit.

        Args:
            floor: Floor number
            wing: Wing name
            unit: Unit number
            data: Assessment data

        Returns:
            Assessment result
        """
        # Perform assessment
        result = self.unit_array.assess(floor, wing, unit, data)

        # Update priority queue if affected
        if result['severity'] > 0:
            self._add_to_priority_queue(result)

        # Invalidate zone cache
        zone = self.get_zone_for_unit(floor, wing)
        self._zone_cache.pop(zone, None)

        self.updated_at = datetime.now().isoformat()
        return result

    def update_severity(
        self,
        unit_id: str,
        level: int,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update severity for a unit by ID.

        Args:
            unit_id: Unit ID (e.g., "2-NE-5")
            level: New severity level
            notes: Optional notes

        Returns:
            Updated assessment
        """
        # Parse unit_id
        parts = unit_id.split('-')
        floor = int(parts[0])
        wing = parts[1]
        unit = int(parts[2])

        updates = {'severity': level}
        if notes:
            updates['notes'] = notes

        result = self.unit_array.update(floor, wing, unit, updates)

        # Update priority queue
        self._rebuild_priority_queue()

        # Invalidate zone cache
        zone = self.get_zone_for_unit(floor, wing)
        self._zone_cache.pop(zone, None)

        self.updated_at = datetime.now().isoformat()
        return result

    def _add_to_priority_queue(self, unit_data: Dict[str, Any]) -> None:
        """Add unit to priority queue"""
        item = PriorityItem(
            priority_score=unit_data['priority_score'],
            unit_id=unit_data['unit_id'],
            severity=unit_data['severity'],
            floor=unit_data['floor'],
            wing=unit_data['wing'],
            unit=unit_data['unit'],
            estimated_hours=unit_data['estimated_hours'],
            estimated_cost=unit_data['estimated_cost']
        )
        heapq.heappush(self.priority_queue, item)

    def _rebuild_priority_queue(self) -> None:
        """Rebuild priority queue from current data"""
        self.priority_queue = []
        affected = self.unit_array.get_affected_units(min_severity=1)
        for unit in affected:
            self._add_to_priority_queue(unit)

    def get_priority_list(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get priority-ranked list of units needing remediation.

        Args:
            limit: Optional limit on results

        Returns:
            List of units sorted by priority
        """
        # Ensure queue is current
        if not self.priority_queue:
            self._rebuild_priority_queue()

        # Sort by priority (heap gives us sorted order)
        sorted_items = sorted(self.priority_queue)

        if limit:
            sorted_items = sorted_items[:limit]

        return [item.to_dict() for item in sorted_items]

    async def get_zone_status(self, zone: str) -> Dict[str, Any]:
        """
        Get status summary for a zone.

        Args:
            zone: Zone name

        Returns:
            Zone status summary
        """
        if zone not in self.ZONES:
            raise ValueError(f"Unknown zone: {zone}")

        # Check cache
        if zone in self._zone_cache:
            return self._zone_cache[zone]

        # Get zone units
        units = self.get_units_in_zone(zone)

        # Use zone LLM for assessment aggregation
        zone_llm = self.zones[zone]
        assessments = []

        for unit in units:
            assessment = await zone_llm.assess(unit)
            assessments.append(assessment)

        # Aggregate
        aggregation = zone_llm.aggregate_zone_assessment(assessments)

        # Calculate costs with eVGPU
        gpu_stats = self.gpu.zone_aggregate(units)

        status = {
            'zone': zone,
            'wing': self.ZONE_MAP[zone][0],
            'floors': self.ZONE_MAP[zone][1],
            **aggregation,
            'total_estimated_cost': gpu_stats['total_estimated_cost'],
            'total_estimated_hours': gpu_stats['total_estimated_hours'],
            'updated_at': datetime.now().isoformat()
        }

        # Cache result
        self._zone_cache[zone] = status

        return status

    async def get_all_zone_statuses(self) -> Dict[str, Dict[str, Any]]:
        """Get status for all zones concurrently"""
        tasks = [self.get_zone_status(zone) for zone in self.ZONES]
        results = await asyncio.gather(*tasks)
        return {zone: result for zone, result in zip(self.ZONES, results)}

    async def get_building_summary(self) -> Dict[str, Any]:
        """Get building-wide summary"""
        # Get all zone statuses
        zone_statuses = await self.get_all_zone_statuses()

        # Get overall statistics
        stats = self.unit_array.get_statistics()

        # Use central LLM for building-level assessment
        all_units = self.unit_array.get_affected_units(min_severity=1)
        all_assessments = []
        for unit in all_units:
            assessment = await self.central.assess(unit)
            all_assessments.append(assessment)

        central_summary = self.central.aggregate_zone_assessment(all_assessments)

        return {
            'building_id': self.building_id,
            'summary': stats,
            'zone_breakdown': zone_statuses,
            'central_assessment': central_summary,
            'priority_queue_size': len(self.priority_queue),
            'top_priorities': self.get_priority_list(limit=10),
            'updated_at': datetime.now().isoformat()
        }

    def generate_zone_report(self, zone: str) -> Dict[str, Any]:
        """
        Generate detailed report for a zone.

        Args:
            zone: Zone name

        Returns:
            Detailed zone report
        """
        if zone not in self.ZONES:
            raise ValueError(f"Unknown zone: {zone}")

        units = self.get_units_in_zone(zone)
        affected = [u for u in units if u['severity'] > 0]

        return {
            'zone': zone,
            'report_date': datetime.now().isoformat(),
            'total_units': len(units),
            'affected_units': len(affected),
            'severity_breakdown': {
                'NONE': len([u for u in units if u['severity'] == 0]),
                'MINOR': len([u for u in units if u['severity'] == 1]),
                'MODERATE': len([u for u in units if u['severity'] == 2]),
                'SEVERE': len([u for u in units if u['severity'] == 3]),
                'CRITICAL': len([u for u in units if u['severity'] == 4]),
            },
            'units_needing_action': sorted(
                affected,
                key=lambda x: x['priority_score'],
                reverse=True
            ),
            'total_cost': sum(u['estimated_cost'] for u in affected),
            'total_hours': sum(u['estimated_hours'] for u in affected),
            'materials_needed': self._aggregate_materials(affected)
        }

    def _aggregate_materials(self, units: List[Dict[str, Any]]) -> Dict[str, int]:
        """Aggregate materials needed for list of units"""
        materials = {}

        for unit in units:
            severity = unit['severity']
            action = self.central.ACTIONS[Severity(severity)]

            for material in action.materials:
                materials[material] = materials.get(material, 0) + 1

        return materials

    def generate_materials_report(self) -> Dict[str, Any]:
        """Generate materials list for all affected units"""
        affected = self.unit_array.get_affected_units(min_severity=1)
        materials = self._aggregate_materials(affected)

        # Group by severity
        by_severity = {
            'MINOR': [],
            'MODERATE': [],
            'SEVERE': [],
            'CRITICAL': []
        }

        for unit in affected:
            severity_name = MoldLLM.SEVERITY[unit['severity']]
            if severity_name in by_severity:
                by_severity[severity_name].append(unit['unit_id'])

        return {
            'report_date': datetime.now().isoformat(),
            'building_id': self.building_id,
            'total_affected_units': len(affected),
            'materials_summary': materials,
            'units_by_severity': by_severity,
            'estimated_total_cost': sum(u['estimated_cost'] for u in affected)
        }

    async def generate_schedule(
        self,
        crew_size: int = 3,
        days: int = 20,
        hours_per_day: float = 8.0
    ) -> Dict[str, Any]:
        """
        Generate remediation schedule.

        Args:
            crew_size: Number of crew members
            days: Available days
            hours_per_day: Working hours per day

        Returns:
            Day-by-day schedule
        """
        affected = self.unit_array.get_affected_units(min_severity=1)

        # Use eVGPU for optimization
        schedule = self.gpu.schedule_optimize(affected, crew_size, hours_per_day)

        # Group by day
        by_day: Dict[int, List[Dict[str, Any]]] = {}
        for item in schedule:
            day = item['day']
            if day not in by_day:
                by_day[day] = []
            by_day[day].append(item)

        total_days = max(by_day.keys()) if by_day else 0

        return {
            'schedule_date': datetime.now().isoformat(),
            'building_id': self.building_id,
            'parameters': {
                'crew_size': crew_size,
                'available_days': days,
                'hours_per_day': hours_per_day
            },
            'total_units': len(affected),
            'estimated_days': total_days,
            'fits_timeline': total_days <= days,
            'daily_schedule': [
                {
                    'day': d,
                    'units': by_day.get(d, []),
                    'total_hours': sum(u['estimated_hours'] for u in by_day.get(d, [])),
                    'total_cost': sum(u['estimated_cost'] for u in by_day.get(d, []))
                }
                for d in range(1, total_days + 1)
            ],
            'totals': {
                'hours': sum(u['estimated_hours'] for u in schedule),
                'cost': sum(u['estimated_cost'] for u in schedule)
            }
        }

    def generate_executive_report(self) -> Dict[str, Any]:
        """Generate high-level executive summary"""
        stats = self.unit_array.get_statistics()
        priority_list = self.get_priority_list(limit=5)

        critical_count = stats['severity_distribution']['CRITICAL']
        severe_count = stats['severity_distribution']['SEVERE']

        # Risk level assessment
        if critical_count > 0:
            risk_level = 'CRITICAL'
            risk_description = f'{critical_count} units require immediate action'
        elif severe_count > 5:
            risk_level = 'HIGH'
            risk_description = f'{severe_count} units need urgent remediation'
        elif stats['affected_units'] > stats['total_units'] * 0.2:
            risk_level = 'ELEVATED'
            risk_description = f'{stats["affected_units"]} units affected ({round(stats["affected_units"]/stats["total_units"]*100)}%)'
        else:
            risk_level = 'MODERATE'
            risk_description = 'Situation under control'

        return {
            'report_date': datetime.now().isoformat(),
            'building_id': self.building_id,
            'risk_level': risk_level,
            'risk_description': risk_description,
            'key_metrics': {
                'total_units': stats['total_units'],
                'affected_units': stats['affected_units'],
                'critical_units': critical_count,
                'severe_units': severe_count,
                'estimated_total_cost': stats['total_estimated_cost'],
                'estimated_total_hours': stats['total_estimated_hours']
            },
            'top_priorities': priority_list,
            'recommendation': self._generate_recommendation(stats)
        }

    def _generate_recommendation(self, stats: Dict[str, Any]) -> str:
        """Generate recommendation based on statistics"""
        critical = stats['severity_distribution']['CRITICAL']
        severe = stats['severity_distribution']['SEVERE']

        if critical > 0:
            return f"IMMEDIATE ACTION REQUIRED: {critical} critical units need emergency remediation. Consider temporary relocation for affected residents."
        elif severe > 5:
            return f"URGENT: Schedule remediation crew immediately. {severe} units with severe mold require material removal within 48 hours."
        elif stats['affected_units'] > 20:
            return f"HIGH PRIORITY: {stats['affected_units']} affected units identified. Recommend full remediation schedule within 2 weeks."
        else:
            return "ROUTINE: Continue monitoring and address affected units according to priority queue."
