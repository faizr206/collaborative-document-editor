from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session, delete
from starlette.websockets import WebSocketDisconnect

from app.collab import CollaborativeDocument
from app.db import create_db_and_tables, engine
from app.main import app
from app.models import Document, DocumentPermission, User
from app.websocket import connection_rooms, rooms

client = TestClient(app)


def setup_function() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        session.exec(delete(DocumentPermission))
        session.exec(delete(Document))
        session.exec(delete(User).where(User.username.like("wsuser_%")))
        session.commit()
    rooms.clear()
    connection_rooms.clear()


def create_websocket_auth() -> dict[str, str]:
    suffix = uuid4().hex[:8]
    username = f"wsuser_{suffix}"
    password = "secret123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": password,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    document_response = client.post(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"title": "Doc", "content": "AB"},
    )
    assert document_response.status_code == 201
    document_id = document_response.json()["data"]["document"]["id"]

    bootstrap_response = client.get(
        f"/api/v1/documents/{document_id}/bootstrap",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert bootstrap_response.status_code == 200

    return {
        "room_id": bootstrap_response.json()["data"]["collab"]["roomId"],
        "websocket_token": bootstrap_response.json()["data"]["collab"]["token"],
    }


def test_character_crdt_preserves_concurrent_inserts() -> None:
    left_first = CollaborativeDocument(title="Doc", content="AB")
    right_first = CollaborativeDocument(title="Doc", content="AB")

    insert_one = left_first.build_operations_for_document(
        title="Doc", content="A1B", actor_id="alice"
    )
    insert_two = right_first.build_operations_for_document(
        title="Doc", content="A2B", actor_id="bob"
    )

    merged_a = CollaborativeDocument(title="Doc", content="AB")
    merged_a.apply_operations(insert_one)
    merged_a.apply_operations(insert_two)

    merged_b = CollaborativeDocument(title="Doc", content="AB")
    merged_b.apply_operations(insert_two)
    merged_b.apply_operations(insert_one)

    assert merged_a.plain_text()["content"] == merged_b.plain_text()["content"]
    assert merged_a.plain_text()["content"] in {"A12B", "A21B"}


def test_character_crdt_preserves_insert_during_concurrent_delete() -> None:
    deleting_replica = CollaborativeDocument(title="Doc", content="AB")
    inserting_replica = CollaborativeDocument(title="Doc", content="AB")

    delete_b = deleting_replica.build_operations_for_document(
        title="Doc", content="A", actor_id="alice"
    )
    insert_x = inserting_replica.build_operations_for_document(
        title="Doc", content="AXB", actor_id="bob"
    )

    merged_a = CollaborativeDocument(title="Doc", content="AB")
    merged_a.apply_operations(delete_b)
    merged_a.apply_operations(insert_x)

    merged_b = CollaborativeDocument(title="Doc", content="AB")
    merged_b.apply_operations(insert_x)
    merged_b.apply_operations(delete_b)

    assert merged_a.plain_text()["content"] == "AX"
    assert merged_b.plain_text()["content"] == "AX"


def test_websocket_syncs_operation_based_updates_between_clients() -> None:
    auth = create_websocket_auth()
    room_id = auth["room_id"]
    websocket_url = f"/ws?token={auth['websocket_token']}"

    with client.websocket_connect(websocket_url) as ws1:
        ws1.send_json(
            {
                "type": "join",
                "roomId": room_id,
                "clientId": "client_1",
                "user": {
                    "userId": "usr_1",
                    "displayName": "Alice",
                    "color": "#111111",
                    "initials": "A",
                    "active": True,
                    "isSelf": True,
                },
                "document": {"title": "Doc", "content": "AB"},
            }
        )
        sync_1 = ws1.receive_json()
        assert sync_1["type"] == "sync"
        assert sync_1["document"] == {"title": "Doc", "content": "AB"}

        with client.websocket_connect(websocket_url) as ws2:
            ws2.send_json(
                {
                    "type": "join",
                    "roomId": room_id,
                    "clientId": "client_2",
                    "user": {
                        "userId": "usr_2",
                        "displayName": "Bob",
                        "color": "#222222",
                        "initials": "B",
                        "active": True,
                        "isSelf": True,
                    },
                    "document": {"title": "Doc", "content": "AB"},
                }
            )
            sync_2 = ws2.receive_json()
            assert sync_2["type"] == "sync"
            join_notice = ws1.receive_json()
            assert join_notice["type"] == "presence"
            assert join_notice["action"] == "join"

            replica_one = CollaborativeDocument.from_state(sync_1["state"])
            replica_two = CollaborativeDocument.from_state(sync_2["state"])
            insert_one = replica_one.build_operations_for_document(
                title="Doc", content="A1B", actor_id="client_1"
            )
            insert_two = replica_two.build_operations_for_document(
                title="Doc", content="A2B", actor_id="client_2"
            )

            ws1.send_json(
                {
                    "type": "operations",
                    "roomId": room_id,
                    "clientId": "client_1",
                    "operations": insert_one,
                }
            )
            update_for_ws2 = ws2.receive_json()
            assert update_for_ws2["type"] == "operations"

            ws2.send_json(
                {
                    "type": "operations",
                    "roomId": room_id,
                    "clientId": "client_2",
                    "operations": insert_two,
                }
            )
            update_for_ws1 = ws1.receive_json()
            assert update_for_ws1["type"] == "operations"
            assert update_for_ws2["document"]["content"] == "A1B"
            assert update_for_ws1["document"]["content"] in {"A12B", "A21B"}

            with client.websocket_connect(websocket_url) as ws3:
                ws3.send_json(
                    {
                        "type": "join",
                        "roomId": room_id,
                        "clientId": "client_3",
                        "user": {
                            "userId": "usr_3",
                            "displayName": "Cara",
                            "color": "#333333",
                            "initials": "C",
                            "active": True,
                            "isSelf": True,
                        },
                        "document": {"title": "Doc", "content": ""},
                    }
                )
                sync_3 = ws3.receive_json()
                assert sync_3["type"] == "sync"
                assert (
                    sync_3["document"]["content"]
                    == update_for_ws1["document"]["content"]
                )
                ws1_presence_join = ws1.receive_json()
                assert ws1_presence_join["type"] == "presence"
                assert ws1_presence_join["action"] == "join"

        leave_notice = ws1.receive_json()
        assert leave_notice["type"] == "presence"
        assert leave_notice["action"] == "leave"


def test_websocket_broadcasts_cursor_and_selection_awareness() -> None:
    auth = create_websocket_auth()
    room_id = auth["room_id"]
    websocket_url = f"/ws?token={auth['websocket_token']}"

    with client.websocket_connect(websocket_url) as ws1:
        ws1.send_json(
            {
                "type": "join",
                "roomId": room_id,
                "clientId": "client_1",
                "user": {
                    "userId": "usr_1",
                    "displayName": "Alice",
                    "color": "#111111",
                    "initials": "A",
                    "active": True,
                    "isSelf": True,
                },
                "document": {"title": "Doc", "content": "Hello"},
            }
        )
        ws1.receive_json()

        with client.websocket_connect(websocket_url) as ws2:
            ws2.send_json(
                {
                    "type": "join",
                    "roomId": room_id,
                    "clientId": "client_2",
                    "user": {
                        "userId": "usr_2",
                        "displayName": "Bob",
                        "color": "#222222",
                        "initials": "B",
                        "active": True,
                        "isSelf": True,
                    },
                    "document": {"title": "Doc", "content": "Hello"},
                }
            )
            ws2.receive_json()
            ws1.receive_json()

            ws1.send_json(
                {
                    "type": "awareness",
                    "roomId": room_id,
                    "clientId": "client_1",
                    "awareness": {
                        "activity": "selecting",
                        "activityLabel": "Selecting 5 characters",
                        "cursorPos": 5,
                        "selection": {"from": 1, "to": 5, "text": "Hell"},
                        "lastActiveAt": "2026-04-16T14:00:00Z",
                    },
                }
            )

            awareness = ws2.receive_json()
            assert awareness["type"] == "awareness"
            assert awareness["user"]["activity"] == "selecting"
            assert awareness["user"]["activityLabel"] == "Selecting 5 characters"
            assert awareness["user"]["cursorPos"] == 5
            assert awareness["user"]["selection"] == {
                "from": 1,
                "to": 5,
                "text": "Hell",
            }
            replica = CollaborativeDocument(title="Doc", content="Hello")
            operations = replica.build_operations_for_document(
                title="Doc",
                content="Hello!",
                actor_id="client_1",
            )
            ws1.send_json(
                {
                    "type": "operations",
                    "roomId": room_id,
                    "clientId": "client_1",
                    "operations": operations,
                }
            )

            operation_update = ws2.receive_json()
            assert operation_update["type"] == "operations"
            assert operation_update["user"]["activity"] == "selecting"
            assert operation_update["user"]["cursorPos"] == 5
            assert operation_update["user"]["selection"] == {
                "from": 1,
                "to": 5,
                "text": "Hell",
            }


def test_websocket_rejects_missing_token() -> None:
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws"):
            pass
