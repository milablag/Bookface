from typing import Optional
from fastapi import APIRouter, Header
router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok"}
