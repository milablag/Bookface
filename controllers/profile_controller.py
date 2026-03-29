from flask import Blueprint, session, jsonify, request
from services.profile_service import get_profile_data, update_profile

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/get_profile_data')
def get_profile_data_route():
    user_id = session.get('user_id')
    role = session.get('role')

    data = get_profile_data(user_id, role)
    return jsonify(data)

@profile_bp.route('/update_profile', methods=['POST'])
def update_profile_route():
    user_id = session.get('user_id')
    role = session.get('role')

    result = update_profile(user_id, role, request)
    return jsonify(result)