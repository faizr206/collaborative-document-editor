from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlmodel import Session

from app.access import require_document_role
from app.auth import decode_token
from app.collab import CollaborativeDocument
from app.db import engine
from app.models import User

router = APIRouter()


@dataclass(slots=True)
class Connection:
    websocket: WebSocket
    client_id: str
    user_id: int
    role: str
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


async def broadcast(
    room: RoomState, message: dict[str, Any], *, exclude_client_id: str | None = None
) -> None:
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
        document=CollaborativeDocument(
            title=seed.get("title", ""), content=seed.get("content", "")
        )
    )
    rooms[room_id] = room
    return room


def _prune_room(room_id: str) -> None:
    room = rooms.get(room_id)
    if room and not room.connections:
        rooms.pop(room_id, None)


def _build_presence_user(
    authenticated_user: User, requested_user: dict[str, Any] | None
) -> dict[str, Any]:
    color = requested_user.get("color") if isinstance(requested_user, dict) else None
    initials = (
        requested_user.get("initials") if isinstance(requested_user, dict) else None
    )

    return {
        "userId": str(authenticated_user.id),
        "displayName": authenticated_user.username,
        "color": color if isinstance(color, str) and color else "#295eff",
        "initials": initials
        if isinstance(initials, str) and initials
        else authenticated_user.username[:2].upper(),
        "active": True,
        "isSelf": True,
    }


def _authenticate_websocket(token: str | None) -> tuple[User, int, str, str]:
    if not token:
        raise HTTPException(status_code=401, detail="Missing websocket token")

    _, payload = decode_token(token, expected_types={"collab"})

    user_id = payload.get("uid")
    document_id = payload.get("doc")
    room_id = payload.get("roomId")
    username = payload.get("sub")

    if (
        not isinstance(user_id, int)
        or not isinstance(document_id, int)
        or not isinstance(room_id, str)
        or not room_id
        or not isinstance(username, str)
        or not username
    ):
        raise HTTPException(status_code=401, detail="Invalid websocket token")

    with Session(engine) as session:
        user = session.get(User, user_id)
        if user is None or user.username != username:
            raise HTTPException(status_code=401, detail="Invalid websocket token")

        _, role = require_document_role(session, document_id, user.id, "viewer")

    return user, document_id, room_id, role


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, token: str | None = Query(default=None)
) -> None:
    try:
        authenticated_user, _document_id, expected_room_id, document_role = (
            _authenticate_websocket(token)
        )
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

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
                requested_user = message.get("user")

                if (
                    not room_id
                    or not client_id
                    or room_id != expected_room_id
                    or not isinstance(requested_user, dict)
                ):
                    await send_message(
                        websocket,
                        {"type": "error", "message": "Invalid join payload."},
                    )
                    break

                user = _build_presence_user(authenticated_user, requested_user)
                room = _ensure_room(room_id, message.get("document"))
                room.connections[client_id] = Connection(
                    websocket=websocket,
                    client_id=client_id,
                    user_id=authenticated_user.id,
                    role=document_role,
                    user=user,
                )
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
                await send_message(
                    websocket,
                    {"type": "error", "message": "Join the room before editing."},
                )
                continue

            room = rooms.get(room_id)
            if not room:
                await send_message(
                    websocket,
                    {"type": "error", "message": "Room not found."},
                )
                continue

            if message_type == "operations":
                connection = room.connections.get(client_id)
                if not connection:
                    await send_message(
                        websocket,
                        {"type": "error", "message": "Connection not found."},
                    )
                    continue

                if connection.role == "viewer":
                    await send_message(
                        websocket,
                        {
                            "type": "error",
                            "message": "You do not have permission to edit this document.",
                        },
                    )
                    continue

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
                        "user": _serialize_connection_user(connection),
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
                    await send_message(
                        websocket,
                        {"type": "error", "message": "Connection not found."},
                    )
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

            await send_message(
                websocket,
                {"type": "error", "message": "Unsupported websocket message."},
            )

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
