from app.database import get_db_connection
import fitz

class BookModel:


    @staticmethod
    def get_all():
        """
        Возвращает все книги + кол-во аудио-дорожек одним запросом.
        Столбцы: id, title, author, genre, year, description,
                 image_filename, pdf_filename, audio_filename, md_filename,
                 audio_track_count
        Устраняет N+1: раньше для каждой книги отдельно запрашивались треки.
        """
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT 
                b.id, 
                b.title, 
                b.author, 
                b.genre, 
                b.year, 
                b.description,
                b.image_filename, 
                b.pdf_filename, 
                b.audio_filename, 
                b.md_filename,
                COALESCE(COUNT(bat.id), 0) AS audio_track_count
            FROM books b
            LEFT JOIN book_audio_tracks bat ON bat.book_id = b.id
            GROUP BY 
                b.id, b.title, b.author, b.genre, b.year, b.description,
                b.image_filename, b.pdf_filename, b.audio_filename, b.md_filename
            ORDER BY b.title
        """)

        rows = cur.fetchall()

        print(f"=== get_all: fetched {len(rows)} books ===")
        if rows:
            for i, row in enumerate(rows[:3]):
                print(f"Book {i}: id={row[0]}, title={row[1]}, track_count={row[10] if len(row) > 10 else 'N/A'}")

        cur.close()
        conn.close()
        return rows


    @staticmethod
    def search(term):
        """Поиск с тем же enriched набором полей что и get_all."""
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                b.id, b.title, b.author, b.genre, b.year, b.description,
                b.image_filename, b.pdf_filename, b.audio_filename, b.md_filename,
                COALESCE(COUNT(bat.id), 0) AS audio_track_count
            FROM books b
            LEFT JOIN book_audio_tracks bat ON bat.book_id = b.id
            WHERE b.title ILIKE %s OR b.author ILIKE %s
            GROUP BY 
                b.id, b.title, b.author, b.genre, b.year, b.description,
                b.image_filename, b.pdf_filename, b.audio_filename, b.md_filename
            ORDER BY b.title
        """, (f'%{term}%', f'%{term}%'))
        r = cur.fetchall()
        cur.close()
        conn.close()
        return r

    @staticmethod
    def get_by_id(book_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM books WHERE id = %s", (book_id,))
        r = cur.fetchone()
        cur.close()
        conn.close()
        return r

    @staticmethod
    def get_by_title(title):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM books WHERE title = %s", (title,))
        r = cur.fetchone()
        cur.close()
        conn.close()
        return r

    @staticmethod
    def create(title, author, genre, year, description):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO books (title, author, genre, year, description)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (title, author, genre, year if year else None, description if description else None))
        id_ = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return id_

    @staticmethod
    def update(book_id, title, author, genre, year, description, image_filename=None):
        conn = get_db_connection()
        cur = conn.cursor()
        if image_filename:
            cur.execute("""
                UPDATE books SET title=%s, author=%s, genre=%s, year=%s,
                description=%s, image_filename=%s WHERE id=%s
            """, (title, author, genre, year if year else None,
                  description if description else None, image_filename, book_id))
        else:
            cur.execute("""
                UPDATE books SET title=%s, author=%s, genre=%s, year=%s,
                description=%s WHERE id=%s
            """, (title, author, genre, year if year else None,
                  description if description else None, book_id))
        conn.commit()
        cur.close()
        conn.close()
        return True

    @staticmethod
    def update_files(book_id, pdf_filename=None, audio_filename=None):
        conn = get_db_connection()
        cur = conn.cursor()
        if pdf_filename and audio_filename:
            cur.execute("UPDATE books SET pdf_filename=%s, audio_filename=%s WHERE id=%s",
                        (pdf_filename, audio_filename, book_id))
        elif pdf_filename:
            cur.execute("UPDATE books SET pdf_filename=%s WHERE id=%s", (pdf_filename, book_id))
        elif audio_filename:
            cur.execute("UPDATE books SET audio_filename=%s WHERE id=%s", (audio_filename, book_id))
        conn.commit()
        cur.close()
        conn.close()
        return True

    @staticmethod
    def delete(book_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT image_filename FROM books WHERE id=%s", (book_id,))
        img = cur.fetchone()
        cur.execute("DELETE FROM books WHERE id=%s", (book_id,))
        conn.commit()
        cur.close()
        conn.close()
        return img[0] if img else None


    @staticmethod
    def get_tinder_books(user_id, limit=20):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                b.id, b.title, b.author, b.genre, b.year, b.description,
                b.image_filename, b.pdf_filename, b.audio_filename, b.md_filename,
                COALESCE((SELECT COUNT(*) FROM book_audio_tracks WHERE book_id = b.id), 0) AS audio_track_count
            FROM books b
            WHERE b.id NOT IN (SELECT book_id FROM user_books WHERE user_id=%s)
            AND b.id NOT IN (SELECT book_id FROM favorites WHERE user_id=%s)
            ORDER BY RANDOM() LIMIT %s
        """, (user_id, user_id, limit))
        r = cur.fetchall()
        cur.close()
        conn.close()
        return r

    @staticmethod
    def get_files(book_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT pdf_filename, audio_filename FROM books WHERE id=%s", (book_id,))
        r = cur.fetchone()
        cur.close()
        conn.close()
        return {'pdf_filename': r[0] if r else None, 'audio_filename': r[1] if r else None}

    @staticmethod
    def convert_pdf_to_md(pdf_path, book_id):
        """Конвертирует PDF в Markdown и сохраняет как md файл"""
        try:
            import fitz
            import os

            doc = fitz.open(pdf_path)
            md_content = []

            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()

                lines = text.split('\n')
                cleaned_lines = []
                for line in lines:
                    line = line.strip()
                    if line and not line.isdigit() and len(line) > 2:
                        cleaned_lines.append(line)

                page_text = ' '.join(cleaned_lines)
                if page_text:
                    md_content.append(f"### Страница {page_num + 1}\n\n{page_text}\n\n")

            doc.close()

            md_filename = f"book_{book_id}.md"
            md_path = os.path.join('uploads', 'markdown', md_filename)
            os.makedirs(os.path.dirname(md_path), exist_ok=True)

            with open(md_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(md_content))

            return md_path
        except Exception as e:
            print(f"Error converting PDF to MD: {e}")
            return None


class AudioTrackModel:

    @staticmethod
    def get_by_book(book_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, book_id, track_order, title, filename
            FROM book_audio_tracks WHERE book_id=%s ORDER BY track_order
        """, (book_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [{'id': r[0], 'book_id': r[1], 'track_order': r[2],
                 'title': r[3], 'filename': r[4]} for r in rows]

    @staticmethod
    def get_by_id(track_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, book_id, track_order, title, filename
            FROM book_audio_tracks WHERE id=%s
        """, (track_id,))
        r = cur.fetchone()
        cur.close()
        conn.close()
        if r:
            return {'id': r[0], 'book_id': r[1], 'track_order': r[2],
                    'title': r[3], 'filename': r[4]}
        return None

    @staticmethod
    def create(book_id, title, track_order, filename):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO book_audio_tracks (book_id, title, track_order, filename)
            VALUES (%s, %s, %s, %s) RETURNING id
        """, (book_id, title, track_order, filename))
        id_ = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return id_

    @staticmethod
    def delete(track_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT filename FROM book_audio_tracks WHERE id=%s", (track_id,))
        r = cur.fetchone()
        cur.execute("DELETE FROM book_audio_tracks WHERE id=%s", (track_id,))
        conn.commit()
        cur.close()
        conn.close()
        return r[0] if r else None

    @staticmethod
    def get_next_order(book_id):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT COALESCE(MAX(track_order), 0) + 1
            FROM book_audio_tracks WHERE book_id=%s
        """, (book_id,))
        r = cur.fetchone()
        cur.close()
        conn.close()
        return r[0] if r else 1