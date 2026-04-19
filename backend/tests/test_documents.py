from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select

from app.config import resolve_database_url
from app.db import create_db_and_tables, engine
from app.main import app
from app.models import Document, DocumentPermission, DocumentVersion, User


client = TestClient(app)


def setup_function():
    create_db_and_tables()
    with Session(engine) as session:
        session.exec(delete(DocumentVersion))
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
    refresh_token = login_response.json()["refresh_token"]

    return {
        "Authorization": f"Bearer {token}",
        "username": username,
        "refresh_token": refresh_token,
    }


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


def test_v1_document_routes_support_bootstrap_and_patch_update():
    headers = create_authenticated_user()

    create_response = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"title": "Spec Document", "content": "<p>Original</p>"},
    )
    assert create_response.status_code == 201
    document_id = create_response.json()["data"]["document"]["id"]

    bootstrap_response = client.get(
        f"/api/v1/documents/{document_id}/bootstrap",
        headers=headers,
    )
    assert bootstrap_response.status_code == 200
    bootstrap_payload = bootstrap_response.json()["data"]
    assert bootstrap_payload["document"]["id"] == document_id
    assert bootstrap_payload["collab"]["roomId"] == f"doc_{document_id}"
    assert bootstrap_payload["collab"]["websocketUrl"] == "/ws"
    assert bootstrap_payload["collab"]["token"]

    patch_response = client.patch(
        f"/api/v1/documents/{document_id}",
        headers=headers,
        json={"title": "Patched title", "content": "<p>Updated</p>"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["data"]["document"]["title"] == "Patched title"
    assert patch_response.json()["data"]["document"]["content"] == "<p>Updated</p>"


def test_refresh_token_issues_new_access_token():
    headers = create_authenticated_user()

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": headers["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    payload = refresh_response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["token_type"] == "bearer"


def test_v1_version_routes_create_list_and_restore_snapshots():
    headers = create_authenticated_user()

    create_response = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"title": "Versioned Doc", "content": "<p>Draft 1</p>"},
    )
    assert create_response.status_code == 201
    document_id = create_response.json()["data"]["document"]["id"]

    first_snapshot = client.post(
        f"/api/v1/documents/{document_id}/versions",
        headers=headers,
        json={"label": "First snapshot"},
    )
    assert first_snapshot.status_code == 201
    first_version_id = first_snapshot.json()["data"]["version"]["id"]

    patch_response = client.patch(
        f"/api/v1/documents/{document_id}",
        headers=headers,
        json={"content": "<p>Draft 2</p>"},
    )
    assert patch_response.status_code == 200

    second_snapshot = client.post(
        f"/api/v1/documents/{document_id}/versions",
        headers=headers,
        json={"label": "Second snapshot"},
    )
    assert second_snapshot.status_code == 201

    versions_response = client.get(
        f"/api/v1/documents/{document_id}/versions",
        headers=headers,
    )
    assert versions_response.status_code == 200
    versions = versions_response.json()["data"]["items"]
    assert len(versions) == 2
    assert versions[0]["title"] == "Second snapshot"
    assert versions[1]["title"] == "First snapshot"

    restore_response = client.post(
        f"/api/v1/documents/{document_id}/versions/{first_version_id}/restore",
        headers=headers,
    )
    assert restore_response.status_code == 200
    restored_document = restore_response.json()["data"]["document"]
    assert restored_document["content"] == "<p>Draft 1</p>"

    versions_after_restore = client.get(
        f"/api/v1/documents/{document_id}/versions",
        headers=headers,
    )
    assert versions_after_restore.status_code == 200
    assert len(versions_after_restore.json()["data"]["items"]) == 3
