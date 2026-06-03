import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form, Body
from app.models.book_model import BookModel, AudioTrackModel
from app.models.other_models import FavoriteModel, UserBookModel
from app.services.minio_service import get_file_url, upload_book_cover, upload_pdf, upload_audio, upload_audio_track, delete_file, ALLOWED_IMAGES

router = APIRouter()

def uid(x_user_id):
    if not x_user_id: raise HTTPException(401, "Требуется авторизация")
    return int(x_user_id)

def admin_only(x_user_role):
    if x_user_role != 'admin': raise HTTPException(403, "Доступ запрещён")


def book_to_dict(b, ts=False):
    """
    Поддерживает форматы:
      - 10 колонок SELECT *  (id,title,author,genre,year,desc,img,pdf,audio,md)
      - 11 колонок enriched  (+ audio_track_count из LEFT JOIN в get_all/search)
    """
    if not b:
        return None

    def safe_str(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val.isoformat()
        return str(val)

    image_filename = b[6] if len(b) > 6 else None
    url = get_file_url(image_filename) if image_filename and not isinstance(image_filename, datetime) else None

    track_count = 0
    if len(b) > 10 and b[10] is not None:
        try:
            track_count = int(b[10]) if not isinstance(b[10], datetime) else 0
        except:
            track_count = 0

    has_pdf = False
    has_audio = False
    if len(b) > 7 and b[7] is not None and not isinstance(b[7], datetime):
        has_pdf = bool(b[7])
    if len(b) > 8 and b[8] is not None and not isinstance(b[8], datetime):
        has_audio = bool(b[8])

    d = {
        'id': b[0] if len(b) > 0 else None,
        'title': safe_str(b[1]) if len(b) > 1 else '',
        'author': safe_str(b[2]) if len(b) > 2 else '',
        'genre': safe_str(b[3]) if len(b) > 3 else '',
        'year': b[4] if len(b) > 4 and not isinstance(b[4], datetime) else None,
        'description': safe_str(b[5]) if len(b) > 5 else '',
        'image_filename': url,
        'has_pdf': has_pdf,
        'has_audio': has_audio or track_count > 0,
        'audio_track_count': track_count,
    }
    return d


def book_full(b):
    """Детальное представление книги для страницы чтения (только Markdown)."""
    if not b:
        return None

    url = get_file_url(b[6]) if b[6] else None

    md_url = None
    if len(b) > 9 and b[9]:
        md_url = get_file_url(b[9])
    elif len(b) > 7 and b[7]:
        md_url = get_file_url(b[7])

    d = {
        'id': b[0],
        'title': b[1] if len(b) > 1 else '',
        'author': b[2] if len(b) > 2 else '',
        'genre': b[3] if len(b) > 3 else '',
        'year': b[4] if len(b) > 4 else None,
        'description': b[5] if len(b) > 5 else '',
        'image_filename': url,
        'md_url': md_url,
        'pdf_url': get_file_url(b[7]) if len(b) > 7 and b[7] else None,
    }

    tracks = AudioTrackModel.get_by_book(b[0])
    d['audio_tracks'] = [{'id': t['id'], 'track_order': t['track_order'],
                          'title': t['title'], 'url': get_file_url(t['filename'])} for t in tracks]
    return d


@router.get("/tinder/books")
def tinder(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    return [book_to_dict(b, ts=True) for b in BookModel.get_tinder_books(user_id)]


@router.get("/favorites/list")
def get_favorites(x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    return [book_to_dict(b, ts=True) for b in FavoriteModel.get_by_user(user_id)]

@router.post("/favorites/add")
def add_favorite(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    FavoriteModel.add(user_id, body.get('book_id'))
    return {'success': True, 'message': 'Добавлено в избранное'}

@router.post("/favorites/remove")
def remove_favorite(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    FavoriteModel.delete(user_id, body.get('book_id'))
    return {'success': True, 'message': 'Удалено из избранного'}


@router.get("/user/list")
@router.get("/user/lists")
def get_user_books(status: str, x_user_id: Optional[str] = Header(None)):
    try:
        user_id = uid(x_user_id)
        books = UserBookModel.get_by_user_and_status(user_id, status)
        result = []
        for b in books:
            try:
                result.append(book_to_dict(b))
            except Exception as e:
                print(f"Error converting book {b[0] if b else 'unknown'}: {e}")
                continue
        return result
    except Exception as e:
        print(f"Error in get_user_books: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Internal error: {str(e)}")

@router.post("/user/add")
def add_to_category(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    cat = body.get('category')
    if cat not in ('planned','reading','read'): raise HTTPException(400, "Неверная категория")
    UserBookModel.add(user_id, body.get('book_id'), cat)
    FavoriteModel.delete(user_id, body.get('book_id'))
    return {'success': True}

@router.post("/user/move")
def move_category(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    cat = body.get('new_category')
    if cat not in ('planned','reading','read'): raise HTTPException(400, "Неверная категория")
    UserBookModel.update_status(user_id, body.get('book_id'), cat)
    FavoriteModel.delete(user_id, body.get('book_id'))
    return {'success': True}

@router.post("/user/remove")
def remove_from_library(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    user_id = uid(x_user_id)
    book_id = body.get('book_id')
    if not book_id:
        raise HTTPException(400, "book_id required")
    UserBookModel.delete(user_id, book_id)
    return {'success': True, 'message': 'Книга удалена из библиотеки'}

@router.post("/user/update")
def user_update_book(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    """Allow users to update book metadata (title, author, genre, year, description)."""
    uid(x_user_id)
    book_id = body.get('book_id')
    if not book_id:
        raise HTTPException(400, "book_id required")
    title = body.get('title', '').strip()
    author = body.get('author', '').strip()
    genre = body.get('genre', '').strip()
    year = body.get('year')
    description = body.get('description', '').strip()
    if not title or not author:
        raise HTTPException(400, "title and author required")
    BookModel.update(book_id, title, author, genre or 'Другое', year, description)
    return {'success': True, 'message': 'Книга успешно обновлена'}


@router.get("/audio-proxy")
async def proxy_audio(
        path: str,
        x_user_id: Optional[str] = Header(None)
):
    """Прокси для аудио файлов"""
    uid(x_user_id)
    try:
        from app.services.minio_service import get_minio_client, MINIO_BUCKET
        from fastapi.responses import StreamingResponse

        client = get_minio_client()
        if path.startswith(f'{MINIO_BUCKET}/'):
            path = path[len(f'{MINIO_BUCKET}/'):]
        response = client.get_object(MINIO_BUCKET, path)
        return StreamingResponse(
            response.stream(amt=1024*1024),
            media_type="audio/mpeg",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": f"inline; filename={path.split('/')[-1]}"
            }
        )
    except Exception as e:
        print(f"Audio proxy error: {e}")
        raise HTTPException(404, "Audio file not found")


@router.get("")
def get_all(x_user_id: Optional[str] = Header(None)):
    try:
        uid(x_user_id)
        books = BookModel.get_all()
        result = [book_to_dict(b) for b in books]
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки книг: {str(e)}")

@router.post("/search")
def search(body: dict = Body(...), x_user_id: Optional[str] = Header(None)):
    uid(x_user_id)
    return [book_to_dict(b) for b in BookModel.search(body.get('search_term',''))]

@router.get("/{book_id}")
def get_one(book_id: int, x_user_id: Optional[str] = Header(None)):
    try:
        uid(x_user_id)
        b = BookModel.get_by_id(book_id)
        if not b:
            raise HTTPException(404, "Книга не найдена")
        result = book_full(b)
        return result
    except Exception as e:
        print(f"Error in get_one: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Internal error: {str(e)}")

@router.post("")
async def add_book(
        title: str = Form(...), author: str = Form(...), genre: str = Form(...),
        year: Optional[str] = Form(None), description: Optional[str] = Form(None),
        image: Optional[UploadFile] = File(None),
        pdf_file: Optional[UploadFile] = File(None),
        audio_file: Optional[UploadFile] = File(None),
        x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)
):
    uid(x_user_id); admin_only(x_user_role)
    book_id = BookModel.create(title, author, genre, year, description)
    img_path = None
    if image and image.filename:
        data = await image.read()
        img_path = upload_book_cover(data, image.filename, image.content_type, book_id)
        if img_path: BookModel.update(book_id, title, author, genre, year, description, img_path)
    if pdf_file and pdf_file.filename:
        data = await pdf_file.read()
        path = upload_pdf(data, pdf_file.filename, book_id)
        if path: BookModel.update_files(book_id, pdf_filename=path)
    if audio_file and audio_file.filename:
        data = await audio_file.read()
        path = upload_audio(data, audio_file.filename, book_id)
        if path: BookModel.update_files(book_id, audio_filename=path)
    return {'success': True, 'message': 'Книга успешно добавлена', 'book_id': book_id}

@router.put("/{book_id}")
async def update_book(
        book_id: int,
        title: str = Form(...), author: str = Form(...), genre: str = Form(...),
        year: Optional[str] = Form(None), description: Optional[str] = Form(None),
        image: Optional[UploadFile] = File(None),
        x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)
):
    uid(x_user_id); admin_only(x_user_role)
    img_path = None
    if image and image.filename:
        old = BookModel.get_by_id(book_id)
        if old and old[6]: delete_file(old[6])
        data = await image.read()
        img_path = upload_book_cover(data, image.filename, image.content_type, book_id)
    BookModel.update(book_id, title, author, genre, year, description, img_path)
    return {'success': True, 'message': 'Книга успешно обновлена'}

@router.delete("/{book_id}")
def delete_book(book_id: int, x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)):
    uid(x_user_id); admin_only(x_user_role)
    old = BookModel.get_by_id(book_id)
    if old and old[6]: delete_file(old[6])
    BookModel.delete(book_id)
    return {'success': True, 'message': 'Книга удалена'}

@router.post("/{book_id}/upload-files")
async def upload_book_files(
        book_id: int,
        pdf_file: Optional[UploadFile] = File(None),
        audio_file: Optional[UploadFile] = File(None),
        x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)
):
    uid(x_user_id); admin_only(x_user_role)
    pdf_path = audio_path = None
    if pdf_file and pdf_file.filename:
        pdf_path = upload_pdf(await pdf_file.read(), pdf_file.filename, book_id)
    if audio_file and audio_file.filename:
        audio_path = upload_audio(await audio_file.read(), audio_file.filename, book_id)
    if pdf_path or audio_path:
        BookModel.update_files(book_id, pdf_path, audio_path)
    return {'success': True, 'pdf_path': pdf_path, 'audio_path': audio_path}

@router.get("/{book_id}/files")
def get_book_files(book_id: int, x_user_id: Optional[str] = Header(None)):
    uid(x_user_id)
    f = BookModel.get_files(book_id)
    tracks = AudioTrackModel.get_by_book(book_id)
    return {
        'pdf_url': get_file_url(f['pdf_filename']),
        'audio_url': get_file_url(f['audio_filename']),
        'audio_tracks': [{'id': t['id'], 'track_order': t['track_order'],
                          'title': t['title'], 'url': get_file_url(t['filename'])} for t in tracks]
    }


@router.get("/{book_id}/audio-tracks")
def get_audio_tracks(book_id: int, x_user_id: Optional[str] = Header(None)):
    uid(x_user_id)
    tracks = AudioTrackModel.get_by_book(book_id)
    return [{'id': t['id'], 'track_order': t['track_order'],
             'title': t['title'], 'url': get_file_url(t['filename'])} for t in tracks]

@router.post("/{book_id}/audio-tracks")
async def add_audio_track(
        book_id: int,
        title: str = Form(...),
        track_order: Optional[int] = Form(None),
        audio_file: UploadFile = File(...),
        x_user_id: Optional[str] = Header(None),
        x_user_role: Optional[str] = Header(None)
):
    uid(x_user_id)
    admin_only(x_user_role)
    book = BookModel.get_by_id(book_id)
    if not book:
        raise HTTPException(404, "Книга не найдена")
    order = track_order if track_order else AudioTrackModel.get_next_order(book_id)
    data = await audio_file.read()
    print(f"Read {len(data)} bytes from {audio_file.filename}")
    temp_filename = f"temp_{book_id}_{order}.tmp"
    track_id = AudioTrackModel.create(book_id, title, order, temp_filename)
    path = upload_audio_track(data, audio_file.filename, book_id, track_id)
    if not path:
        AudioTrackModel.delete(track_id)
        raise HTTPException(500, "Ошибка загрузки файла в MinIO")
    from app.database import get_db_connection
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE book_audio_tracks SET filename=%s WHERE id=%s", (path, track_id))
    conn.commit()
    cur.close()
    conn.close()
    print(f"Track created: id={track_id}, path={path}")
    return {
        'success': True,
        'id': track_id,
        'track_order': order,
        'title': title,
        'url': get_file_url(path)
    }

@router.delete("/{book_id}/audio-tracks/{track_id}")
def delete_audio_track(
        book_id: int, track_id: int,
        x_user_id: Optional[str] = Header(None), x_user_role: Optional[str] = Header(None)
):
    uid(x_user_id); admin_only(x_user_role)
    filename = AudioTrackModel.delete(track_id)
    if filename: delete_file(get_file_url(filename))
    return {'success': True}

@router.post("/{book_id}/convert-to-md")
async def convert_to_md(
        book_id: int,
        pdf_url: str,
        x_user_id: Optional[str] = Header(None)
):
    """Конвертирует PDF книгу в Markdown"""
    uid(x_user_id)
    try:
        import requests
        response = requests.get(pdf_url)
        if response.status_code != 200:
            raise HTTPException(400, "Failed to download PDF")
        import fitz
        import io
        pdf_data = io.BytesIO(response.content)
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        md_content = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            lines = text.split('\n')
            cleaned = [line.strip() for line in lines if line.strip() and not line.strip().isdigit()]
            if cleaned:
                md_content.append(f"### Страница {page_num + 1}\n\n")
                md_content.append(' '.join(cleaned))
                md_content.append('\n\n')
        doc.close()
        md_filename = f"book_{book_id}.md"
        from app.services.minio_service import upload_markdown
        md_path = upload_markdown(
            '\n'.join(md_content).encode('utf-8'),
            md_filename,
            book_id
        )
        BookModel.update_files(book_id, md_filename=md_path)
        return {
            'success': True,
            'md_url': get_file_url(md_path),
            'message': 'PDF converted to Markdown successfully'
        }
    except Exception as e:
        print(f"Conversion error: {e}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")