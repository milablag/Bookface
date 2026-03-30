from models.database import get_db_connection

class MarathonProgressModel:
    @staticmethod
    def get_notes(user_id, marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT notes FROM marathon_progress
            WHERE user_id = %s AND marathon_id = %s
        """, (user_id, marathon_id))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result[0] if result else None

    @staticmethod
    def update_notes(user_id, marathon_id, notes):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE marathon_progress
            SET notes = %s
            WHERE user_id = %s AND marathon_id = %s
        """, (notes, user_id, marathon_id))

        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO marathon_progress (user_id, marathon_id, notes)
                VALUES (%s, %s, %s)
            """, (user_id, marathon_id, notes))

        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete_notes(user_id, marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM marathon_progress
            WHERE user_id = %s AND marathon_id = %s
        """, (user_id, marathon_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True