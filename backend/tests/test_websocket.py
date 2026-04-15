from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_websocket_connect_and_broadcast():
    with client.websocket_connect("/ws") as ws1:
        msg1 = ws1.receive_text()
        assert "User joined" in msg1

        with client.websocket_connect("/ws") as ws2:
            # one or both clients may receive a join message
            got_join_1 = ws1.receive_text()
            got_join_2 = ws2.receive_text()

            assert "User joined" in got_join_1 or "User joined" in got_join_2

            ws1.send_text("hello")

            received_1 = ws1.receive_text()
            received_2 = ws2.receive_text()

            assert received_1 == "hello"
            assert received_2 == "hello"