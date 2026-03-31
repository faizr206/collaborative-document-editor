"""
db.py - Database setup and connection for the collaborative document editor application.
"""
from sqlmodel import SQLModel, create_engine, Session,select

from app.models import User, Document, DocumentPermission, DocumentVersion

DATABASE_URL = "postgresql://localhost:5432/collaborative_docs"

engine = create_engine(DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def create_default_user():
    with Session(engine) as session:
        existing_user = session.exec(select(User).where(User.id == 1)).first()

        if not existing_user:
            user = User(
                username="testuser",
                email="test@example.com",
                password_hash="fakehash"
            )
            session.add(user)
            session.commit()