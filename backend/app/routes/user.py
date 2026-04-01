"""
routers/user.py — User management endpoints.
"""

from fastapi import APIRouter, HTTPException, Response, status


router = APIRouter(prefix="/user", tags=["user"])

