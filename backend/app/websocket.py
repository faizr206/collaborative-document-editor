from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

active_connections: list[WebSocket] = []
document_text = ""  # shared document state


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
    global document_text

    await websocket.accept()
    active_connections.append(websocket)

    # send current document to new user
    await websocket.send_text(f"DOCUMENT:{document_text}")

    await broadcast(f"User joined. Total: {len(active_connections)}")

    try:
        while True:
            data = await websocket.receive_text()

            # BONUS: simple conflict handling
            if data.startswith("EDIT:"):
                # format: EDIT:<new_text>
                new_text = data.replace("EDIT:", "")
                document_text = new_text
                await broadcast(f"DOCUMENT:{document_text}")
            else:
                await broadcast(data)

    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
        await broadcast(f"User left. Total: {len(active_connections)}")

    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)
        await broadcast(f"User left. Total: {len(active_connections)}")