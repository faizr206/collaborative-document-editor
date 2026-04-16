import json

from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.db import create_db_and_tables, engine
from app.main import app
from app.models import AIInteraction, Document


def setup_function():
    create_db_and_tables()
    with Session(engine) as session:
        session.exec(delete(AIInteraction))
        session.exec(delete(Document))
        session.commit()


def create_document() -> int:
    with Session(engine) as session:
        document = Document(
            title="Backend AI Test",
            content=(
                "Alpha paragraph. The quick brown fox jumps over the lazy dog. "
                "Second paragraph with collaboration context for AI features."
            ),
            owner_id=1,
        )
        session.add(document)
        session.commit()
        session.refresh(document)
        return document.id


def test_create_ai_suggestion_and_history():
    document_id = create_document()

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/suggest",
            json={
                "action_type": "rewrite",
                "source_text": "The quick brown fox jumps over the lazy dog.",
                "context": "",
                "instruction": "formal tone",
                "document_id": document_id,
                "user_id": 1,
                "options": {"tone": "formal"},
            },
        )

        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["status"] == "completed"
        assert payload["provider"] == "mock"
        assert payload["promptText"]
        assert "formal" in payload["resultText"]

        history_response = client.get(f"/api/ai/history/{document_id}", params={"user_id": 1})
        assert history_response.status_code == 200
        history_items = history_response.json()["data"]["items"]
        assert len(history_items) == 1
        assert history_items[0]["actionType"] == "rewrite"


def test_stream_ai_suggestion_emits_chunk_and_complete_events():
    document_id = create_document()

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/stream",
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

        complete_lines = [line for line in body.splitlines() if line.startswith("data: ")]
        complete_payload = json.loads(complete_lines[-1][6:])
        assert complete_payload["status"] == "completed"
        assert complete_payload["text"].startswith("Summary:")


def test_review_ai_interaction_updates_status():
    document_id = create_document()

    with TestClient(app) as client:
        create_response = client.post(
            "/api/ai/suggest",
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
            params={"user_id": 1},
            json={
                "review_status": "edited",
                "edited_text": "I am testing grammar.",
            },
        )

        assert review_response.status_code == 200
        reviewed_payload = review_response.json()["data"]
        assert reviewed_payload["reviewStatus"] == "edited"
        assert reviewed_payload["resultText"] == "I am testing grammar."
