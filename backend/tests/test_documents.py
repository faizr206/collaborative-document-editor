from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select

from app.config import resolve_database_url
from app.db import engine
from app.main import app
from app.models import Document, DocumentPermission, User


client = TestClient(app)


def setup_function():
    with Session(engine) as session:
        session.exec(delete(DocumentPermission))
        session.exec(delete(Document))
        session.commit()


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


def get_user_id(username: str) -> int:
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        assert user is not None
        return user.id


def share_document(
    owner_headers: dict[str, str], document_id: int, identifier: str, role: str
):
    response = client.post(
        f"/api/permissions/documents/{document_id}/members",
        headers=owner_headers,
        json={"identifier": identifier, "role": role},
    )
    assert response.status_code == 201
    return response


def test_document_updates_persist_across_reload_for_editor():
    owner_headers = create_authenticated_user()
    editor_headers = create_authenticated_user()

    create_response = client.post(
        "/api/documents",
        headers=owner_headers,
        json={"title": "Draft", "content": "<p>Initial</p>"},
    )
    assert create_response.status_code == 201
    document_id = create_response.json()["data"]["document"]["id"]

    share_document(owner_headers, document_id, editor_headers["username"], "editor")

    update_response = client.put(
        f"/api/documents/{document_id}",
        headers=editor_headers,
        json={"title": "Draft", "content": "<p>Saved body</p>"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["document"]["content"] == "<p>Saved body</p>"
    assert update_response.json()["data"]["document"]["role"] == "editor"

    get_response = client.get(f"/api/documents/{document_id}", headers=editor_headers)
    assert get_response.status_code == 200
    payload = get_response.json()["data"]["document"]
    assert payload["title"] == "Draft"
    assert payload["content"] == "<p>Saved body</p>"
    assert payload["role"] == "editor"


def test_list_documents_returns_only_user_accessible_documents():
    owner_headers = create_authenticated_user()
    viewer_headers = create_authenticated_user()
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

    share_document(owner_headers, owner_doc_id, viewer_headers["username"], "viewer")

    list_response = client.get("/api/documents", headers=viewer_headers)
    assert list_response.status_code == 200

    items = list_response.json()["data"]["items"]
    assert any(
        item["id"] == owner_doc_id and item["role"] == "viewer" for item in items
    )
    assert all(item["id"] != other_doc_id for item in items)


def test_viewer_cannot_modify_document_with_direct_api_request():
    owner_headers = create_authenticated_user()
    viewer_headers = create_authenticated_user()

    create_response = client.post(
        "/api/documents",
        headers=owner_headers,
        json={"title": "Shared Doc", "content": "<p>Original</p>"},
    )
    document_id = create_response.json()["data"]["document"]["id"]
    share_document(owner_headers, document_id, viewer_headers["username"], "viewer")

    update_response = client.put(
        f"/api/documents/{document_id}",
        headers=viewer_headers,
        json={"title": "Tampered", "content": "<p>Blocked</p>"},
    )

    assert update_response.status_code == 403


def test_editor_cannot_manage_sharing_or_delete_document():
    owner_headers = create_authenticated_user()
    editor_headers = create_authenticated_user()
    third_headers = create_authenticated_user()

    create_response = client.post(
        "/api/documents",
        headers=owner_headers,
        json={"title": "Shared Doc", "content": "<p>Original</p>"},
    )
    document_id = create_response.json()["data"]["document"]["id"]
    share_document(owner_headers, document_id, editor_headers["username"], "editor")

    grant_response = client.post(
        f"/api/permissions/documents/{document_id}/members",
        headers=editor_headers,
        json={"identifier": third_headers["username"], "role": "viewer"},
    )
    assert grant_response.status_code == 403

    delete_response = client.delete(
        f"/api/documents/{document_id}", headers=editor_headers
    )
    assert delete_response.status_code == 403


def test_owner_can_share_by_email_and_remove_member():
    owner_headers = create_authenticated_user()
    viewer_headers = create_authenticated_user()

    create_response = client.post(
        "/api/documents",
        headers=owner_headers,
        json={"title": "Shared Doc", "content": "<p>Original</p>"},
    )
    document_id = create_response.json()["data"]["document"]["id"]

    viewer_id = get_user_id(viewer_headers["username"])
    share_response = client.post(
        f"/api/permissions/documents/{document_id}/members",
        headers=owner_headers,
        json={
            "identifier": f"{viewer_headers['username']}@example.com",
            "role": "viewer",
        },
    )
    assert share_response.status_code == 201
    assert share_response.json()["permission"] == "viewer"

    list_response = client.get(
        f"/api/permissions/documents/{document_id}", headers=owner_headers
    )
    assert list_response.status_code == 200
    users = list_response.json()["users"]
    assert any(
        user["user_id"] == viewer_id and user["permission"] == "viewer"
        for user in users
    )

    remove_response = client.delete(
        f"/api/permissions/documents/{document_id}/members/{viewer_id}",
        headers=owner_headers,
    )
    assert remove_response.status_code == 204


def test_resolve_database_url_uses_repo_stable_sqlite_location():
    resolved = resolve_database_url("sqlite:///./sqlite.db")
    assert resolved.endswith("/backend/sqlite.db")

    resolved_backend_path = resolve_database_url("sqlite:///backend/sqlite.db")
    assert resolved_backend_path.endswith("/backend/sqlite.db")
