from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.config import resolve_database_url
from app.db import engine
from app.main import app
from app.models import User


client = TestClient(app)


def create_authenticated_user() -> dict[str, str]:
    suffix = uuid4().hex[:8]
    username = f"docuser_{suffix}"
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
    token = login_response.json()["access_token"]

    return {"Authorization": f"Bearer {token}", "username": username}


def test_document_updates_persist_across_reload():
    headers = create_authenticated_user()

    create_response = client.post(
        "/api/documents",
        headers=headers,
        json={"title": "Draft", "content": "<p>Initial</p>"},
    )
    assert create_response.status_code == 201
    document_id = create_response.json()["data"]["document"]["id"]

    update_response = client.put(
        f"/api/documents/{document_id}",
        headers=headers,
        json={"title": "Draft", "content": "<p>Saved body</p>"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["document"]["content"] == "<p>Saved body</p>"

    get_response = client.get(f"/api/documents/{document_id}")
    assert get_response.status_code == 200
    payload = get_response.json()["data"]["document"]
    assert payload["title"] == "Draft"
    assert payload["content"] == "<p>Saved body</p>"


def test_list_documents_returns_only_user_owned_or_permitted_documents():
    owner_headers = create_authenticated_user()
    other_headers = create_authenticated_user()

    owner_create = client.post(
        "/api/documents",
        headers=owner_headers,
        json={"title": "Owner Doc", "content": "<p>Owner</p>"},
    )
    assert owner_create.status_code == 201
    owner_doc_id = owner_create.json()["data"]["document"]["id"]

    other_create = client.post(
        "/api/documents",
        headers=other_headers,
        json={"title": "Other Doc", "content": "<p>Other</p>"},
    )
    assert other_create.status_code == 201
    other_doc_id = other_create.json()["data"]["document"]["id"]

    list_response = client.get("/api/documents/my/documents", headers=owner_headers)
    assert list_response.status_code == 200

    items = list_response.json()["data"]["items"]
    assert any(item["id"] == owner_doc_id for item in items)
    assert all(item["id"] != other_doc_id for item in items)


def test_list_documents_returns_permitted_documents_for_user():
    owner = create_authenticated_user()
    collaborator = create_authenticated_user()

    create_response = client.post(
        "/api/documents",
        headers=owner,
        json={"title": "Shared Doc", "content": "<p>Shared</p>"},
    )
    assert create_response.status_code == 201
    document_id = create_response.json()["data"]["document"]["id"]

    with Session(engine) as session:
        collaborator_user = session.exec(select(User).where(User.username == collaborator["username"])).first()
        assert collaborator_user is not None
        collaborator_id = collaborator_user.id

    grant_response = client.post(
        "/api/permissions/grant",
        json={
            "document_id": document_id,
            "user_id": collaborator_id,
            "permission": "read",
        },
    )
    assert grant_response.status_code == 201

    list_response = client.get("/api/documents/my/documents", headers=collaborator)
    assert list_response.status_code == 200

    items = list_response.json()["data"]["items"]
    assert any(item["id"] == document_id for item in items)


def test_resolve_database_url_uses_repo_stable_sqlite_location():
    resolved = resolve_database_url("sqlite:///./sqlite.db")
    assert resolved.endswith("/backend/sqlite.db")

    resolved_backend_path = resolve_database_url("sqlite:///backend/sqlite.db")
    assert resolved_backend_path.endswith("/backend/sqlite.db")
