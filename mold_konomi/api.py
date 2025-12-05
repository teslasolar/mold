"""
📡 REST API - UnitArray Operations
FastAPI endpoints for mold assessment system

Endpoints:
    POST /building/create      → create 176-unit template
    POST /unit/assess          → assess single unit
    GET  /unit                 → get unit data
    POST /unit/update          → update assessment
    POST /zone/report          → zone summary
    GET  /heatmap              → severity visualization
    POST /schedule/generate    → remediation schedule
    GET  /report/executive     → high-level summary
    GET  /report/zone/{zone}   → zone breakdown
    GET  /report/materials     → supplies needed
    GET  /report/schedule      → day-by-day plan
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import asyncio

from .system import MoldKonomiSystem
from .building import Building


# Pydantic models for request/response
class BuildingCreate(BaseModel):
    building_id: str = Field(..., description="Unique building identifier")
    floors: int = Field(4, ge=1, le=20)
    wings: int = Field(4, ge=1, le=8)
    units_per_wing: int = Field(11, ge=1, le=50)


class UnitAssess(BaseModel):
    building_id: Optional[str] = None
    floor: int = Field(..., ge=0)
    wing: str = Field(..., pattern="^(NE|NW|SE|SW)$")
    unit: int = Field(..., ge=0)
    severity: Optional[int] = Field(None, ge=0, le=4)
    sqft_affected: float = Field(0, ge=0)
    moisture_level: float = Field(0, ge=0, le=1)
    surfaces: List[str] = Field(default_factory=list)
    source: str = Field("none")
    photos: List[str] = Field(default_factory=list)
    notes: str = Field("")
    assessor: Optional[str] = None


class UnitUpdate(BaseModel):
    building_id: Optional[str] = None
    floor: int = Field(..., ge=0)
    wing: str = Field(..., pattern="^(NE|NW|SE|SW)$")
    unit: int = Field(..., ge=0)
    severity: Optional[int] = Field(None, ge=0, le=4)
    moisture_level: Optional[float] = Field(None, ge=0, le=1)
    notes: Optional[str] = None


class ScheduleGenerate(BaseModel):
    building_id: Optional[str] = None
    crew_size: int = Field(3, ge=1, le=20)
    days: int = Field(20, ge=1, le=365)
    hours_per_day: float = Field(8.0, ge=1, le=24)


class BulkAssess(BaseModel):
    building_id: Optional[str] = None
    assessments: List[Dict[str, Any]]


# Global system instance
system = MoldKonomiSystem()

# FastAPI app
app = FastAPI(
    title="Mold Konomi API",
    description="🦠 Mold Assessment & Remediation Management System",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "buildings": len(system.buildings)}


# Building operations
@app.post("/building/create")
async def create_building(data: BuildingCreate):
    """Create 176-unit template building"""
    try:
        ua = system.create_unit_array(
            data.building_id,
            (data.floors, data.wings, data.units_per_wing)
        )
        return {
            "success": True,
            "building_id": data.building_id,
            "total_units": ua.total_units,
            "dimensions": {
                "floors": data.floors,
                "wings": data.wings,
                "units_per_wing": data.units_per_wing
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/building/{building_id}")
async def get_building_info(building_id: str):
    """Get building information"""
    try:
        building = system.get_building(building_id)
        stats = building.unit_array.get_statistics()
        return {
            "building_id": building_id,
            "statistics": stats
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/building/{building_id}/summary")
async def get_building_summary(building_id: str):
    """Get complete building summary"""
    try:
        building = system.get_building(building_id)
        return await building.get_building_summary()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Unit operations
@app.post("/unit/assess")
async def assess_unit(data: UnitAssess):
    """Assess single unit"""
    try:
        result = system.assess(
            floor=data.floor,
            wing=data.wing,
            unit=data.unit,
            data={
                "severity": data.severity,
                "sqft_affected": data.sqft_affected,
                "moisture_level": data.moisture_level,
                "surfaces": data.surfaces,
                "source": data.source,
                "photos": data.photos,
                "notes": data.notes
            },
            building_id=data.building_id
        )
        return {"success": True, "assessment": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/unit")
async def get_unit(
    f: int = Query(..., description="Floor number"),
    w: str = Query(..., description="Wing (NE, NW, SE, SW)"),
    u: int = Query(..., description="Unit number"),
    building_id: Optional[str] = Query(None)
):
    """Get unit data"""
    try:
        ua = system.get_unit_array(building_id)
        unit_data = ua.get_unit(f, w, u)
        return unit_data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/unit/update")
async def update_unit(data: UnitUpdate):
    """Update unit assessment"""
    try:
        ua = system.get_unit_array(data.building_id)
        updates = {}
        if data.severity is not None:
            updates["severity"] = data.severity
        if data.moisture_level is not None:
            updates["moisture_level"] = data.moisture_level
        if data.notes is not None:
            updates["notes"] = data.notes

        result = ua.update(data.floor, data.wing, data.unit, updates)
        return {"success": True, "assessment": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/unit/bulk-assess")
async def bulk_assess_units(data: BulkAssess):
    """Bulk assess multiple units"""
    try:
        results = system.bulk_assess(data.assessments, data.building_id)
        return {
            "success": True,
            "count": len(results),
            "assessments": results
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Zone operations
@app.get("/zone/{zone}")
async def get_zone_status(zone: str, building_id: Optional[str] = Query(None)):
    """Get zone status"""
    try:
        status = await system.get_zone_status(zone, building_id)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/zone/report")
async def zone_report(
    zone: str,
    building_id: Optional[str] = Query(None)
):
    """Get zone summary report"""
    try:
        report = system.get_zone_report(zone, building_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Heatmap and visualization
@app.get("/heatmap")
async def get_heatmap(building_id: Optional[str] = Query(None)):
    """Get severity heatmap visualization data"""
    try:
        heatmap = system.get_heatmap(building_id)
        return heatmap
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Priority queue
@app.get("/priority-queue")
async def get_priority_queue(
    building_id: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=176)
):
    """Get priority-ranked unit list"""
    try:
        queue = system.get_priority_queue(building_id)
        if limit:
            queue = queue[:limit]
        return {"count": len(queue), "units": queue}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Schedule generation
@app.post("/schedule/generate")
async def generate_schedule(data: ScheduleGenerate):
    """Generate remediation schedule"""
    try:
        schedule = await system.generate_schedule(
            crew_size=data.crew_size,
            days=data.days,
            hours_per_day=data.hours_per_day,
            building_id=data.building_id
        )
        return schedule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Reports
@app.get("/report/executive")
async def executive_report(building_id: Optional[str] = Query(None)):
    """Get executive summary report"""
    try:
        return system.get_executive_report(building_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/report/zone/{zone}")
async def zone_breakdown(zone: str, building_id: Optional[str] = Query(None)):
    """Get zone breakdown report"""
    try:
        return system.get_zone_report(zone, building_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/report/materials")
async def materials_report(building_id: Optional[str] = Query(None)):
    """Get materials/supplies report"""
    try:
        return system.get_materials_report(building_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/report/schedule")
async def schedule_report(
    building_id: Optional[str] = Query(None),
    crew_size: int = Query(3, ge=1),
    days: int = Query(20, ge=1)
):
    """Get day-by-day schedule report"""
    try:
        return await system.get_schedule_report(crew_size, days, building_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Statistics
@app.get("/statistics")
async def get_statistics(building_id: Optional[str] = Query(None)):
    """Get building statistics"""
    try:
        return system.get_statistics(building_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/statistics/all")
async def get_all_statistics():
    """Get statistics for all buildings"""
    return system.get_all_buildings_summary()


# Data export/import
@app.get("/export")
async def export_data(building_id: Optional[str] = Query(None)):
    """Export building data as JSON"""
    try:
        json_data = system.export_data(building_id)
        return {"data": json_data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/import")
async def import_data(building_id: str, json_data: str):
    """Import building data from JSON"""
    try:
        ua = system.import_data(json_data, building_id)
        return {
            "success": True,
            "building_id": building_id,
            "total_units": ua.total_units
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_system() -> MoldKonomiSystem:
    """Get the global system instance"""
    return system


def run_api(host: str = "0.0.0.0", port: int = 3001):
    """Run the API server"""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_api()
