from models.user_model import UserModel
from models.admin_model import AdminModel
from models.user_book_model import UserBookModel
from models.favorite_model import FavoriteModel

def check_user_credentials(email, password):
    from models.database import get_db_connection

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, username FROM admins WHERE email = %s AND password = %s",
                   (email, password))
    admin = cursor.fetchone()

    if admin:
        cursor.close()
        conn.close()
        return {'id': admin[0], 'username': admin[1], 'role': 'admin'}

    cursor.execute("SELECT id, username FROM users WHERE email = %s AND password = %s",
                   (email, password))
    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if user:
        return {'id': user[0], 'username': user[1], 'role': 'user'}
    return None

def get_user_by_username(username):
    return UserModel.get_by_username(username)

def get_user_by_email(email):
    return UserModel.get_by_email(email)

def create_user(username, email, password):
    return UserModel.create(username, email, password)

def get_user_profile_image(user_id):
    image = UserModel.get_profile_image(user_id)
    return f"/static/uploads/{image}" if image else '/static/ava.jpg'

def get_user_books(user_id, status):
    books = UserBookModel.get_by_user_and_status(user_id, status)
    return [
        {
            'id': book[0],
            'title': book[1],
            'author': book[2],
            'genre': book[3],
            'year': book[4],
            'description': book[5],
            'image_filename': book[6]
        } for book in books
    ]

def add_book_to_category(user_id, book_id, category):
    if category not in ['planned', 'reading', 'read']:
        return {'success': False, 'message': 'Неверная категория'}

    try:
        UserBookModel.add(user_id, book_id, category)
        FavoriteModel.delete(user_id, book_id)
        return {
            'success': True,
            'message': f'Книга добавлена в "{category}" и удалена из избранного'
        }
    except Exception as e:
        print(f"Ошибка при добавлении книги: {e}")
        return {'success': False, 'message': f'Ошибка при добавлении книги: {str(e)}'}

def move_book_category(user_id, book_id, new_category):
    if new_category not in ['planned', 'reading', 'read']:
        return {'success': False, 'message': 'Неверная категория'}

    try:
        UserBookModel.update_status(user_id, book_id, new_category)
        FavoriteModel.delete(user_id, book_id)
        return {
            'success': True,
            'message': f'Книга перемещена в "{new_category}" и удалена из избранного'
        }
    except Exception as e:
        print(f"Ошибка при перемещении книги: {e}")
        return {'success': False, 'message': f'Ошибка при перемещении книги: {str(e)}'}