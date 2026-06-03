from app.database import get_db_connection

class UserModel:
    @staticmethod
    def get_by_email(email):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email=%s", (email,))
        r = cur.fetchone(); cur.close(); conn.close(); return r

    @staticmethod
    def get_by_username(username):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username=%s", (username,))
        r = cur.fetchone(); cur.close(); conn.close(); return r

    @staticmethod
    def create(username, email, password):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO users (username,email,password) VALUES (%s,%s,%s) RETURNING id",
                    (username, email, password))
        id_ = cur.fetchone()[0]; conn.commit(); cur.close(); conn.close(); return id_

    @staticmethod
    def get_profile_data(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT id,username,email,profile_image FROM users WHERE id=%s", (user_id,))
        r = cur.fetchone(); cur.close(); conn.close(); return r

    @staticmethod
    def update_profile(user_id, username=None, email=None, password=None, profile_image=None):
        conn = get_db_connection(); cur = conn.cursor()
        updates, params = [], []
        if username:       updates.append("username=%s");       params.append(username)
        if email:          updates.append("email=%s");          params.append(email)
        if password:       updates.append("password=%s");       params.append(password)
        if profile_image:  updates.append("profile_image=%s");  params.append(profile_image)
        if updates:
            params.append(user_id)
            cur.execute(f"UPDATE users SET {','.join(updates)} WHERE id=%s", params)
            conn.commit()
        cur.close(); conn.close(); return bool(updates)

    @staticmethod
    def get_password(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT password,profile_image FROM users WHERE id=%s", (user_id,))
        r = cur.fetchone(); cur.close(); conn.close(); return r
