"""
main.py — Application entry point.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.db import create_db_and_tables, create_default_user
from contextlib import asynccontextmanager
from app.routes.documents import router as documents_router
from app.routes.user import router as user_router
from app.routes.permissions import router as permissions_router
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    create_default_user()
    yield

app = FastAPI(
    title="Collaborative Document Editor",
    description="Real time collaboration for Documents. Write together with our AI helper.",
    version="1.0.0",
    lifespan=lifespan
)
@app.get("/")
def root():
    return {"message": "API is running"}

app.include_router(documents_router)
app.include_router(user_router)
app.include_router(permissions_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
