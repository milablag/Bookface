from models.database import get_db_connection

class BookModel:
    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM books ORDER BY title")
        books = cursor.fetchall()
        cursor.close()
        conn.close()
        return books

    @staticmethod
    def search(term):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM books
            WHERE title ILIKE %s OR author ILIKE %s
            ORDER BY title
        """, (f'%{term}%', f'%{term}%'))
        books = cursor.fetchall()
        cursor.close()
        conn.close()
        return books

    @staticmethod
    def get_by_id(book_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM books WHERE id = %s", (book_id,))
        book = cursor.fetchone()
        cursor.close()
        conn.close()
        return book

    @staticmethod
    def create(title, author, genre, year, description):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO books (title, author, genre, year, description)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (title, author, genre, year if year else None, description if description else None))
        book_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return book_id

    @staticmethod
    def update(book_id, title, author, genre, year, description, image_filename=None):
        conn = get_db_connection()
        cursor = conn.cursor()

        if image_filename:
            cursor.execute("""
                UPDATE books
                SET title = %s, author = %s, genre = %s, year = %s, description = %s, image_filename = %s
                WHERE id = %s
            """, (title, author, genre, year if year else None, description if description else None, image_filename, book_id))
        else:
            cursor.execute("""
                UPDATE books
                SET title = %s, author = %s, genre = %s, year = %s, description = %s
                WHERE id = %s
            """, (title, author, genre, year if year else None, description if description else None, book_id))

        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete(book_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT image_filename FROM books WHERE id = %s", (book_id,))
        image_filename = cursor.fetchone()

        cursor.execute("DELETE FROM books WHERE id = %s", (book_id,))
        conn.commit()

        cursor.close()
        conn.close()
        return image_filename[0] if image_filename else None

    @staticmethod
    def get_tinder_books(user_id, limit=20):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.* FROM books b
            WHERE b.id NOT IN (
                SELECT book_id FROM user_books WHERE user_id = %s
            )
            AND b.id NOT IN (
                SELECT book_id FROM favorites WHERE user_id = %s
            )
            ORDER BY RANDOM()
            LIMIT %s
        """, (user_id, user_id, limit))
        books = cursor.fetchall()
        cursor.close()
        conn.close()
        return books