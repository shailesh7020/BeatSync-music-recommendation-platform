import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.room_manager import room_manager

logger = logging.getLogger("app.routes.rooms")

router = APIRouter(tags=["Social Jam Rooms"])


@router.get("/rooms/active")
def list_active_rooms():
    """
    List currently active social listening rooms.
    """
    return {
        "count": len(room_manager.rooms),
        "rooms": room_manager.get_active_rooms(),
    }


@router.websocket("/ws/room/{room_id}")
async def room_websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    username: str = Query(default="Listener"),
):
    """
    Real-time WebSocket endpoint for synchronized music listening rooms.
    """
    await room_manager.connect(websocket, room_id, username=username)
    try:
        while True:
            data = await websocket.receive_json()
            await room_manager.handle_message(room_id, data, sender_ws=websocket)
    except WebSocketDisconnect:
        room_manager.disconnect(websocket, room_id)
        await room_manager.broadcast(room_id, {
            "type": "USER_LEFT",
            "username": username,
            "listeners": len(room_manager.rooms.get(room_id, set())),
        })
    except Exception as e:
        logger.warning(f"WebSocket error in room {room_id}: {e}")
        room_manager.disconnect(websocket, room_id)
