from flask import Blueprint, render_template, session, redirect, url_for, jsonify, request
from services.user_service import get_user_profile_image, get_user_books, add_book_to_category, move_book_category
from services.book_service import get_tinder_books, add_to_favorites, get_favorites, remove_from_favorites
from services.marathon_service import get_user_active_marathons, get_user_completed_marathons, join_marathon, leave_marathon

user_bp = Blueprint('user', __name__)

@user_bp.route('/user')
def user_page():
    if 'user_id' not in session or session.get('role') != 'user':
        return redirect(url_for('auth.login'))

    username = session.get('username', 'Пользователь')
    user_profile_image = get_user_profile_image(session['user_id'])

    return render_template('lol.html', username=username, user_profile_image=user_profile_image)

@user_bp.route('/get_user_books')
def get_user_books_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    status = request.args.get('status')
    books = get_user_books(user_id, status)
    return jsonify(books)

@user_bp.route('/add_to_category', methods=['POST'])
def add_to_category():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    book_id = request.json.get('book_id')
    category = request.json.get('category')

    result = add_book_to_category(user_id, book_id, category)
    return jsonify(result)

@user_bp.route('/move_to_category', methods=['POST'])
def move_to_category():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    book_id = request.json.get('book_id')
    new_category = request.json.get('new_category')

    result = move_book_category(user_id, book_id, new_category)
    return jsonify(result)

@user_bp.route('/get_tinder_books')
def get_tinder_books_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    books = get_tinder_books(user_id)
    return jsonify(books)

@user_bp.route('/add_to_favorites', methods=['POST'])
def add_to_favorites_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    book_id = request.json.get('book_id')

    result = add_to_favorites(user_id, book_id)
    return jsonify(result)

@user_bp.route('/get_favorites')
def get_favorites_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    books = get_favorites(user_id)
    return jsonify(books)

@user_bp.route('/remove_from_favorites', methods=['POST'])
def remove_from_favorites_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    book_id = request.json.get('book_id')

    result = remove_from_favorites(user_id, book_id)
    return jsonify(result)

@user_bp.route('/get_active_marathons')
def get_active_marathons_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    marathons = get_user_active_marathons(user_id)
    return jsonify(marathons)

@user_bp.route('/get_completed_marathons')
def get_completed_marathons_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    marathons = get_user_completed_marathons(user_id)
    return jsonify(marathons)

@user_bp.route('/join_marathon', methods=['POST'])
def join_marathon_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    marathon_id = request.json.get('marathon_id')

    result = join_marathon(user_id, marathon_id)
    return jsonify(result)

@user_bp.route('/leave_marathon', methods=['POST'])
def leave_marathon_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    marathon_id = request.json.get('marathon_id')

    result = leave_marathon(user_id, marathon_id)
    return jsonify(result)