from models.database import get_db_connection

class UserBookModel:
    @staticmethod
    def get_by_user_and_status(user_id, status):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.* FROM books b
            JOIN user_books ub ON b.id = ub.book_id
            WHERE ub.user_id = %s AND ub.status = %s
            ORDER BY b.title
        """, (user_id, status))
        books = cursor.fetchall()
        cursor.close()
        conn.close()
        return books

    @staticmethod
    def add(user_id, book_id, status):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_books (user_id, book_id, status)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, book_id) DO UPDATE
            SET status = EXCLUDED.status
        """, (user_id, book_id, status))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def update_status(user_id, book_id, new_status):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_books
            SET status = %s
            WHERE user_id = %s AND book_id = %s
        """, (new_status, user_id, book_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete(user_id, book_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM user_books
            WHERE user_id = %s AND book_id = %s
        """, (user_id, book_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True