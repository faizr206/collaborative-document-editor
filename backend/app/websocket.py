from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

active_connections: list[WebSocket] = []


async def broadcast(message: str):
    disconnected = []

    for connection in active_connections:
        try:
            await connection.send_text(message)
        except Exception:
            disconnected.append(connection)

    for connection in disconnected:
        if connection in active_connections:
            active_connections.remove(connection)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)

    await broadcast(f"User joined. Total: {len(active_connections)}")

    try:
        while True:
            data = await websocket.receive_text()
            await broadcast(data)

    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
        await broadcast(f"User left. Total: {len(active_connections)}")

    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)
        await broadcast(f"User left. Total: {len(active_connections)}")