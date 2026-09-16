import time
import logging
from typing import Dict, Set, Any, Optional, List
from fastapi import WebSocket

logger = logging.getLogger("app.services.rooms")


class RoomManager:
    """
    Manages active social jam rooms, connected WebSocket clients,
    and synchronized playback state across all listeners in a room.
    """

    def __init__(self):
        # Mapping: room_id -> set of WebSocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}
        # Mapping: room_id -> current playback state
        self.states: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, username: str = "Anonymous"):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
            self.states[room_id] = {
                "room_id": room_id,
                "current_track": None,
                "is_playing": False,
                "position_sec": 0.0,
                "host": username,
                "listeners": 0,
                "created_at": time.time(),
            }

        self.rooms[room_id].add(websocket)
        self.states[room_id]["listeners"] = len(self.rooms[room_id])

        # Send current room state to newly joined user
        await websocket.send_json({
            "type": "SYNC_STATE",
            "state": self.states[room_id],
        })

        # Broadcast listener join to everyone else
        await self.broadcast(room_id, {
            "type": "USER_JOINED",
            "username": username,
            "listeners": len(self.rooms[room_id]),
        })

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].discard(websocket)
            if not self.rooms[room_id]:
                # Clean up empty room
                del self.rooms[room_id]
                if room_id in self.states:
                    del self.states[room_id]
            else:
                self.states[room_id]["listeners"] = len(self.rooms[room_id])

    async def broadcast(self, room_id: str, message: Dict[str, Any]):
        if room_id in self.rooms:
            dead_sockets = set()
            for ws in self.rooms[room_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_sockets.add(ws)

            for dead in dead_sockets:
                self.rooms[room_id].discard(dead)

    async def handle_message(self, room_id: str, data: Dict[str, Any], sender_ws: WebSocket):
        action_type = data.get("type")
        state = self.states.get(room_id)
        if not state:
            return

        if action_type == "PLAY":
            state["is_playing"] = True
            state["position_sec"] = data.get("position_sec", state["position_sec"])
            await self.broadcast(room_id, {
                "type": "PLAY",
                "position_sec": state["position_sec"],
            })

        elif action_type == "PAUSE":
            state["is_playing"] = False
            state["position_sec"] = data.get("position_sec", state["position_sec"])
            await self.broadcast(room_id, {
                "type": "PAUSE",
                "position_sec": state["position_sec"],
            })

        elif action_type == "CHANGE_TRACK":
            state["current_track"] = data.get("track")
            state["is_playing"] = True
            state["position_sec"] = 0.0
            await self.broadcast(room_id, {
                "type": "CHANGE_TRACK",
                "track": state["current_track"],
            })

        elif action_type == "SEEK":
            pos = data.get("position_sec", 0.0)
            state["position_sec"] = pos
            await self.broadcast(room_id, {
                "type": "SEEK",
                "position_sec": pos,
            })

        elif action_type == "CHAT":
            await self.broadcast(room_id, {
                "type": "CHAT",
                "username": data.get("username", "Anonymous"),
                "text": data.get("text", ""),
                "time": time.time(),
            })

    def get_active_rooms(self) -> List[Dict[str, Any]]:
        return [
            {
                "room_id": r_id,
                "listeners": len(self.rooms[r_id]),
                "current_track": self.states[r_id].get("current_track"),
                "is_playing": self.states[r_id].get("is_playing", False),
                "host": self.states[r_id].get("host", "Anonymous"),
            }
            for r_id in self.rooms
        ]


room_manager = RoomManager()
