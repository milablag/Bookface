from models.database import get_db_connection

class AdminModel:
    @staticmethod
    def get_profile_image(admin_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT profile_image FROM admins WHERE id = %s", (admin_id,))
        admin = cursor.fetchone()
        cursor.close()
        conn.close()
        return admin[0] if admin and admin[0] else None

    @staticmethod
    def get_profile_data(admin_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, profile_image FROM admins WHERE id = %s", (admin_id,))
        data = cursor.fetchone()
        cursor.close()
        conn.close()
        return data