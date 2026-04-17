"""
main.py — Application entry point.
"""

from app.routes.ai import router as ai_router
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import BACKEND_CORS_ORIGINS
from app.db import create_db_and_tables, create_default_user
from app.routes.documents import router as documents_router
from app.routes.user import router as user_router
from app.routes.permissions import router as permissions_router
from app.routes.admin import router as admin_router
from app.websocket import router as websocket_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    create_default_user()
    yield


app = FastAPI(
    title="Collaborative Document Editor",
    description="Real time collaboration for Documents. Write together with our AI helper.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content={"error": {"code": code, "message": message}}
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
    return build_error_response(exc.status_code, code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    first_error = exc.errors()[0] if exc.errors() else None
    message = (
        first_error.get("msg", "Invalid request body")
        if first_error
        else "Invalid request body"
    )
    return build_error_response(422, "VALIDATION_ERROR", message)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, __: Exception) -> JSONResponse:
    return build_error_response(500, "INTERNAL_SERVER_ERROR", "Internal server error")


@app.get("/")
def root():
    return {"message": "API is running"}


app.include_router(documents_router)
app.include_router(user_router)
app.include_router(permissions_router)
app.include_router(admin_router)
app.include_router(websocket_router)
app.include_router(ai_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
