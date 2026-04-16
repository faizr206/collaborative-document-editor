from fastapi.testclient import TestClient

from app.collab import CollaborativeDocument
from app.main import app
from app.websocket import connection_rooms, rooms

client = TestClient(app)


def setup_function() -> None:
    rooms.clear()
    connection_rooms.clear()


def test_character_crdt_preserves_concurrent_inserts() -> None:
    left_first = CollaborativeDocument(title="Doc", content="AB")
    right_first = CollaborativeDocument(title="Doc", content="AB")

    insert_one = left_first.build_operations_for_document(title="Doc", content="A1B", actor_id="alice")
    insert_two = right_first.build_operations_for_document(title="Doc", content="A2B", actor_id="bob")

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

    delete_b = deleting_replica.build_operations_for_document(title="Doc", content="A", actor_id="alice")
    insert_x = inserting_replica.build_operations_for_document(title="Doc", content="AXB", actor_id="bob")

    merged_a = CollaborativeDocument(title="Doc", content="AB")
    merged_a.apply_operations(delete_b)
    merged_a.apply_operations(insert_x)

    merged_b = CollaborativeDocument(title="Doc", content="AB")
    merged_b.apply_operations(insert_x)
    merged_b.apply_operations(delete_b)

    assert merged_a.plain_text()["content"] == "AX"
    assert merged_b.plain_text()["content"] == "AX"


def test_websocket_syncs_operation_based_updates_between_clients() -> None:
    with client.websocket_connect("/ws") as ws1:
        ws1.send_json(
            {
                "type": "join",
                "roomId": "doc_1",
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

        with client.websocket_connect("/ws") as ws2:
            ws2.send_json(
                {
                    "type": "join",
                    "roomId": "doc_1",
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
                    "roomId": "doc_1",
                    "clientId": "client_1",
                    "operations": insert_one,
                }
            )
            update_for_ws2 = ws2.receive_json()
            assert update_for_ws2["type"] == "operations"

            ws2.send_json(
                {
                    "type": "operations",
                    "roomId": "doc_1",
                    "clientId": "client_2",
                    "operations": insert_two,
                }
            )
            update_for_ws1 = ws1.receive_json()
            assert update_for_ws1["type"] == "operations"
            assert update_for_ws2["document"]["content"] == "A1B"
            assert update_for_ws1["document"]["content"] in {"A12B", "A21B"}

            with client.websocket_connect("/ws") as ws3:
                ws3.send_json(
                    {
                        "type": "join",
                        "roomId": "doc_1",
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
                assert sync_3["document"]["content"] == update_for_ws1["document"]["content"]
                ws1_presence_join = ws1.receive_json()
                assert ws1_presence_join["type"] == "presence"
                assert ws1_presence_join["action"] == "join"

        leave_notice = ws1.receive_json()
        assert leave_notice["type"] == "presence"
        assert leave_notice["action"] == "leave"
