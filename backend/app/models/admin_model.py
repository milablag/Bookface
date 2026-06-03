from app.database import get_db_connection

class AdminModel:
    @staticmethod
    def get_profile_data(admin_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT id,username,email,profile_image FROM admins WHERE id=%s", (admin_id,))
        r = cur.fetchone(); cur.close(); conn.close(); return r

    @staticmethod
    def update_profile(admin_id, username=None, email=None, password=None, profile_image=None):
        conn = get_db_connection(); cur = conn.cursor()
        updates, params = [], []
        if username:      updates.append("username=%s");      params.append(username)
        if email:         updates.append("email=%s");         params.append(email)
        if password:      updates.append("password=%s");      params.append(password)
        if profile_image: updates.append("profile_image=%s"); params.append(profile_image)
        if updates:
            params.append(admin_id)
            cur.execute(f"UPDATE admins SET {','.join(updates)} WHERE id=%s", params)
            conn.commit()
        cur.close(); conn.close(); return bool(updates)

    @staticmethod
    def get_password(admin_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT password,profile_image FROM admins WHERE id=%s", (admin_id,))
        r = cur.fetchone(); cur.close(); conn.close(); return r
