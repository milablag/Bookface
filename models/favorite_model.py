from models.database import get_db_connection

class FavoriteModel:
    @staticmethod
    def get_by_user(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.* FROM books b
            JOIN favorites f ON b.id = f.book_id
            WHERE f.user_id = %s
            ORDER BY b.title
        """, (user_id,))
        books = cursor.fetchall()
        cursor.close()
        conn.close()
        return books

    @staticmethod
    def add(user_id, book_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO favorites (user_id, book_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, book_id) DO NOTHING
        """, (user_id, book_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete(user_id, book_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM favorites
            WHERE user_id = %s AND book_id = %s
        """, (user_id, book_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True