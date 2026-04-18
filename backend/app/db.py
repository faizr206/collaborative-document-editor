"""
db.py - Database setup and connection for the collaborative document editor application.
"""

import hashlib
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine, select

from app.config import DATABASE_URL
from app.models import User

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session():
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _ensure_user_is_admin_column()
    _ensure_ai_interaction_columns()
    _ensure_document_version_columns()
    _ensure_document_share_link_columns()


def _ensure_user_is_admin_column():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_admin" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
            )


def _ensure_ai_interaction_columns():
    inspector = inspect(engine)
    if "ai_interactions" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("ai_interactions")
    }
    desired_columns = {
        "request_id": "ALTER TABLE ai_interactions ADD COLUMN request_id VARCHAR DEFAULT ''",
        "context_excerpt": "ALTER TABLE ai_interactions ADD COLUMN context_excerpt VARCHAR DEFAULT ''",
        "options_json": "ALTER TABLE ai_interactions ADD COLUMN options_json VARCHAR DEFAULT '{}'",
        "prompt_text": "ALTER TABLE ai_interactions ADD COLUMN prompt_text VARCHAR DEFAULT ''",
        "prompt_version": "ALTER TABLE ai_interactions ADD COLUMN prompt_version VARCHAR DEFAULT 'v1'",
        "provider_name": "ALTER TABLE ai_interactions ADD COLUMN provider_name VARCHAR DEFAULT 'mock'",
        "model_name": "ALTER TABLE ai_interactions ADD COLUMN model_name VARCHAR DEFAULT 'unknown'",
        "status": "ALTER TABLE ai_interactions ADD COLUMN status VARCHAR DEFAULT 'pending'",
        "review_status": "ALTER TABLE ai_interactions ADD COLUMN review_status VARCHAR DEFAULT 'pending'",
        "error_message": "ALTER TABLE ai_interactions ADD COLUMN error_message VARCHAR",
        "response_chars": "ALTER TABLE ai_interactions ADD COLUMN response_chars INTEGER DEFAULT 0",
        "updated_at": "ALTER TABLE ai_interactions ADD COLUMN updated_at TIMESTAMP",
        "reviewed_at": "ALTER TABLE ai_interactions ADD COLUMN reviewed_at TIMESTAMP",
    }

    with engine.begin() as connection:
        for column_name, statement in desired_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))


def _ensure_document_version_columns():
    inspector = inspect(engine)
    if "document_versions" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("document_versions")
    }
    desired_columns = {
        "label": "ALTER TABLE document_versions ADD COLUMN label VARCHAR DEFAULT ''",
    }

    with engine.begin() as connection:
        for column_name, statement in desired_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))


def _ensure_document_share_link_columns():
    inspector = inspect(engine)
    if "document_share_links" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("document_share_links")
    }
    desired_columns = {
        "token": "ALTER TABLE document_share_links ADD COLUMN token VARCHAR DEFAULT ''",
        "role": "ALTER TABLE document_share_links ADD COLUMN role VARCHAR DEFAULT 'viewer'",
        "login_required": "ALTER TABLE document_share_links ADD COLUMN login_required INTEGER DEFAULT 1",
        "multi_use": "ALTER TABLE document_share_links ADD COLUMN multi_use INTEGER DEFAULT 0",
        "is_active": "ALTER TABLE document_share_links ADD COLUMN is_active INTEGER DEFAULT 1",
        "use_count": "ALTER TABLE document_share_links ADD COLUMN use_count INTEGER DEFAULT 0",
        "expiry": "ALTER TABLE document_share_links ADD COLUMN expiry TIMESTAMP",
    }

    with engine.begin() as connection:
        for column_name, statement in desired_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))
def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_default_user():
    with Session(engine) as session:
        existing_admin = session.exec(
            select(User).where(User.username == "admin")
        ).first()
        if not existing_admin:
            admin_user = User(
                username="admin",
                email="admin@example.com",
                password_hash=_hash_password("pass123"),
                is_admin=1,
            )
            session.add(admin_user)

        existing_user = session.exec(select(User).where(User.id == 1)).first()
        if not existing_user:
            user = User(
                username="testuser",
                email="test@example.com",
                password_hash="fakehash",
            )
            session.add(user)

        session.commit()
