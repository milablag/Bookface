from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Body
from app.models.other_models import ReadingProgressModel, AudioProgressModel

router = APIRouter()

def uid(x):
    if not x: raise HTTPException(401)
    return int(x)

@router.post("/progress/reading")
def save_reading(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    ReadingProgressModel.save_progress(user_id, body['book_id'],
        body.get('current_page',1), body.get('total_pages',0), body.get('percentage',0))
    return {'success': True}

@router.get("/progress/reading/{book_id}")
def get_reading(book_id: int, x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    return {'success': True, 'progress': ReadingProgressModel.get_progress(user_id, book_id)}

@router.post("/progress/audio")
def save_audio(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    AudioProgressModel.save_progress(user_id, body['book_id'],
        body.get('current_time',0), body.get('is_playing',False), body.get('volume',0.7),
        body.get('current_track_index',0))
    return {'success': True}

@router.get("/progress/audio/{book_id}")
def get_audio(book_id: int, x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    return {'success': True, 'progress': AudioProgressModel.get_progress(user_id, book_id)}
