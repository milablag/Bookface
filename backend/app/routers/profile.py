import time
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from app.models.user_model import UserModel
from app.models.admin_model import AdminModel
from app.services.minio_service import get_file_url, upload_avatar, delete_file, ALLOWED_IMAGES

router = APIRouter()

def uid(x):
    if not x: raise HTTPException(401)
    return int(x)


@router.get("")
def get_profile(x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    try:

        if not x_user_id:
            raise HTTPException(401, "User ID required")

        user_id = int(x_user_id)

        if x_user_role == 'admin':
            data = AdminModel.get_profile_data(user_id)
        else:
            data = UserModel.get_profile_data(user_id)

        if not data:
            raise HTTPException(404, "Пользователь не найден")

        img = data[3]
        img_url = None
        if img:
            try:
                img_url = img if img.startswith('http') else get_file_url(img)
                if img_url:
                    img_url = f"{img_url}?v={int(time.time())}"
            except Exception as e:
                img_url = None

        return {
            'success': True,
            'username': data[1],
            'email': data[2],
            'profile_image': img_url
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Internal error: {str(e)}")

@router.post("")
async def update_profile(
    username: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    current_password: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    profile_image: Optional[UploadFile] = File(None),
    x_user_id: Optional[str] = Header(None),
    x_user_role: Optional[str] = Header(None)
):
    user_id = uid(x_user_id)
    img_path = None

    if x_user_role == 'user':
        row = UserModel.get_password(user_id)
        if not row: raise HTTPException(404)
        stored_pw, old_img = row
        if password and stored_pw != current_password:
            raise HTTPException(400, "Текущий пароль неверен")
        if profile_image and profile_image.filename:
            ext = profile_image.filename.rsplit('.', 1)[-1].lower()
            if ext in ALLOWED_IMAGES:
                if old_img: delete_file(old_img if old_img.startswith('http') else get_file_url(old_img))
                data = await profile_image.read()
                img_path = upload_avatar(data, profile_image.filename, profile_image.content_type, user_id, 'user')
        UserModel.update_profile(user_id, username or None, email or None, password or None, img_path)
    else:
        row = AdminModel.get_password(user_id)
        if not row: raise HTTPException(404)
        stored_pw, old_img = row
        if password and stored_pw != current_password:
            raise HTTPException(400, "Текущий пароль неверен")
        if profile_image and profile_image.filename:
            ext = profile_image.filename.rsplit('.', 1)[-1].lower()
            if ext in ALLOWED_IMAGES:
                if old_img: delete_file(old_img if old_img.startswith('http') else get_file_url(old_img))
                data = await profile_image.read()
                img_path = upload_avatar(data, profile_image.filename, profile_image.content_type, user_id, 'admin')
        AdminModel.update_profile(user_id, username or None, email or None, password or None, img_path)

    return {'success':True,'message':'Профиль обновлён'}
