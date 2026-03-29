from flask import Blueprint, redirect, url_for, session

index_bp = Blueprint('index', __name__)

@index_bp.route('/')
def index():
    if 'user_id' in session:
        if session.get('role') == 'admin':
            return redirect(url_for('admin.admin_page'))
        return redirect(url_for('user.user_page'))
    return redirect(url_for('auth.login'))