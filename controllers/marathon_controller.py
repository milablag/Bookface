from flask import Blueprint, session, jsonify, request
from services.marathon_service import (
    get_all_marathons, get_my_marathons, get_marathon,
    update_marathon_progress, get_marathon_progress_info
)

marathon_bp = Blueprint('marathon', __name__)

@marathon_bp.route('/get_all_marathons')
def get_all_marathons_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    marathons = get_all_marathons(user_id)
    return jsonify(marathons)

@marathon_bp.route('/get_my_marathons')
def get_my_marathons_route():
    if 'user_id' not in session:
        return jsonify([])

    user_id = session['user_id']
    role = session.get('role')
    marathons = get_my_marathons(user_id, role)
    return jsonify(marathons)

@marathon_bp.route('/get_marathon/<int:marathon_id>')
def get_marathon_route(marathon_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    marathon = get_marathon(marathon_id)
    return jsonify(marathon) if marathon else jsonify({'success': False, 'message': 'Марафон не найден'})

@marathon_bp.route('/update_marathon_progress', methods=['POST'])
def update_marathon_progress_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    user_id = session['user_id']
    result = update_marathon_progress(user_id, request.get_json())
    return jsonify(result)

@marathon_bp.route('/get_marathon_progress_info')
def get_marathon_progress_info_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    marathon_id = request.args.get('marathon_id')
    user_id = session['user_id']
    result = get_marathon_progress_info(user_id, marathon_id)
    return jsonify(result)

@marathon_bp.route('/get_marathon_progress')
def get_marathon_progress_route():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})

    marathon_id = request.args.get('marathon_id')
    user_id = session['user_id']
    result = get_marathon_progress_info(user_id, marathon_id)
    return jsonify(result)