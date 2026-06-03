import io, json, os
from minio import Minio
from werkzeug.utils import secure_filename
from app.config import MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_SECURE, MINIO_PUBLIC_URL

FOLDER_AVATARS     = "avatars"
FOLDER_BOOK_COVERS = "book_covers"
FOLDER_BOOK_PDFS   = "book_pdfs"
FOLDER_BOOK_AUDIO  = "book_audio"

ALLOWED_IMAGES = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_PDF    = {'pdf'}
ALLOWED_AUDIO  = {'mp3', 'wav', 'ogg', 'm4a'}

_minio_client: Minio | None = None


def get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
    return _minio_client


def init_minio_bucket():
    client = get_minio_client()
    if not client.bucket_exists(MINIO_BUCKET):
        client.make_bucket(MINIO_BUCKET)
        policy = {"Version": "2012-10-17", "Statement": [{
            "Effect": "Allow", "Principal": {"AWS": ["*"]},
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{MINIO_BUCKET}/*"]
        }]}
        client.set_bucket_policy(MINIO_BUCKET, json.dumps(policy))
        print(f"✅ Bucket '{MINIO_BUCKET}' создан")


def get_file_url(file_path: str | None) -> str | None:
    """Возвращает публичный URL файла в MinIO. Чистая функция — без side-эффектов."""
    try:
        if not file_path:
            return None
        if file_path.startswith('http'):
            return file_path
        if file_path.startswith(f'{MINIO_BUCKET}/'):
            file_path = file_path[len(f'{MINIO_BUCKET}/'):]
        if file_path.startswith('/'):
            file_path = file_path[1:]
        return f"{MINIO_PUBLIC_URL}/{MINIO_BUCKET}/{file_path}"
    except Exception as e:
        print(f"get_file_url error for '{file_path}': {e}")
        return None


def _put(folder: str, filename: str, data: bytes, content_type: str) -> str:
    client = get_minio_client()
    path = f"{folder}/{filename}"
    client.put_object(MINIO_BUCKET, path, io.BytesIO(data), len(data), content_type=content_type)
    return path


def upload_avatar(file_data, filename, content_type, user_id, role="user"):
    try:
        ext = filename.rsplit('.', 1)[1].lower()
        fname = secure_filename(f"{role}_{user_id}.{ext}")
        path = _put(FOLDER_AVATARS, fname, file_data, content_type)
        return get_file_url(path)
    except Exception as e:
        print(f"Ошибка загрузки аватара: {e}")
        return None


def upload_book_cover(file_data, filename, content_type, book_id):
    try:
        ext = filename.rsplit('.', 1)[1].lower()
        fname = secure_filename(f"book_{book_id}.{ext}")
        return _put(FOLDER_BOOK_COVERS, fname, file_data, content_type)
    except Exception as e:
        print(f"Ошибка загрузки обложки: {e}")
        return None


def upload_pdf(file_data, filename, book_id):
    try:
        fname = secure_filename(f"book_{book_id}.pdf")
        return _put(FOLDER_BOOK_PDFS, fname, file_data, 'application/pdf')
    except Exception as e:
        print(f"Ошибка загрузки PDF: {e}")
        return None


def upload_audio(file_data, filename, book_id):
    try:
        ext = filename.rsplit('.', 1)[1].lower()
        ct_map = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4'}
        ct = ct_map.get(ext, 'audio/mpeg')
        fname = secure_filename(f"book_{book_id}.{ext}")
        return _put(FOLDER_BOOK_AUDIO, fname, file_data, ct)
    except Exception as e:
        print(f"Ошибка загрузки аудио: {e}")
        return None


def upload_audio_track(file_data, filename, book_id, track_id=None):
    try:
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'mp3'
        ct_map = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4'}
        ct = ct_map.get(ext, 'audio/mpeg')
        if track_id:
            safe_name = secure_filename(f"book_{book_id}_track_{track_id}.{ext}")
        else:
            import time
            safe_name = secure_filename(f"book_{book_id}_track_{int(time.time())}.{ext}")
        return _put(FOLDER_BOOK_AUDIO, safe_name, file_data, ct)
    except Exception as e:
        print(f"Ошибка загрузки аудио-дорожки: {e}")
        import traceback
        traceback.print_exc()
        return None


def delete_file(file_url: str | None) -> bool:
    if not file_url:
        return False
    try:
        client = get_minio_client()
        prefix = f"{MINIO_PUBLIC_URL}/{MINIO_BUCKET}/"
        if file_url.startswith(prefix):
            path = file_url[len(prefix):]
        else:
            path = file_url
            if path.startswith(f'{MINIO_BUCKET}/'):
                path = path[len(f'{MINIO_BUCKET}/'):]
        client.remove_object(MINIO_BUCKET, path)
        return True
    except Exception as e:
        print(f"Ошибка удаления: {e}")
        return False