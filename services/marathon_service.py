from models.marathon_model import MarathonModel
from models.user_marathon_model import UserMarathonModel
from models.marathon_progress_model import MarathonProgressModel

def get_system_marathons(user_id):
    marathons = MarathonModel.get_system(user_id)
    return [
        {
            'id': m[0],
            'name': m[1],
            'type': m[2],
            'book_count': m[3],
            'duration': m[4],
            'description': m[5],
            'created_at': m[6].isoformat() if m[6] else None,
            'is_joined': m[7],
            'progress': m[8],
            'participants_count': m[9]
        } for m in marathons
    ]

def get_user_marathons():
    marathons = MarathonModel.get_user_marathons()
    return [
        {
            'id': m[0],
            'name': m[1],
            'type': m[2],
            'book_count': m[3],
            'duration': m[4],
            'description': m[5],
            'created_at': m[6].isoformat() if m[6] else None,
            'creator_name': m[7]
        } for m in marathons
    ]

def get_all_marathons(user_id):
    marathons = MarathonModel.get_all(user_id)
    return [
        {
            'id': m[0],
            'name': m[1],
            'type': m[2],
            'book_count': m[3],
            'duration': m[4],
            'description': m[5],
            'created_at': m[6].isoformat() if m[6] else None,
            'is_joined': m[7],
            'creator_name': m[8],
            'is_creator': m[9]
        } for m in marathons
    ]

def get_my_marathons(user_id, role):
    marathons = MarathonModel.get_my(user_id, role)
    return [
        {
            'id': m[0],
            'name': m[1],
            'type': m[2],
            'book_count': m[3],
            'duration': m[4],
            'description': m[5],
            'created_at': m[6].isoformat() if m[6] else None,
            'is_participant': m[7],
            'progress': m[8]
        } for m in marathons
    ]

def get_user_active_marathons(user_id):
    marathons = MarathonModel.get_active(user_id)
    return [
        {
            'id': m[0],
            'name': m[1],
            'type': m[2],
            'book_count': m[3],
            'duration': m[4],
            'description': m[5],
            'created_at': m[6].isoformat() if m[6] else None,
            'progress': m[7],
            'creator_name': m[8],
            'is_creator': m[9]
        } for m in marathons
    ]

def get_user_completed_marathons(user_id):
    marathons = MarathonModel.get_completed(user_id)
    return [
        {
            'id': m[0],
            'name': m[1],
            'type': m[2],
            'book_count': m[3],
            'duration': m[4],
            'description': m[5],
            'created_at': m[6].isoformat() if m[6] else None,
            'progress': m[7],
            'creator_name': m[8] if len(m) > 8 else None  # Исправление 3
        } for m in marathons
    ]

def get_marathon(marathon_id):
    marathon = MarathonModel.get_by_id(marathon_id)
    if marathon:
        return {
            'success': True,
            'id': marathon[0],
            'name': marathon[1],
            'type': marathon[2],
            'book_count': marathon[3],
            'duration': marathon[4],
            'description': marathon[5]
        }
    return {'success': False, 'message': 'Марафон не найден'}

def add_marathon(request, session):
    try:
        data = request.get_json()
        if not data:
            return {'success': False, 'message': 'Некорректные данные'}

        name = data.get('name', '').strip()
        book_count = data.get('book_count')
        duration = data.get('duration', '').strip()
        description = data.get('description', '').strip()

        if not name or not book_count:
            return {'success': False, 'message': 'Заполните все обязательные поля'}

        try:
            book_count = int(book_count)
            if book_count < 1:
                return {'success': False, 'message': 'Количество книг должно быть положительным числом'}
        except ValueError:
            return {'success': False, 'message': 'Неверный формат количества книг'}

        user_id = session['user_id']
        role = session.get('role')
        marathon_type = 'system' if role == 'admin' else 'user'

        marathon_id = MarathonModel.create(name, marathon_type, book_count, duration, description)

        if role != 'admin':
            UserMarathonModel.add_participant(user_id, marathon_id, is_creator=True, progress=None)

        return {
            'success': True,
            'message': 'Марафон успешно создан',
            'marathon_id': marathon_id
        }
    except Exception as e:
        print(f"Ошибка при добавлении марафона: {e}")
        return {'success': False, 'message': f'Ошибка при добавлении марафона: {str(e)}'}

