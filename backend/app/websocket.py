from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.collab import CollaborativeDocument

router = APIRouter()


@dataclass(slots=True)
class Connection:
    websocket: WebSocket
    client_id: str
    user: dict[str, Any]
    awareness: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class RoomState:
    document: CollaborativeDocument
    connections: dict[str, Connection] = field(default_factory=dict)


rooms: dict[str, RoomState] = {}
connection_rooms: dict[WebSocket, str] = {}


async def send_message(websocket: WebSocket, message: dict[str, Any]) -> None:
    await websocket.send_json(message)


async def broadcast(room: RoomState, message: dict[str, Any], *, exclude_client_id: str | None = None) -> None:
    disconnected: list[str] = []

    for client_id, connection in room.connections.items():
        if exclude_client_id and client_id == exclude_client_id:
            continue

        try:
            await connection.websocket.send_json(message)
        except Exception:
            disconnected.append(client_id)

    for client_id in disconnected:
        room.connections.pop(client_id, None)


def _presence_users(room: RoomState) -> list[dict[str, Any]]:
    return [
        _serialize_connection_user(connection)
        for connection in room.connections.values()
    ]


def _serialize_connection_user(connection: Connection) -> dict[str, Any]:
    return {
        **connection.user,
        "activity": connection.awareness.get("activity", "idle"),
        "activityLabel": connection.awareness.get("activityLabel"),
        "cursorPos": connection.awareness.get("cursorPos"),
        "selection": connection.awareness.get("selection"),
        "lastActiveAt": connection.awareness.get("lastActiveAt"),
    }


def _ensure_room(room_id: str, initial_document: dict[str, str] | None) -> RoomState:
    room = rooms.get(room_id)
    if room:
        return room

    seed = initial_document or {"title": "", "content": ""}
    room = RoomState(
        document=CollaborativeDocument(title=seed.get("title", ""), content=seed.get("content", ""))
    )
    rooms[room_id] = room
    return room


def _prune_room(room_id: str) -> None:
    room = rooms.get(room_id)
    if room and not room.connections:
        rooms.pop(room_id, None)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    client_id: str | None = None
    room_id: str | None = None

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "join":
                room_id = str(message.get("roomId", ""))
                client_id = str(message.get("clientId", ""))
                user = message.get("user")

                if not room_id or not client_id or not isinstance(user, dict):
                    await send_message(
                        websocket,
                        {"type": "error", "message": "Invalid join payload."},
                    )
                    continue

                room = _ensure_room(room_id, message.get("document"))
                room.connections[client_id] = Connection(websocket=websocket, client_id=client_id, user=user)
                connection_rooms[websocket] = room_id

                await send_message(
                    websocket,
                    {
                        "type": "sync",
                        "roomId": room_id,
                        "state": room.document.serialize_state(),
                        "document": room.document.plain_text(),
                        "collaborators": _presence_users(room),
                    },
                )

                await broadcast(
                    room,
                    {
                        "type": "presence",
                        "action": "join",
                        "roomId": room_id,
                        "clientId": client_id,
                        "user": user,
                    },
                    exclude_client_id=client_id,
                )
                continue

            if not room_id or not client_id:
                await send_message(websocket, {"type": "error", "message": "Join the room before editing."})
                continue

            room = rooms.get(room_id)
            if not room:
                await send_message(websocket, {"type": "error", "message": "Room not found."})
                continue

            if message_type == "operations":
                operations = message.get("operations")
                if not isinstance(operations, dict):
                    await send_message(
                        websocket,
                        {"type": "error", "message": "Invalid operations payload."},
                    )
                    continue

                room.document.apply_operations(operations)
                await broadcast(
                    room,
                    {
                        "type": "operations",
                        "roomId": room_id,
                        "clientId": client_id,
                        "user": _serialize_connection_user(room.connections[client_id]),
                        "operations": operations,
                        "document": room.document.plain_text(),
                    },
                    exclude_client_id=client_id,
                )
                continue

            if message_type == "awareness":
                awareness = message.get("awareness")
                if not isinstance(awareness, dict):
                    await send_message(
                        websocket,
                        {"type": "error", "message": "Invalid awareness payload."},
                    )
                    continue

                connection = room.connections.get(client_id)
                if not connection:
                    await send_message(websocket, {"type": "error", "message": "Connection not found."})
                    continue

                connection.awareness = awareness
                await broadcast(
                    room,
                    {
                        "type": "awareness",
                        "roomId": room_id,
                        "clientId": client_id,
                        "user": {
                            **connection.user,
                            "activity": awareness.get("activity", "idle"),
                            "activityLabel": awareness.get("activityLabel"),
                            "cursorPos": awareness.get("cursorPos"),
                            "selection": awareness.get("selection"),
                            "lastActiveAt": awareness.get("lastActiveAt"),
                        },
                    },
                    exclude_client_id=client_id,
                )
                continue

            if message_type == "leave":
                break

            await send_message(websocket, {"type": "error", "message": "Unsupported websocket message."})

    except WebSocketDisconnect:
        pass
    finally:
        room_id = connection_rooms.pop(websocket, room_id)
        if room_id and client_id:
            room = rooms.get(room_id)
            if room:
                connection = room.connections.pop(client_id, None)
                if connection:
                    await broadcast(
                        room,
                        {
                            "type": "presence",
                            "action": "leave",
                            "roomId": room_id,
                            "clientId": client_id,
                            "user": connection.user,
                        },
                    )
                _prune_room(room_id)
