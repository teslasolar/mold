"""
🧠 MoldLLM - Assessment Micro-Model
16d domain-tuned | 4MB RAM | instant

Provides severity assessment and action recommendations
based on domain-specific rules and pattern matching.
"""

from typing import Dict, Any, List, Optional, Tuple
from enum import IntEnum
from dataclasses import dataclass, field
import numpy as np


class Severity(IntEnum):
    """Severity levels for mold assessment"""
    NONE = 0      # No action
    MINOR = 1     # Surface clean, monitor
    MODERATE = 2  # Treatment required
    SEVERE = 3    # Material removal needed
    CRITICAL = 4  # Immediate action, possible relocation


@dataclass
class Action:
    """Remediation action recommendation"""
    level: str
    description: str
    urgency: str
    requires_relocation: bool = False
    materials: List[str] = field(default_factory=list)


class MoldLLM:
    """
    Domain-tuned micro-model for mold assessment.

    16-dimensional feature space:
    - 4 moisture indicators
    - 4 surface type factors
    - 4 source indicators
    - 4 spread pattern factors
    """

    # Hidden dimension
    h = 16

    # Severity labels
    SEVERITY = ['NONE', 'MINOR', 'MODERATE', 'SEVERE', 'CRITICAL']

    # Source types and their severity multipliers
    SOURCES = {
        'none': 0.0,
        'condensation': 0.3,
        'humidity': 0.4,
        'window_leak': 0.6,
        'pipe_leak': 0.7,
        'HVAC': 0.8,
        'roof_leak': 0.9,
        'flood': 1.0
    }

    # Surface types and remediation difficulty
    SURFACES = {
        'tile': 0.2,
        'glass': 0.2,
        'metal': 0.3,
        'painted': 0.4,
        'wood': 0.6,
        'drywall': 0.7,
        'carpet': 0.8,
        'ceiling': 0.8,
        'insulation': 0.9
    }

    # Action templates
    ACTIONS = {
        Severity.NONE: Action(
            level='NONE',
            description='No mold detected. Continue routine monitoring.',
            urgency='none',
            materials=[]
        ),
        Severity.MINOR: Action(
            level='MINOR',
            description='Surface mold present. Clean with approved solution and monitor.',
            urgency='low',
            materials=['mold cleaner', 'PPE', 'HEPA vacuum']
        ),
        Severity.MODERATE: Action(
            level='MODERATE',
            description='Mold treatment required. Apply antimicrobial and seal affected area.',
            urgency='medium',
            materials=['mold cleaner', 'antimicrobial spray', 'sealant', 'PPE', 'HEPA vacuum', 'dehumidifier']
        ),
        Severity.SEVERE: Action(
            level='SEVERE',
            description='Material removal required. Remove and replace affected materials.',
            urgency='high',
            materials=['PPE', 'containment plastic', 'HEPA air scrubber', 'replacement drywall',
                      'antimicrobial spray', 'disposal bags']
        ),
        Severity.CRITICAL: Action(
            level='CRITICAL',
            description='Immediate action required. Relocate occupant and begin full remediation.',
            urgency='immediate',
            requires_relocation=True,
            materials=['PPE', 'full containment setup', 'HEPA air scrubbers', 'negative air machine',
                      'replacement materials', 'antimicrobial treatment', 'disposal containers']
        )
    }

    def __init__(self):
        # Initialize 16-dimensional weight matrix for severity prediction
        # Simulates domain-tuned weights
        self._weights = self._init_weights()

    def _init_weights(self) -> np.ndarray:
        """Initialize domain-tuned weight matrix"""
        # 16-dimensional feature → 5 severity classes
        np.random.seed(42)  # Reproducible "trained" weights
        weights = np.array([
            # moisture_high, moisture_med, moisture_low, moisture_trend
            [0.0, 0.1, 0.3, 0.4, 0.6],  # moisture_high
            [0.0, 0.2, 0.4, 0.3, 0.2],  # moisture_med
            [0.1, 0.3, 0.2, 0.1, 0.1],  # moisture_low
            [0.0, 0.1, 0.2, 0.3, 0.4],  # moisture_trend_up

            # surface_hard, surface_porous, surface_organic, surface_hidden
            [0.2, 0.2, 0.1, 0.1, 0.1],  # surface_hard
            [0.0, 0.2, 0.4, 0.5, 0.6],  # surface_porous
            [0.0, 0.1, 0.3, 0.5, 0.7],  # surface_organic
            [0.0, 0.1, 0.2, 0.4, 0.5],  # surface_hidden

            # source_minor, source_moderate, source_severe, source_ongoing
            [0.1, 0.3, 0.2, 0.1, 0.1],  # source_minor
            [0.0, 0.2, 0.4, 0.3, 0.2],  # source_moderate
            [0.0, 0.1, 0.2, 0.5, 0.6],  # source_severe
            [0.0, 0.0, 0.2, 0.4, 0.6],  # source_ongoing

            # spread_spot, spread_area, spread_multi, spread_structural
            [0.2, 0.4, 0.2, 0.1, 0.0],  # spread_spot
            [0.0, 0.2, 0.5, 0.4, 0.2],  # spread_area
            [0.0, 0.1, 0.2, 0.5, 0.5],  # spread_multi_surface
            [0.0, 0.0, 0.1, 0.3, 0.7],  # spread_structural
        ])
        return weights

    def _extract_features(self, unit_data: Dict[str, Any]) -> np.ndarray:
        """Extract 16-dimensional feature vector from unit data"""
        features = np.zeros(self.h)

        # Moisture features (indices 0-3)
        moisture = unit_data.get('moisture_level', unit_data.get('moisture', 0))
        if moisture >= 0.8:
            features[0] = 1.0  # high
        elif moisture >= 0.5:
            features[1] = 1.0  # med
        elif moisture > 0:
            features[2] = 1.0  # low
        features[3] = unit_data.get('moisture_trending_up', 0)

        # Surface features (indices 4-7)
        surfaces = unit_data.get('surfaces', [unit_data.get('surface', '')])
        if isinstance(surfaces, str):
            surfaces = [surfaces]

        for surface in surfaces:
            difficulty = self.SURFACES.get(surface.lower(), 0.5)
            if difficulty <= 0.3:
                features[4] = max(features[4], 1.0)  # hard
            elif difficulty <= 0.5:
                features[5] = max(features[5], 1.0)  # porous
            elif difficulty <= 0.7:
                features[6] = max(features[6], 1.0)  # organic
            else:
                features[7] = max(features[7], 1.0)  # hidden/difficult

        # Source features (indices 8-11)
        source = unit_data.get('source', 'none').lower()
        source_severity = self.SOURCES.get(source, 0.5)
        if source_severity <= 0.3:
            features[8] = 1.0  # minor
        elif source_severity <= 0.5:
            features[9] = 1.0  # moderate
        else:
            features[10] = 1.0  # severe
        features[11] = 1.0 if unit_data.get('source_active', False) else 0.0

        # Spread features (indices 12-15)
        sqft = unit_data.get('sqft_affected', 0)
        num_surfaces = len(surfaces) if surfaces else 0
        structural = unit_data.get('structural_damage', False)

        if sqft <= 10:
            features[12] = 1.0  # spot
        elif sqft <= 50:
            features[13] = 1.0  # area
        elif num_surfaces > 1:
            features[14] = 1.0  # multi-surface
        if structural or sqft > 200:
            features[15] = 1.0  # structural

        return features

    def calc_severity(self, unit_data: Dict[str, Any]) -> int:
        """
        Calculate severity level from unit data.

        Args:
            unit_data: Unit assessment data

        Returns:
            Severity level 0-4
        """
        # Check for explicit severity
        if 'severity' in unit_data:
            return min(max(int(unit_data['severity']), 0), 4)

        # Extract features and predict
        features = self._extract_features(unit_data)

        # Apply domain weights
        scores = np.dot(features, self._weights)

        # Get predicted severity (argmax)
        severity = int(np.argmax(scores))

        # Apply overrides for critical conditions
        moisture = unit_data.get('moisture_level', unit_data.get('moisture', 0))
        if moisture >= 0.9 and unit_data.get('source_active', False):
            severity = max(severity, Severity.SEVERE)

        if unit_data.get('structural_damage', False):
            severity = max(severity, Severity.CRITICAL)

        return severity

    def recommend_action(self, unit_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recommend remediation action based on assessment.

        Args:
            unit_data: Unit assessment data

        Returns:
            Action recommendation dict
        """
        severity = self.calc_severity(unit_data)
        action = self.ACTIONS[Severity(severity)]

        return {
            'level': action.level,
            'description': action.description,
            'urgency': action.urgency,
            'requires_relocation': action.requires_relocation,
            'materials': action.materials.copy()
        }

    async def assess(self, unit_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Full assessment of unit.

        Args:
            unit_data: Unit assessment data

        Returns:
            Complete assessment with severity and action
        """
        severity = self.calc_severity(unit_data)
        action = self.recommend_action(unit_data)

        return {
            'severity': severity,
            'severity_label': self.SEVERITY[severity],
            'action': action,
            'features': self._extract_features(unit_data).tolist(),
            'confidence': self._calc_confidence(unit_data)
        }

    def _calc_confidence(self, unit_data: Dict[str, Any]) -> float:
        """Calculate confidence score based on data completeness"""
        required_fields = ['moisture_level', 'surfaces', 'source', 'sqft_affected']
        present = sum(1 for f in required_fields if f in unit_data or
                     f.replace('_level', '') in unit_data)
        return round(present / len(required_fields), 2)

    def severity_label(self, level: int) -> str:
        """Get severity label from level"""
        return self.SEVERITY[min(max(level, 0), 4)]

    def aggregate_zone_assessment(self, unit_assessments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregate assessments for a zone.

        Args:
            unit_assessments: List of unit assessment results

        Returns:
            Zone-level summary
        """
        if not unit_assessments:
            return {
                'total_units': 0,
                'severity_distribution': {label: 0 for label in self.SEVERITY},
                'requires_relocation': 0,
                'urgency_breakdown': {'none': 0, 'low': 0, 'medium': 0, 'high': 0, 'immediate': 0}
            }

        severities = [a.get('severity', 0) for a in unit_assessments]
        actions = [a.get('action', {}) for a in unit_assessments]

        distribution = {label: 0 for label in self.SEVERITY}
        for s in severities:
            distribution[self.SEVERITY[s]] += 1

        urgency_breakdown = {'none': 0, 'low': 0, 'medium': 0, 'high': 0, 'immediate': 0}
        relocation_count = 0

        for action in actions:
            urg = action.get('urgency', 'none')
            if urg in urgency_breakdown:
                urgency_breakdown[urg] += 1
            if action.get('requires_relocation', False):
                relocation_count += 1

        return {
            'total_units': len(unit_assessments),
            'severity_distribution': distribution,
            'avg_severity': sum(severities) / len(severities) if severities else 0,
            'max_severity': max(severities) if severities else 0,
            'requires_relocation': relocation_count,
            'urgency_breakdown': urgency_breakdown
        }
