# 🦠 Mold Konomi System

Turn chaos into checklist. Data in, plan out.

## Quick Start

```python
import asyncio
from mold_konomi import MoldKonomiSystem

async def build():
    M = MoldKonomiSystem()

    # Create 176-unit array (4 floors × 4 wings × 11 units)
    UA = M.create_unit_array("student_housing", (4,4,11))

    # Log assessment from field
    UA.assess(2, 1, 5, {
        "severity": 3,
        "sqft_affected": 120,
        "moisture": 0.8,
        "surface": "drywall",
        "source": "window_leak"
    })

    # Get priority queue
    queue = M.get_priority_queue()

    # Generate schedule
    schedule = await M.generate_schedule(crew_size=3, days=20)

    return M

asyncio.run(build())
```

## Components

| Symbol | Component | Description |
|--------|-----------|-------------|
| ⚡ | eVGPU | Electronic Virtual GPU - CPU-based analysis |
| 🧠 | MoldLLM | Assessment micro-model (16d domain-tuned) |
| 🧊 | UnitArray | 176-unit grid system |
| 🎲 | Building | Zone system with 8 zones |
| 📡 | APIs | REST + WebSocket endpoints |
| 📦 | Kontainer | Docker deployment |

## Running

```bash
# Install dependencies
pip install -r requirements.txt

# Run REST API
python main.py api

# Run WebSocket server
python main.py ws

# Run demo
python main.py demo

# Docker
docker-compose up
```

## API Endpoints

### REST (port 3001)
- `POST /building/create` - Create 176-unit template
- `POST /unit/assess` - Assess single unit
- `GET /unit?f,w,u` - Get unit data
- `POST /unit/update` - Update assessment
- `GET /heatmap` - Severity visualization
- `POST /schedule/generate` - Remediation schedule
- `GET /report/executive` - High-level summary

### WebSocket (port 6789)
```javascript
ws.send(JSON.stringify({action:"scan_unit", floor:2, wing:"NE", unit:5}))
ws.send(JSON.stringify({action:"priority_list"}))
ws.send(JSON.stringify({action:"get_zone_status", zone:"NE_LOW"}))
```

## Severity Levels

| Level | Name | Action |
|-------|------|--------|
| 0 | NONE | No action |
| 1 | MINOR | Surface clean, monitor |
| 2 | MODERATE | Treatment required |
| 3 | SEVERE | Material removal needed |
| 4 | CRITICAL | Immediate action, relocation |

## Performance

- 🧠 MoldLLM: instant assessment, 4MB RAM
- ⚡ eVGPU: priority calc <1ms per unit
- 🧊 UnitArray: 176 units, sparse storage
- 🎲 Building: 8 zone concurrent analysis
- 📦 Kontainer: <500MB total footprint
