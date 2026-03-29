from models.book_model import BookModel
from models.favorite_model import FavoriteModel

def get_all_books():
    books = BookModel.get_all()
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

def search_books(search_term):
    books = BookModel.search(search_term)
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

def add_book(request):
    title = request.form.get('title', '').strip()
    author = request.form.get('author', '').strip()
    genre = request.form.get('genre', '').strip()
    year = request.form.get('year')
    description = request.form.get('description', '').strip()
    image = request.files.get('image')

    if not title or not author or not genre:
        return {'success': False, 'message': 'Заполните обязательные поля'}

    try:
        book_id = BookModel.create(title, author, genre, year, description)

        image_filename = None
        if image and allowed_file(image.filename):
            from werkzeug.utils import secure_filename
            import os
            from config import UPLOAD_FOLDER

            filename = secure_filename(f"{book_id}.{image.filename.rsplit('.', 1)[1].lower()}")
            if not os.path.exists(UPLOAD_FOLDER):
                os.makedirs(UPLOAD_FOLDER)
            image_path = os.path.join(UPLOAD_FOLDER, filename)
            image.save(image_path)
            image_filename = filename

            BookModel.update(book_id, title, author, genre, year, description, image_filename)

        return {
            'success': True,
            'message': 'Книга успешно добавлена',
            'book_id': book_id
        }
    except Exception as e:
        print(f"Ошибка при добавлении книги: {e}")
        return {'success': False, 'message': 'Ошибка при добавлении книги'}

def get_book(book_id):
    book = BookModel.get_by_id(book_id)
    if book:
        return {
            'id': book[0],
            'title': book[1],
            'author': book[2],
            'genre': book[3],
            'year': book[4],
            'description': book[5],
            'image_filename': book[6]
        }
    return None

def update_book(request):
    book_id = request.form.get('book_id')
    title = request.form.get('title', '').strip()
    author = request.form.get('author', '').strip()
    genre = request.form.get('genre', '').strip()
    year = request.form.get('year')
    description = request.form.get('description', '').strip()
    image = request.files.get('image')

    if not title or not author or not genre:
        return {'success': False, 'message': 'Заполните обязательные поля'}

    try:
        image_filename = None
        if image and allowed_file(image.filename):
            from werkzeug.utils import secure_filename
            import os
            from config import UPLOAD_FOLDER

            filename = secure_filename(f"{book_id}.{image.filename.rsplit('.', 1)[1].lower()}")
            if not os.path.exists(UPLOAD_FOLDER):
                os.makedirs(UPLOAD_FOLDER)
            image_path = os.path.join(UPLOAD_FOLDER, filename)
            image.save(image_path)
            image_filename = filename

        BookModel.update(book_id, title, author, genre, year, description, image_filename)
        return {'success': True, 'message': 'Книга успешно обновлена'}
    except Exception as e:
        print(f"Ошибка при обновлении книги: {e}")
        return {'success': False, 'message': 'Ошибка при обновлении книги'}

def delete_book(book_id):
    try:
        image_filename = BookModel.delete(book_id)
        if image_filename:
            import os
            from config import UPLOAD_FOLDER
            image_path = os.path.join(UPLOAD_FOLDER, image_filename)
            if os.path.exists(image_path):
                os.remove(image_path)
        return {'success': True, 'message': 'Книга успешно удалена'}
    except Exception as e:
        print(f"Ошибка при удалении книги: {e}")
        return {'success': False, 'message': 'Ошибка при удалении книги'}

def get_tinder_books(user_id):
    books = BookModel.get_tinder_books(user_id)
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

def add_to_favorites(user_id, book_id):
    try:
        FavoriteModel.add(user_id, book_id)
        return {'success': True, 'message': 'Книга добавлена в избранное'}
    except Exception as e:
        print(f"Ошибка при добавлении в избранное: {e}")
        return {'success': False, 'message': 'Ошибка при добавлении в избранное'}

def get_favorites(user_id):
    books = FavoriteModel.get_by_user(user_id)
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

def remove_from_favorites(user_id, book_id):
    try:
        FavoriteModel.delete(user_id, book_id)
        return {'success': True, 'message': 'Книга удалена из избранного'}
    except Exception as e:
        print(f"Ошибка при удалении из избранного: {e}")
        return {'success': False, 'message': 'Ошибка при удалении из избранного'}

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS