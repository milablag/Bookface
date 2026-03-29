from models.user_model import UserModel
from models.admin_model import AdminModel
import re
import os
from werkzeug.utils import secure_filename
from config import UPLOAD_FOLDER

def get_profile_data(user_id, role):
    if not user_id or role not in ['user', 'admin']:
        return {'success': False, 'message': 'Доступ запрещён'}

    try:
        if role == 'user':
            data = UserModel.get_profile_data(user_id)
        elif role == 'admin':
            data = AdminModel.get_profile_data(user_id)
        else:
            return {'success': False, 'message': 'Неверная роль пользователя'}

        if not data:
            return {'success': False, 'message': 'Пользователь не найден'}

        return {
            'success': True,
            'username': data[1],
            'email': data[2],
            'profile_image': data[3] if len(data) > 3 and data[3] else None
        }
    except Exception as e:
        print(f"Ошибка при получении данных профиля: {e}")
        return {'success': False, 'message': 'Ошибка при получении данных'}

def update_profile(user_id, role, request):
    if not user_id or role not in ['user', 'admin']:
        return {'success': False, 'message': 'Доступ запрещён'}

    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip()
    current_password = request.form.get('current_password', '')
    new_password = request.form.get('password', '')
    profile_image = request.files.get('profile_image')

    try:
        if role == 'user':
            if current_password or new_password:
                from models.database import get_db_connection
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT password FROM users WHERE id = %s", (user_id,))
                stored_password = cursor.fetchone()[0]
                cursor.close()
                conn.close()

                if stored_password != current_password:
                    return {'success': False, 'message': 'Текущий пароль не совпадает'}

            image_filename = None
            if profile_image and allowed_file(profile_image.filename):
                from models.database import get_db_connection
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT profile_image FROM users WHERE id = %s", (user_id,))
                old_image = cursor.fetchone()[0]
                cursor.close()
                conn.close()

                if old_image:
                    old_path = os.path.join(UPLOAD_FOLDER, old_image)
                    if os.path.exists(old_path):
                        os.remove(old_path)

                filename = secure_filename(f"user_{user_id}.{profile_image.filename.rsplit('.', 1)[1].lower()}")
                image_path = os.path.join(UPLOAD_FOLDER, filename)
                profile_image.save(image_path)
                image_filename = filename

            if username or email or new_password or image_filename:
                UserModel.update_profile(user_id, username, email, new_password, image_filename)

        return {'success': True, 'message': 'Профиль успешно обновлён'}
    except Exception as e:
        print(f"Ошибка при обновлении профиля: {e}")
        return {'success': False, 'message': 'Ошибка при обновлении профиля'}

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS