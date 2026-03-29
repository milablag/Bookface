from models.database import get_db_connection

class UserModel:
    @staticmethod
    def get_by_email(email):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        return user

    @staticmethod
    def get_by_username(username):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        return user

    @staticmethod
    def create(username, email, password):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s) RETURNING id",
            (username, email, password)
        )
        user_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return user_id

    @staticmethod
    def get_profile_image(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT profile_image FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        return user[0] if user and user[0] else None

    @staticmethod
    def get_profile_data(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, profile_image FROM users WHERE id = %s", (user_id,))
        data = cursor.fetchone()
        cursor.close()
        conn.close()
        return data

    @staticmethod
    def update_profile(user_id, username, email, password, profile_image):
        conn = get_db_connection()
        cursor = conn.cursor()

        updates = []
        params = []

        if username:
            updates.append("username = %s")
            params.append(username)
        if email:
            updates.append("email = %s")
            params.append(email)
        if password:
            updates.append("password = %s")
            params.append(password)
        if profile_image:
            updates.append("profile_image = %s")
            params.append(profile_image)

        if updates:
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            params.append(user_id)
            cursor.execute(query, params)
            conn.commit()
            success = True
        else:
            success = False

        cursor.close()
        conn.close()
        return success