def update_marathon(request, session):
    data = request.get_json()
    marathon_id = data.get('marathon_id')
    name = data.get('name', '').strip()
    book_count = data.get('book_count')
    duration = data.get('duration', '').strip()
    description = data.get('description', '').strip()

    if not name or not book_count:
        return {'success': False, 'message': 'Заполните все обязательные поля'}

    try:
        book_count = int(book_count)
        if book_count < 1:
            return {'success': False, 'message': 'Количество книг должно быть положительным числом'}
    except ValueError:
        return {'success': False, 'message': 'Неверный формат количества книг'}

    try:
        if session.get('role') == 'admin':
            marathon_type = MarathonModel.get_type(marathon_id)
            if marathon_type != 'system':
                return {'success': False, 'message': 'Вы можете редактировать только системные марафоны'}
        else:
            if not UserMarathonModel.is_creator(session['user_id'], marathon_id):
                return {'success': False, 'message': 'Вы не можете редактировать этот марафон'}

        MarathonModel.update(marathon_id, name, book_count, duration, description)
        return {'success': True, 'message': 'Марафон успешно обновлен'}
    except Exception as e:
        print(f"Ошибка при обновлении марафона: {e}")
        return {'success': False, 'message': 'Ошибка при обновлении марафона'}

def delete_marathon(marathon_id):
    try:
        UserMarathonModel.delete_all_by_marathon(marathon_id)
        MarathonModel.delete(marathon_id)
        return {'success': True, 'message': 'Марафон успешно удален'}
    except Exception as e:
        print(f"Ошибка при удалении марафона: {e}")
        return {'success': False, 'message': 'Ошибка при удалении марафона'}

def join_marathon(user_id, marathon_id):
    try:
        marathon = MarathonModel.get_by_id(marathon_id)
        if not marathon:
            return {'success': False, 'message': 'Марафон не найден'}

        book_count = marathon[3]
        existing = UserMarathonModel.get_participation(user_id, marathon_id)

        if existing:
            current_progress, is_creator = existing
            if current_progress is None:
                UserMarathonModel.update_progress(user_id, marathon_id, 0)
                message = 'Вы теперь участвуете в марафоне'
            else:
                message = 'Вы уже участвуете в этом марафоне'
        else:
            UserMarathonModel.add_participant(user_id, marathon_id, is_creator=False, progress=0)
            message = 'Вы успешно присоединились к марафону'

        return {'success': True, 'message': message}
    except Exception as e:
        print(f"Ошибка при присоединении к марафону: {e}")
        return {'success': False, 'message': 'Ошибка при присоединении к марафону'}

def leave_marathon(user_id, marathon_id):
    try:
        existing = UserMarathonModel.get_participation(user_id, marathon_id)
        if not existing:
            return {'success': False, 'message': 'Вы не участвуете в этом марафоне'}

        progress, is_creator = existing

        if is_creator:
            UserMarathonModel.update_progress_null(user_id, marathon_id)
            message = 'Вы больше не участвуете в марафоне'
        else:
            UserMarathonModel.delete_participant(user_id, marathon_id)
            message = 'Вы успешно покинули марафон'

        return {
            'success': True,
            'message': message,
            'marathon_id': marathon_id,
            'is_creator': is_creator,
            'should_remove': not is_creator
        }
    except Exception as e:
        print(f"Ошибка при выходе из марафона: {e}")
        return {'success': False, 'message': 'Ошибка при выходе из марафона'}

def update_marathon_progress(user_id, data):
    marathon_id = data.get('marathon_id')
    progress_count = data.get('progress_count')
    notes = data.get('notes', '')

    if not marathon_id or progress_count is None:
        return {'success': False, 'message': 'Не указаны обязательные параметры'}

    try:
        progress_count = int(progress_count)
    except ValueError:
        return {'success': False, 'message': 'Некорректное значение прогресса'}

    try:
        marathon = MarathonModel.get_by_id(marathon_id)
        if not marathon:
            return {'success': False, 'message': 'Марафон не найден'}

        book_count = marathon[3]
        if progress_count > book_count:
            return {'success': False, 'message': 'Прогресс не может превышать общее количество книг'}

        UserMarathonModel.update_progress(user_id, marathon_id, progress_count)

        if notes:
            MarathonProgressModel.update_notes(user_id, marathon_id, notes)
        else:
            MarathonProgressModel.delete_notes(user_id, marathon_id)

        return {'success': True, 'message': 'Прогресс успешно обновлен'}
    except Exception as e:
        print(f"Ошибка при обновлении прогресса: {e}")
        return {'success': False, 'message': 'Ошибка сервера при обновлении прогресса'}

def get_marathon_progress_info(user_id, marathon_id):
    try:
        marathon = MarathonModel.get_by_id(marathon_id)
        if not marathon:
            return {'success': False, 'message': 'Марафон не найден'}

        book_count = marathon[3]
        participation = UserMarathonModel.get_participation(user_id, marathon_id)
        progress = participation[0] if participation else None
        notes = MarathonProgressModel.get_notes(user_id, marathon_id)

        return {
            'success': True,
            'book_count': book_count,
            'progress': progress,
            'notes': notes
        }
    except Exception as e:
        print(f"Ошибка при получении информации о марафоне: {e}")
        return {'success': False, 'message': 'Ошибка сервера'}