"""
db.py - Database setup and connection for the collaborative document editor application.
"""

from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import Document, DocumentPermission, DocumentVersion, User

DATABASE_URL = "sqlite:///./sqlite.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session():
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _ensure_ai_interaction_columns()


def _ensure_ai_interaction_columns():
    inspector = inspect(engine)
    if "ai_interactions" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("ai_interactions")}
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


def create_default_user():
    with Session(engine) as session:
        existing_user = session.exec(select(User).where(User.id == 1)).first()

        if not existing_user:
            user = User(
                username="testuser",
                email="test@example.com",
                password_hash="fakehash",
            )
            session.add(user)
            session.commit()
