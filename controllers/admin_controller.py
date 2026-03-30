from flask import Blueprint, render_template, session, redirect, url_for, jsonify, request
from services.admin_service import get_admin_profile_image
from services.book_service import get_all_books, search_books, add_book, get_book, update_book, delete_book
from services.marathon_service import get_system_marathons, add_marathon, update_marathon, delete_marathon

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin')
def admin_page():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('auth.login'))

    username = session.get('username', 'Администратор')
    user_profile_image = get_admin_profile_image(session['user_id'])

    return render_template('lol_ad.html', username=username, user_profile_image=user_profile_image)

@admin_bp.route('/get_all_books')
def get_all_books_route():
    if 'user_id' not in session:
        return jsonify([])

    books = get_all_books()
    return jsonify(books)

@admin_bp.route('/search_books', methods=['POST'])
def search_books_route():
    if 'user_id' not in session:
        return jsonify([])

    search_term = request.json.get('search_term', '').strip()
    books = search_books(search_term)
    return jsonify(books)

@admin_bp.route('/add_book', methods=['POST'])
def add_book_route():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    result = add_book(request)
    return jsonify(result)

@admin_bp.route('/get_book/<int:book_id>')
def get_book_route(book_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    book = get_book(book_id)
    return jsonify(book) if book else jsonify({'success': False, 'message': 'Книга не найдена'})

@admin_bp.route('/update_book', methods=['POST'])
def update_book_route():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    result = update_book(request)
    return jsonify(result)

@admin_bp.route('/delete_book/<int:book_id>', methods=['DELETE'])
def delete_book_route(book_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    result = delete_book(book_id)
    return jsonify(result)

@admin_bp.route('/get_system_marathons')
def get_system_marathons_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    marathons = get_system_marathons(user_id)
    return jsonify(marathons)

@admin_bp.route('/add_marathon', methods=['POST'])
def add_marathon_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещён'})

    result = add_marathon(request, session)
    return jsonify(result)

@admin_bp.route('/update_marathon', methods=['POST'])
def update_marathon_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    result = update_marathon(request, session)
    return jsonify(result)

@admin_bp.route('/delete_marathon/<int:marathon_id>', methods=['DELETE'])
def delete_marathon_route(marathon_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    result = delete_marathon(marathon_id)
    return jsonify(result)

@admin_bp.route('/get_user_marathons')
def get_user_marathons_route():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify([])

    from services.marathon_service import get_user_marathons
    marathons = get_user_marathons()
    return jsonify(marathons)