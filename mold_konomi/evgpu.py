"""
⚡ eVGPU - Electronic Virtual GPU
NO GPU NEEDED! CPU→Analysis

Operations: risk_calc, cost_estimate, schedule_optimize
Performance: priority calc <1ms per unit
"""

import numpy as np
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass


@dataclass
class CostFactors:
    """Cost estimation factors per severity level"""
    labor_rate: float = 75.0  # $/hour
    material_multiplier: Dict[int, float] = None

    def __post_init__(self):
        if self.material_multiplier is None:
            self.material_multiplier = {
                0: 0,      # NONE
                1: 50,     # MINOR - surface clean
                2: 200,    # MODERATE - treatment
                3: 800,    # SEVERE - removal
                4: 2000,   # CRITICAL - full remediation
            }


class eVGPU:
    """
    Electronic Virtual GPU - CPU-based tensor operations for mold analysis.

    Provides:
    - Priority scoring for remediation scheduling
    - Cost estimation calculations
    - Schedule optimization
    - Risk matrix calculations
    """

    # Priority weights: [severity, sqft_normalized, moisture]
    PRIORITY_WEIGHTS = np.array([0.5, 0.3, 0.2])

    # Time estimates (hours) per severity level per 100 sqft
    HOURS_PER_SEVERITY = np.array([0, 1, 3, 6, 12])

    def __init__(self, cores: int = 4):
        self.cores = cores
        self.cost_factors = CostFactors()
        self._batch_cache = {}

    def tensor(self, a: np.ndarray, b: np.ndarray, op: str = '@') -> np.ndarray:
        """
        Basic tensor operations.

        Args:
            a: First array
            b: Second array
            op: Operation - '@' for matmul, '+' for add, '*' for multiply

        Returns:
            Result array
        """
        if op == '@':
            return np.matmul(a, b)
        elif op == '+':
            return np.add(a, b)
        elif op == '*':
            return np.multiply(a, b)
        else:
            raise ValueError(f"Unknown operation: {op}")

    def priority_score(self, severity: int, sqft: float, moisture: float) -> float:
        """
        Calculate priority score for a single unit.

        Args:
            severity: 0-4 severity level
            sqft: Square footage affected
            moisture: 0-1 moisture level

        Returns:
            Priority score 0-1 (higher = more urgent)
        """
        features = np.array([
            severity / 4.0,      # Normalize to 0-1
            min(sqft / 500, 1),  # Cap at 500 sqft
            moisture
        ])
        return float(np.dot(features, self.PRIORITY_WEIGHTS))

    def batch_priority_scores(self, units: List[Dict[str, Any]]) -> np.ndarray:
        """
        Calculate priority scores for multiple units in batch.

        Args:
            units: List of unit dicts with severity, sqft, moisture

        Returns:
            Array of priority scores
        """
        if not units:
            return np.array([])

        # Build feature matrix: [n_units, 3]
        features = np.array([
            [
                u.get('severity', 0) / 4.0,
                min(u.get('sqft_affected', 0) / 500, 1),
                u.get('moisture_level', 0)
            ]
            for u in units
        ])

        # Batch matmul for all units at once
        return self.tensor(features, self.PRIORITY_WEIGHTS, '@')

    def cost_estimate(self, severity: int, sqft: float) -> float:
        """
        Estimate remediation cost for a unit.

        Args:
            severity: 0-4 severity level
            sqft: Square footage affected

        Returns:
            Estimated cost in dollars
        """
        base_material = self.cost_factors.material_multiplier.get(severity, 0)
        hours = self.estimate_hours(severity, sqft)
        labor_cost = hours * self.cost_factors.labor_rate
        material_cost = base_material * (sqft / 100)

        return round(labor_cost + material_cost, 2)

    def estimate_hours(self, severity: int, sqft: float) -> float:
        """
        Estimate remediation hours for a unit.

        Args:
            severity: 0-4 severity level
            sqft: Square footage affected

        Returns:
            Estimated hours
        """
        base_hours = self.HOURS_PER_SEVERITY[min(severity, 4)]
        return base_hours * (sqft / 100)

    def risk_matrix(self, severity_array: np.ndarray, moisture_array: np.ndarray) -> np.ndarray:
        """
        Calculate risk matrix combining severity and moisture.

        Args:
            severity_array: 3D array of severity values
            moisture_array: 3D array of moisture values

        Returns:
            3D risk matrix
        """
        # Normalize severity to 0-1
        norm_severity = severity_array / 4.0
        # Risk = weighted combination
        return self.tensor(norm_severity, 0.6, '*') + self.tensor(moisture_array, 0.4, '*')

    def schedule_optimize(
        self,
        units: List[Dict[str, Any]],
        crew_size: int = 3,
        hours_per_day: float = 8.0
    ) -> List[Dict[str, Any]]:
        """
        Optimize remediation schedule based on priority and efficiency.

        Args:
            units: List of unit assessments
            crew_size: Number of crew members
            hours_per_day: Working hours per day

        Returns:
            Optimized schedule with day assignments
        """
        if not units:
            return []

        # Calculate priority scores for all units
        scores = self.batch_priority_scores(units)

        # Sort by priority (highest first)
        sorted_indices = np.argsort(-scores)

        schedule = []
        current_day = 1
        day_hours_used = 0.0
        daily_capacity = crew_size * hours_per_day

        for idx in sorted_indices:
            unit = units[idx]
            severity = unit.get('severity', 0)
            sqft = unit.get('sqft_affected', 0)

            if severity == 0:  # Skip units with no issues
                continue

            hours_needed = self.estimate_hours(severity, sqft)

            # Check if we need a new day
            if day_hours_used + hours_needed > daily_capacity:
                current_day += 1
                day_hours_used = 0.0

            schedule.append({
                'unit_id': unit.get('unit_id', f"unit_{idx}"),
                'day': current_day,
                'priority_score': float(scores[idx]),
                'estimated_hours': hours_needed,
                'estimated_cost': self.cost_estimate(severity, sqft),
                'severity': severity
            })

            day_hours_used += hours_needed

        return schedule

    def zone_aggregate(self, zone_units: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregate statistics for a zone.

        Args:
            zone_units: List of unit assessments in zone

        Returns:
            Zone aggregate statistics
        """
        if not zone_units:
            return {
                'total_units': 0,
                'affected_units': 0,
                'avg_severity': 0,
                'max_severity': 0,
                'total_sqft_affected': 0,
                'total_estimated_cost': 0,
                'total_estimated_hours': 0
            }

        severities = np.array([u.get('severity', 0) for u in zone_units])
        sqft_values = np.array([u.get('sqft_affected', 0) for u in zone_units])

        total_cost = sum(
            self.cost_estimate(u.get('severity', 0), u.get('sqft_affected', 0))
            for u in zone_units
        )

        total_hours = sum(
            self.estimate_hours(u.get('severity', 0), u.get('sqft_affected', 0))
            for u in zone_units
        )

        return {
            'total_units': len(zone_units),
            'affected_units': int(np.sum(severities > 0)),
            'avg_severity': float(np.mean(severities)),
            'max_severity': int(np.max(severities)),
            'total_sqft_affected': float(np.sum(sqft_values)),
            'total_estimated_cost': round(total_cost, 2),
            'total_estimated_hours': round(total_hours, 1)
        }
