"""
🦠 MOLD KONOMI SYSTEM 🦠
Turn chaos into checklist. Data in, plan out.

Components:
- eVGPU: Electronic Virtual GPU (CPU-based analysis)
- MoldLLM: Assessment micro-model (16d domain-tuned)
- UnitArray: 176-unit grid system
- Building: Zone system with 8 zones
"""

from .evgpu import eVGPU
from .mold_llm import MoldLLM
from .unit_array import UnitArray
from .building import Building
from .system import MoldKonomiSystem

__version__ = "1.0.0"
__all__ = ["eVGPU", "MoldLLM", "UnitArray", "Building", "MoldKonomiSystem"]
