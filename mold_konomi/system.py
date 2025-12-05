"""
🦠 MoldKonomiSystem - Main Orchestrator
Turn chaos into checklist. Data in, plan out.

Quick Start:
    import asyncio
    from mold_konomi import MoldKonomiSystem

    async def main():
        M = MoldKonomiSystem()
        UA = M.create_unit_array("student_housing", (4,4,11))
        UA.assess(2, 1, 5, {"severity": 3, "sqft_affected": 120, "moisture": 0.8})
        queue = M.get_priority_queue()
        schedule = await M.generate_schedule(crew_size=3, days=20)
        return M

    asyncio.run(main())
"""

import asyncio
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

from .evgpu import eVGPU
from .mold_llm import MoldLLM
from .unit_array import UnitArray
from .building import Building


class MoldKonomiSystem:
    """
    Main orchestrator for Mold Konomi System.

    Manages multiple buildings with:
    - Unit arrays (176 units each)
    - Zone management (8 zones per building)
    - Priority queues
    - Schedule generation
    - Report generation
    """

    def __init__(self):
        """Initialize Mold Konomi System"""
        self.buildings: Dict[str, Building] = {}
        self.gpu = eVGPU()
        self.created_at = datetime.now().isoformat()

        # Active building (for convenience methods)
        self._active_building: Optional[str] = None

    def create_building(self, building_id: str) -> Building:
        """
        Create a new building.

        Args:
            building_id: Unique building identifier

        Returns:
            Building instance
        """
        building = Building(building_id=building_id)
        self.buildings[building_id] = building
        self._active_building = building_id
        return building

    def create_unit_array(
        self,
        building_id: str,
        dimensions: Tuple[int, int, int] = (4, 4, 11)
    ) -> UnitArray:
        """
        Create 176-unit array for a building.

        Args:
            building_id: Building identifier
            dimensions: (floors, wings, units_per_wing) tuple

        Returns:
            UnitArray instance
        """
        if building_id not in self.buildings:
            self.create_building(building_id)

        building = self.buildings[building_id]
        building.unit_array = UnitArray(
            floors=dimensions[0],
            wings=dimensions[1],
            units_per=dimensions[2],
            building_id=building_id
        )

        return building.unit_array

    def get_building(self, building_id: Optional[str] = None) -> Building:
        """Get building by ID or active building"""
        bid = building_id or self._active_building
        if not bid or bid not in self.buildings:
            raise ValueError(f"Building not found: {bid}")
        return self.buildings[bid]

    def get_unit_array(self, building_id: Optional[str] = None) -> UnitArray:
        """Get unit array for building"""
        return self.get_building(building_id).unit_array

    # Convenience methods that delegate to active building

    def assess(
        self,
        floor: int,
        wing,
        unit: int,
        data: Dict[str, Any],
        building_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Assess a unit.

        Args:
            floor: Floor number
            wing: Wing name or index
            unit: Unit number
            data: Assessment data
            building_id: Optional building ID

        Returns:
            Assessment result
        """
        building = self.get_building(building_id)
        return building.scan_unit(floor, wing, unit, data)

    def get_priority_queue(self, building_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get priority queue for building"""
        return self.get_building(building_id).get_priority_list()

    async def generate_schedule(
        self,
        crew_size: int = 3,
        days: int = 20,
        hours_per_day: float = 8.0,
        building_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate remediation schedule.

        Args:
            crew_size: Number of crew members
            days: Available days
            hours_per_day: Working hours per day
            building_id: Optional building ID

        Returns:
            Schedule data
        """
        building = self.get_building(building_id)
        return await building.generate_schedule(crew_size, days, hours_per_day)

    def get_heatmap(self, building_id: Optional[str] = None) -> Dict[str, Any]:
        """Get severity heatmap for building"""
        return self.get_unit_array(building_id).get_heatmap()

    def get_statistics(self, building_id: Optional[str] = None) -> Dict[str, Any]:
        """Get statistics for building"""
        return self.get_unit_array(building_id).get_statistics()

    async def get_zone_status(
        self,
        zone: str,
        building_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get status for a zone"""
        return await self.get_building(building_id).get_zone_status(zone)

    # Report generation

    def get_executive_report(self, building_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate executive summary"""
        return self.get_building(building_id).generate_executive_report()

    def get_zone_report(
        self,
        zone: str,
        building_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate zone report"""
        return self.get_building(building_id).generate_zone_report(zone)

    def get_materials_report(self, building_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate materials report"""
        return self.get_building(building_id).generate_materials_report()

    async def get_schedule_report(
        self,
        crew_size: int = 3,
        days: int = 20,
        building_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate schedule report"""
        return await self.generate_schedule(crew_size, days, building_id=building_id)

    # Bulk operations

    def bulk_assess(
        self,
        assessments: List[Dict[str, Any]],
        building_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Bulk assess multiple units.

        Args:
            assessments: List of assessment dicts with floor, wing, unit, data
            building_id: Optional building ID

        Returns:
            List of assessment results
        """
        results = []
        building = self.get_building(building_id)

        for a in assessments:
            result = building.scan_unit(
                floor=a['floor'],
                wing=a['wing'],
                unit=a['unit'],
                data=a.get('data', a)
            )
            results.append(result)

        return results

    async def full_building_scan(self, building_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get complete building analysis.

        Args:
            building_id: Optional building ID

        Returns:
            Complete building analysis
        """
        building = self.get_building(building_id)
        return await building.get_building_summary()

    # System-wide operations

    def get_all_buildings_summary(self) -> Dict[str, Any]:
        """Get summary of all buildings"""
        summaries = {}
        total_units = 0
        total_affected = 0
        total_cost = 0

        for bid, building in self.buildings.items():
            stats = building.unit_array.get_statistics()
            summaries[bid] = {
                'total_units': stats['total_units'],
                'affected_units': stats['affected_units'],
                'estimated_cost': stats['total_estimated_cost']
            }
            total_units += stats['total_units']
            total_affected += stats['affected_units']
            total_cost += stats['total_estimated_cost']

        return {
            'building_count': len(self.buildings),
            'total_units': total_units,
            'total_affected': total_affected,
            'total_estimated_cost': round(total_cost, 2),
            'buildings': summaries,
            'generated_at': datetime.now().isoformat()
        }

    def export_data(self, building_id: Optional[str] = None) -> str:
        """Export building data as JSON"""
        return self.get_unit_array(building_id).to_json()

    def import_data(self, json_data: str, building_id: str) -> UnitArray:
        """
        Import building data from JSON.

        Args:
            json_data: JSON string from export_data
            building_id: Building ID for imported data

        Returns:
            Imported UnitArray
        """
        if building_id not in self.buildings:
            self.create_building(building_id)

        ua = UnitArray.from_json(json_data)
        self.buildings[building_id].unit_array = ua
        return ua


# Quick start function
async def quick_start_demo():
    """
    Demo function showing system usage.

    Run with: asyncio.run(quick_start_demo())
    """
    M = MoldKonomiSystem()

    # Create 176-unit array (4 floors × 4 wings × 11 units)
    UA = M.create_unit_array("student_housing", (4, 4, 11))

    # Simulate some assessments
    demo_assessments = [
        {'floor': 2, 'wing': 'NE', 'unit': 5, 'severity': 3, 'sqft_affected': 120, 'moisture': 0.8, 'source': 'window_leak'},
        {'floor': 1, 'wing': 'NW', 'unit': 3, 'severity': 2, 'sqft_affected': 50, 'moisture': 0.5, 'source': 'condensation'},
        {'floor': 3, 'wing': 'SE', 'unit': 8, 'severity': 4, 'sqft_affected': 200, 'moisture': 0.9, 'source': 'HVAC'},
        {'floor': 0, 'wing': 'SW', 'unit': 1, 'severity': 1, 'sqft_affected': 20, 'moisture': 0.3, 'source': 'humidity'},
        {'floor': 2, 'wing': 'NE', 'unit': 7, 'severity': 3, 'sqft_affected': 80, 'moisture': 0.7, 'source': 'pipe_leak'},
    ]

    # Bulk assess
    for a in demo_assessments:
        M.assess(a['floor'], a['wing'], a['unit'], a)

    # Get priority queue
    queue = M.get_priority_queue()
    print(f"\n📋 Priority Queue ({len(queue)} units):")
    for i, item in enumerate(queue[:5], 1):
        print(f"  {i}. {item['unit_id']} - Severity: {item['severity']}, Score: {item['priority_score']:.3f}")

    # Generate schedule
    schedule = await M.generate_schedule(crew_size=3, days=20)
    print(f"\n📅 Schedule: {schedule['estimated_days']} days needed")

    # Executive report
    report = M.get_executive_report()
    print(f"\n📊 Executive Summary:")
    print(f"  Risk Level: {report['risk_level']}")
    print(f"  Affected: {report['key_metrics']['affected_units']}/{report['key_metrics']['total_units']} units")
    print(f"  Est. Cost: ${report['key_metrics']['estimated_total_cost']:,.2f}")

    return M


if __name__ == "__main__":
    asyncio.run(quick_start_demo())
