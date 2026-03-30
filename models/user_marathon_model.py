from models.database import get_db_connection

class UserMarathonModel:
    @staticmethod
    def add_participant(user_id, marathon_id, is_creator=False, progress=0):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_marathons (user_id, marathon_id, progress, is_creator)
            VALUES (%s, %s, %s, %s)
        """, (user_id, marathon_id, progress, is_creator))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def get_participation(user_id, marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT progress, is_creator FROM user_marathons
            WHERE user_id = %s AND marathon_id = %s
        """, (user_id, marathon_id))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result

    @staticmethod
    def update_progress(user_id, marathon_id, progress):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_marathons
            SET progress = %s
            WHERE user_id = %s AND marathon_id = %s
        """, (progress, user_id, marathon_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def update_progress_null(user_id, marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_marathons
            SET progress = NULL
            WHERE user_id = %s AND marathon_id = %s
        """, (user_id, marathon_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete_participant(user_id, marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM user_marathons
            WHERE user_id = %s AND marathon_id = %s
        """, (user_id, marathon_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete_all_by_marathon(marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_marathons WHERE marathon_id = %s", (marathon_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def is_creator(user_id, marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM user_marathons
            WHERE user_id = %s AND marathon_id = %s AND is_creator = TRUE
        """, (user_id, marathon_id))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result is not None