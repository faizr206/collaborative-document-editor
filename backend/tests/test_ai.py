import json
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.ai.provider import MockLLMProvider
from app.db import create_db_and_tables, engine
from app.main import app
from app.models import AIInteraction, Document, DocumentPermission
from app.routes.ai import ai_service


def setup_function():
    create_db_and_tables()
    ai_service.provider = MockLLMProvider()
    with Session(engine) as session:
        session.exec(delete(DocumentPermission))
        session.exec(delete(AIInteraction))
        session.exec(delete(Document))
        session.commit()


def create_authenticated_user(client: TestClient) -> dict[str, str]:
    suffix = uuid4().hex[:8]
    username = f"aiuser_{suffix}"
    password = "secret123"

    register_response = client.post(
        "/user_auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": password,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/user_auth/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200

    return {
        "Authorization": f"Bearer {login_response.json()['access_token']}",
        "username": username,
    }


def create_document(client: TestClient, headers: dict[str, str]) -> int:
    response = client.post(
        "/api/documents",
        headers=headers,
        json={
            "title": "Backend AI Test",
            "content": (
                "Alpha paragraph. The quick brown fox jumps over the lazy dog. "
                "Second paragraph with collaboration context for AI features."
            ),
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["document"]["id"]


def share_document(
    client: TestClient,
    owner_headers: dict[str, str],
    document_id: int,
    identifier: str,
    role: str,
):
    response = client.post(
        f"/api/permissions/documents/{document_id}/members",
        headers=owner_headers,
        json={"identifier": identifier, "role": role},
    )
    assert response.status_code == 201


def test_create_ai_suggestion_and_history_for_editor():
    with TestClient(app) as client:
        owner_headers = create_authenticated_user(client)
        editor_headers = create_authenticated_user(client)
        document_id = create_document(client, owner_headers)
        share_document(
            client, owner_headers, document_id, editor_headers["username"], "editor"
        )

        response = client.post(
            "/api/ai/suggest",
            headers=editor_headers,
            json={
                "action_type": "rewrite",
                "source_text": "The quick brown fox jumps over the lazy dog.",
                "context": "",
                "instruction": "formal tone",
                "document_id": document_id,
                "user_id": 9999,
                "options": {"tone": "formal"},
            },
        )

        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["status"] == "completed"
        assert payload["provider"] == "mock"
        assert payload["promptText"]
        assert "formal" in payload["resultText"]

        history_response = client.get(
            f"/api/ai/history/{document_id}", headers=editor_headers
        )
        assert history_response.status_code == 200
        history_items = history_response.json()["data"]["items"]
        assert len(history_items) == 1
        assert history_items[0]["actionType"] == "rewrite"
        assert history_items[0]["userId"] != 9999


def test_stream_ai_suggestion_emits_chunk_and_complete_events():
    with TestClient(app) as client:
        owner_headers = create_authenticated_user(client)
        editor_headers = create_authenticated_user(client)
        document_id = create_document(client, owner_headers)
        share_document(
            client, owner_headers, document_id, editor_headers["username"], "editor"
        )

        response = client.post(
            "/api/ai/stream",
            headers=editor_headers,
            json={
                "action_type": "summarize",
                "source_text": "The quick brown fox jumps over the lazy dog and keeps running through the field.",
                "context": "",
                "instruction": "",
                "document_id": document_id,
                "user_id": 1,
                "options": {"length": "short", "format": "paragraph"},
            },
        )

        assert response.status_code == 200
        body = response.text
        assert "event: start" in body
        assert "event: chunk" in body
        assert "event: complete" in body

        complete_lines = [
            line for line in body.splitlines() if line.startswith("data: ")
        ]
        complete_payload = json.loads(complete_lines[-1][6:])
        assert complete_payload["status"] == "completed"
        assert complete_payload["text"].startswith("Summary:")


def test_review_ai_interaction_updates_status():
    with TestClient(app) as client:
        owner_headers = create_authenticated_user(client)
        document_id = create_document(client, owner_headers)

        create_response = client.post(
            "/api/ai/suggest",
            headers=owner_headers,
            json={
                "action_type": "fix_grammar",
                "source_text": "i am testing grammar .",
                "context": "",
                "instruction": "",
                "document_id": document_id,
                "user_id": 1,
                "options": {},
            },
        )

        interaction_id = create_response.json()["data"]["id"]

        review_response = client.post(
            f"/api/ai/interactions/{interaction_id}/review",
            headers=owner_headers,
            json={
                "review_status": "edited",
                "edited_text": "I am testing grammar.",
            },
        )

        assert review_response.status_code == 200
        reviewed_payload = review_response.json()["data"]
        assert reviewed_payload["reviewStatus"] == "edited"
        assert reviewed_payload["resultText"] == "I am testing grammar."


def test_viewer_cannot_use_ai_with_direct_api_request():
    with TestClient(app) as client:
        owner_headers = create_authenticated_user(client)
        viewer_headers = create_authenticated_user(client)
        document_id = create_document(client, owner_headers)
        share_document(
            client, owner_headers, document_id, viewer_headers["username"], "viewer"
        )

        response = client.post(
            "/api/ai/suggest",
            headers=viewer_headers,
            json={
                "action_type": "rewrite",
                "source_text": "Attempting to bypass UI",
                "context": "",
                "instruction": "",
                "document_id": document_id,
                "user_id": 1,
                "options": {},
            },
        )

        assert response.status_code == 403
