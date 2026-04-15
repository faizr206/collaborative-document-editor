from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_websocket_connection():
    with client.websocket_connect("/ws") as websocket:
        message = websocket.receive_text()
        assert "User joined" in message