from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import resolve_database_url
from app.main import app


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

    return {"Authorization": f"Bearer {token}"}


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


def test_resolve_database_url_uses_repo_stable_sqlite_location():
    resolved = resolve_database_url("sqlite:///./sqlite.db")
    assert resolved.endswith("/backend/sqlite.db")

    resolved_backend_path = resolve_database_url("sqlite:///backend/sqlite.db")
    assert resolved_backend_path.endswith("/backend/sqlite.db")
