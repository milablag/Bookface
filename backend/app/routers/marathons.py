from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Body
from app.models.other_models import MarathonModel, UserMarathonModel, MarathonProgressModel

router = APIRouter()

def uid(x):
    if not x: raise HTTPException(401)
    return int(x)

def admin_only(role):
    if role != 'admin': raise HTTPException(403)

def fmt(m, keys):
    return dict(zip(keys, m))

@router.get("")
def get_all(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    rows = MarathonModel.get_all_approved(user_id)
    return [{'id':r[0],'name':r[1],'type':r[2],'book_count':r[3],'duration':r[4],
             'description':r[5],'created_at':r[6].isoformat() if r[6] else None,
             'is_joined':r[7],'creator_name':r[8],'is_creator':r[9],'status':r[10]} for r in rows]

@router.get("/system")
def get_system(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    rows = MarathonModel.get_system(user_id)
    return [{'id':r[0],'name':r[1],'type':r[2],'status':r[3],'book_count':r[4],'duration':r[5],
             'description':r[6],'created_at':r[7].isoformat() if r[7] else None,
             'is_joined':r[8],'progress':r[9],'participants_count':r[10]} for r in rows]

@router.get("/active")
def get_active(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    rows = MarathonModel.get_active(user_id)
    return [{'id':r[0],'name':r[1],'type':r[2],'book_count':r[3],'duration':r[4],
             'description':r[5],'created_at':r[6].isoformat() if r[6] else None,
             'progress':r[7],'creator_name':r[8],'is_creator':r[9]} for r in rows]

@router.get("/completed")
def get_completed(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    rows = MarathonModel.get_completed(user_id)
    return [{'id':r[0],'name':r[1],'type':r[2],'book_count':r[4],'duration':r[5],
             'description':r[6],'created_at':r[7].isoformat() if r[7] else None,
             'progress':r[8],'creator_name':r[9]} for r in rows]

@router.get("/my")
def get_my(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    rows = MarathonModel.get_my(user_id)
    return [{'id':r[0],'name':r[1],'type':r[2],'book_count':r[3],'duration':r[4],
             'description':r[5],'created_at':r[6].isoformat() if r[6] else None,
             'status':r[7],'is_participant':r[8],'progress':r[9]} for r in rows]

@router.get("/pending")
def get_pending(x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    uid(x_user_id); admin_only(x_user_role)
    rows = MarathonModel.get_pending()
    return [{'id':r[0],'name':r[1],'type':r[2],'book_count':r[3],'duration':r[4],
             'description':r[5],'created_at':r[6].isoformat() if r[6] else None,
             'creator_name':r[7],'creator_id':r[8]} for r in rows]

@router.get("/user")
def get_user_approved(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    rows = MarathonModel.get_user_approved(user_id)
    return [{'id':r[0],'name':r[1],'type':r[2],'status':r[3],'book_count':r[4],'duration':r[5],
             'description':r[6],'created_at':r[7].isoformat() if r[7] else None,
             'is_joined':r[8],'progress':r[9],'participants_count':r[10],
             'creator_name':r[11]} for r in rows]

@router.get("/{mid}")
def get_one(mid: int, x_user_id: Optional[str] = Header(None)):
    uid(x_user_id)
    m = MarathonModel.get_by_id(mid)
    if not m: raise HTTPException(404, "Марафон не найден")
    return {'success':True,'id':m[0],'name':m[1],'type':m[2],'book_count':m[3],'duration':m[4],'description':m[5]}

@router.post("")
def create(body: dict = Body(...), x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    name = body.get('name','').strip()
    book_count = body.get('book_count')
    duration = body.get('duration','').strip()
    description = body.get('description','').strip()
    if not name or not book_count: raise HTTPException(400, "Заполните обязательные поля")
    mtype = 'system' if x_user_role == 'admin' else 'user'
    status = 'approved' if x_user_role == 'admin' else 'pending'
    mid = MarathonModel.create(name, mtype, status, int(book_count), duration, description)
    if x_user_role != 'admin':
        UserMarathonModel.add(user_id, mid, is_creator=True, progress=None)
    return {'success':True,'message':'Марафон создан','marathon_id':mid}

@router.put("/{mid}")
def update(mid: int, body: dict = Body(...), x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    if x_user_role != 'admin' and not UserMarathonModel.is_creator(user_id, mid):
        raise HTTPException(403, "Нет прав")
    MarathonModel.update(mid, body.get('name'), body.get('book_count'), body.get('duration'), body.get('description'))
    return {'success':True,'message':'Марафон обновлён'}

@router.delete("/{mid}")
def delete(mid: int, x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    uid(x_user_id); admin_only(x_user_role)
    UserMarathonModel.delete_all(mid); MarathonModel.delete(mid)
    return {'success':True,'message':'Марафон удалён'}

@router.post("/{mid}/approve")
def approve(mid: int, x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    uid(x_user_id); admin_only(x_user_role)
    MarathonModel.set_status(mid, 'approved')
    return {'success':True,'message':'Марафон одобрен'}

@router.delete("/{mid}/reject")
def reject(mid: int, x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    uid(x_user_id); admin_only(x_user_role)
    MarathonModel.set_status(mid, 'rejected'); UserMarathonModel.delete_all(mid)
    return {'success':True,'message':'Марафон отклонён'}

@router.post("/{mid}/join")
def join(mid: int, x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    m = MarathonModel.get_by_id(mid)
    if not m: raise HTTPException(404)
    existing = UserMarathonModel.get(user_id, mid)
    if existing:
        if existing[0] is None: UserMarathonModel.update_progress(user_id, mid, 0)
    else:
        UserMarathonModel.add(user_id, mid, is_creator=False, progress=0)
    return {'success':True,'message':'Присоединились к марафону'}

@router.post("/{mid}/leave")
def leave(mid: int, x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    existing = UserMarathonModel.get(user_id, mid)
    if not existing: raise HTTPException(400, "Не участвуете")
    _, is_creator = existing
    if is_creator: UserMarathonModel.set_progress_null(user_id, mid)
    else: UserMarathonModel.delete(user_id, mid)
    return {'success':True,'message':'Покинули марафон','is_creator':is_creator,'should_remove':not is_creator}

@router.post("/{mid}/progress")
def update_progress(mid: int, body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    count = int(body.get('progress_count', 0))
    notes = body.get('notes', '')
    m = MarathonModel.get_by_id(mid)
    if not m: raise HTTPException(404)
    if count > m[3]: raise HTTPException(400, "Прогресс не может превышать количество книг")
    UserMarathonModel.update_progress(user_id, mid, count)
    if notes: MarathonProgressModel.update_notes(user_id, mid, notes)
    else: MarathonProgressModel.delete_notes(user_id, mid)
    return {'success':True,'message':'Прогресс обновлён'}

@router.get("/{mid}/progress")
def get_progress(mid: int, x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    m = MarathonModel.get_by_id(mid)
    if not m: raise HTTPException(404)
    p = UserMarathonModel.get(user_id, mid)
    notes = MarathonProgressModel.get_notes(user_id, mid)
    return {'success':True,'book_count':m[3],'progress':p[0] if p else None,'notes':notes}