"""
routers/user_auth.py — User management endpoints.
"""

from fastapi import APIRouter, HTTPException, Response, status


router = APIRouter(prefix="/api/user", tags=["user"])
