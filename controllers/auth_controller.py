from flask import Blueprint, render_template, request, redirect, url_for, flash, session
import re
from services.user_service import check_user_credentials, get_user_by_email, get_user_by_username, create_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        flash('Вы уже авторизованы', 'info')
        return redirect(url_for('index.index'))  # Изменено

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()

        if not email or not password:
            flash('Все поля обязательны для заполнения', 'error')
            return redirect(url_for('auth.login'))

        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            flash('Введите корректный email адрес', 'error')
            return redirect(url_for('auth.login'))

        user = check_user_credentials(email, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']

            flash(f'Добро пожаловать, {user["username"]}!', 'success')
            return redirect(url_for('index.index'))  # Изменено
        else:
            flash('Неверный email или пароль', 'error')
            return redirect(url_for('auth.login'))

    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('index.index'))  # Изменено

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()

        if not all([username, email, password, confirm_password]):
            flash('Все поля обязательны для заполнения', 'error')
            return redirect(url_for('auth.register'))

        if len(username) < 3 or len(username) > 20:
            flash('Имя пользователя должно быть от 3 до 20 символов', 'error')
            return redirect(url_for('auth.register'))

        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            flash('Имя пользователя может содержать только буквы, цифры и подчеркивание', 'error')
            return redirect(url_for('auth.register'))

        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            flash('Введите корректный email адрес', 'error')
            return redirect(url_for('auth.register'))

        if len(password) < 8:
            flash('Пароль должен содержать минимум 8 символов', 'error')
            return redirect(url_for('auth.register'))
        if not re.search(r'\d', password):
            flash('Пароль должен содержать хотя бы одну цифру', 'error')
            return redirect(url_for('auth.register'))
        if not re.search(r'[A-ZА-Я]', password):
            flash('Пароль должен содержать хотя бы одну заглавную букву', 'error')
            return redirect(url_for('auth.register'))

        if password != confirm_password:
            flash('Пароли не совпадают', 'error')
            return redirect(url_for('auth.register'))

        if get_user_by_email(email):
            flash('Email уже зарегистрирован', 'error')
            return redirect(url_for('auth.register'))
        if get_user_by_username(username):
            flash('Имя пользователя уже занято', 'error')
            return redirect(url_for('auth.register'))

        user_id = create_user(username, email, password)
        session['user_id'] = user_id
        session['username'] = username
        session['role'] = 'user'
        flash('Регистрация прошла успешно!', 'success')
        return redirect(url_for('user.user_page'))  # Изменено

    return render_template('register.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))