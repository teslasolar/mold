"""
📡 WebSocket Server - Building Real-time Operations

Protocol:
    ws://host:6789

Actions:
    {action: "scan_unit", floor: 2, wing: "NE", unit: 5, ...}
    {action: "update_severity", unit_id: "2-NE-5", level: 3}
    {action: "get_zone_status", zone: "NE_LOW"}
    {action: "priority_list"} → get ranked remediation order
    {action: "get_unit", floor: 2, wing: "NE", unit: 5}
    {action: "get_heatmap"}
    {action: "subscribe", channel: "updates"}
    {action: "unsubscribe", channel: "updates"}
"""

import asyncio
import json
import logging
from typing import Dict, Any, Set, Optional
from datetime import datetime
import websockets
from websockets.server import WebSocketServerProtocol

from .system import MoldKonomiSystem
from .building import Building

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MoldWebSocketServer:
    """
    WebSocket server for real-time mold assessment updates.

    Features:
    - Real-time unit scanning
    - Severity updates
    - Zone status queries
    - Priority list streaming
    - Pub/sub for updates
    """

    def __init__(self, system: Optional[MoldKonomiSystem] = None):
        """
        Initialize WebSocket server.

        Args:
            system: Optional MoldKonomiSystem instance (creates new if not provided)
        """
        self.system = system or MoldKonomiSystem()
        self.clients: Set[WebSocketServerProtocol] = set()
        self.subscriptions: Dict[str, Set[WebSocketServerProtocol]] = {
            "updates": set(),
            "priority": set(),
            "zones": set()
        }
        self.running = False

    async def register(self, websocket: WebSocketServerProtocol):
        """Register a new client connection"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")

    async def unregister(self, websocket: WebSocketServerProtocol):
        """Unregister a client connection"""
        self.clients.discard(websocket)
        # Remove from all subscriptions
        for channel in self.subscriptions.values():
            channel.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

    async def broadcast(self, channel: str, message: Dict[str, Any]):
        """Broadcast message to all subscribers of a channel"""
        if channel in self.subscriptions:
            subscribers = self.subscriptions[channel]
            if subscribers:
                payload = json.dumps({
                    "channel": channel,
                    "data": message,
                    "timestamp": datetime.now().isoformat()
                })
                await asyncio.gather(
                    *[ws.send(payload) for ws in subscribers],
                    return_exceptions=True
                )

    async def handle_message(
        self,
        websocket: WebSocketServerProtocol,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle incoming WebSocket message.

        Args:
            websocket: Client WebSocket
            message: Parsed message dict

        Returns:
            Response dict
        """
        action = message.get("action")
        building_id = message.get("building_id")

        try:
            if action == "scan_unit":
                return await self.handle_scan_unit(message, building_id)

            elif action == "update_severity":
                return await self.handle_update_severity(message, building_id)

            elif action == "get_zone_status":
                return await self.handle_get_zone_status(message, building_id)

            elif action == "priority_list":
                return await self.handle_priority_list(message, building_id)

            elif action == "get_unit":
                return await self.handle_get_unit(message, building_id)

            elif action == "get_heatmap":
                return await self.handle_get_heatmap(building_id)

            elif action == "get_statistics":
                return await self.handle_get_statistics(building_id)

            elif action == "create_building":
                return await self.handle_create_building(message)

            elif action == "subscribe":
                return await self.handle_subscribe(websocket, message)

            elif action == "unsubscribe":
                return await self.handle_unsubscribe(websocket, message)

            elif action == "generate_schedule":
                return await self.handle_generate_schedule(message, building_id)

            elif action == "ping":
                return {"action": "pong", "timestamp": datetime.now().isoformat()}

            else:
                return {
                    "error": f"Unknown action: {action}",
                    "available_actions": [
                        "scan_unit", "update_severity", "get_zone_status",
                        "priority_list", "get_unit", "get_heatmap",
                        "get_statistics", "create_building", "subscribe",
                        "unsubscribe", "generate_schedule", "ping"
                    ]
                }

        except ValueError as e:
            return {"error": str(e), "action": action}
        except Exception as e:
            logger.error(f"Error handling {action}: {e}")
            return {"error": f"Internal error: {str(e)}", "action": action}

    async def handle_scan_unit(
        self,
        message: Dict[str, Any],
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle scan_unit action"""
        floor = message.get("floor")
        wing = message.get("wing")
        unit = message.get("unit")

        if floor is None or wing is None or unit is None:
            return {"error": "Missing floor, wing, or unit"}

        # Extract assessment data
        data = {
            k: v for k, v in message.items()
            if k not in ["action", "floor", "wing", "unit", "building_id"]
        }

        result = self.system.assess(floor, wing, unit, data, building_id)

        # Broadcast update
        await self.broadcast("updates", {
            "type": "unit_assessed",
            "unit_id": result["unit_id"],
            "severity": result["severity"],
            "priority_score": result["priority_score"]
        })

        return {"action": "scan_unit", "success": True, "assessment": result}

    async def handle_update_severity(
        self,
        message: Dict[str, Any],
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle update_severity action"""
        unit_id = message.get("unit_id")
        level = message.get("level")

        if unit_id is None or level is None:
            return {"error": "Missing unit_id or level"}

        building = self.system.get_building(building_id)
        result = building.update_severity(unit_id, level, message.get("notes"))

        # Broadcast update
        await self.broadcast("updates", {
            "type": "severity_updated",
            "unit_id": unit_id,
            "level": level
        })

        return {"action": "update_severity", "success": True, "assessment": result}

    async def handle_get_zone_status(
        self,
        message: Dict[str, Any],
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle get_zone_status action"""
        zone = message.get("zone")

        if zone is None:
            return {"error": "Missing zone"}

        status = await self.system.get_zone_status(zone, building_id)
        return {"action": "get_zone_status", "zone": zone, "status": status}

    async def handle_priority_list(
        self,
        message: Dict[str, Any],
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle priority_list action"""
        limit = message.get("limit")
        queue = self.system.get_priority_queue(building_id)

        if limit:
            queue = queue[:limit]

        return {"action": "priority_list", "count": len(queue), "units": queue}

    async def handle_get_unit(
        self,
        message: Dict[str, Any],
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle get_unit action"""
        floor = message.get("floor")
        wing = message.get("wing")
        unit = message.get("unit")

        if floor is None or wing is None or unit is None:
            return {"error": "Missing floor, wing, or unit"}

        ua = self.system.get_unit_array(building_id)
        unit_data = ua.get_unit(floor, wing, unit)

        return {"action": "get_unit", "unit": unit_data}

    async def handle_get_heatmap(
        self,
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle get_heatmap action"""
        heatmap = self.system.get_heatmap(building_id)
        return {"action": "get_heatmap", "heatmap": heatmap}

    async def handle_get_statistics(
        self,
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle get_statistics action"""
        stats = self.system.get_statistics(building_id)
        return {"action": "get_statistics", "statistics": stats}

    async def handle_create_building(
        self,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle create_building action"""
        building_id = message.get("building_id")
        if not building_id:
            return {"error": "Missing building_id"}

        floors = message.get("floors", 4)
        wings = message.get("wings", 4)
        units_per = message.get("units_per_wing", 11)

        ua = self.system.create_unit_array(building_id, (floors, wings, units_per))

        return {
            "action": "create_building",
            "success": True,
            "building_id": building_id,
            "total_units": ua.total_units
        }

    async def handle_subscribe(
        self,
        websocket: WebSocketServerProtocol,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle subscribe action"""
        channel = message.get("channel")

        if channel not in self.subscriptions:
            return {
                "error": f"Unknown channel: {channel}",
                "available_channels": list(self.subscriptions.keys())
            }

        self.subscriptions[channel].add(websocket)
        return {"action": "subscribe", "channel": channel, "success": True}

    async def handle_unsubscribe(
        self,
        websocket: WebSocketServerProtocol,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle unsubscribe action"""
        channel = message.get("channel")

        if channel in self.subscriptions:
            self.subscriptions[channel].discard(websocket)

        return {"action": "unsubscribe", "channel": channel, "success": True}

    async def handle_generate_schedule(
        self,
        message: Dict[str, Any],
        building_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle generate_schedule action"""
        crew_size = message.get("crew_size", 3)
        days = message.get("days", 20)
        hours_per_day = message.get("hours_per_day", 8.0)

        schedule = await self.system.generate_schedule(
            crew_size, days, hours_per_day, building_id
        )

        return {"action": "generate_schedule", "schedule": schedule}

    async def handler(self, websocket: WebSocketServerProtocol):
        """Main WebSocket connection handler"""
        await self.register(websocket)

        try:
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "welcome",
                "message": "Connected to Mold Konomi WebSocket Server",
                "buildings": len(self.system.buildings),
                "timestamp": datetime.now().isoformat()
            }))

            # Handle messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    response = await self.handle_message(websocket, data)
                    await websocket.send(json.dumps(response))
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "error": "Invalid JSON"
                    }))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)

    async def start(self, host: str = "0.0.0.0", port: int = 6789):
        """
        Start WebSocket server.

        Args:
            host: Host address
            port: Port number
        """
        self.running = True
        logger.info(f"Starting WebSocket server on ws://{host}:{port}")

        async with websockets.serve(self.handler, host, port):
            await asyncio.Future()  # Run forever

    def stop(self):
        """Stop WebSocket server"""
        self.running = False


# Shared server instance
_server: Optional[MoldWebSocketServer] = None


def get_server(system: Optional[MoldKonomiSystem] = None) -> MoldWebSocketServer:
    """Get or create shared server instance"""
    global _server
    if _server is None:
        _server = MoldWebSocketServer(system)
    return _server


async def run_server(host: str = "0.0.0.0", port: int = 6789):
    """Run WebSocket server"""
    server = get_server()
    await server.start(host, port)


if __name__ == "__main__":
    asyncio.run(run_server())
