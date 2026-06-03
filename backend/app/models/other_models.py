from app.database import get_db_connection

class FavoriteModel:
    @staticmethod
    def get_by_user(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT b.* FROM books b JOIN favorites f ON b.id=f.book_id
            WHERE f.user_id=%s ORDER BY b.title""", (user_id,))
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def add(user_id, book_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO favorites (user_id,book_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                    (user_id, book_id))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def delete(user_id, book_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM favorites WHERE user_id=%s AND book_id=%s", (user_id, book_id))
        conn.commit(); cur.close(); conn.close(); return True


class UserBookModel:
    @staticmethod
    def get_by_user_and_status(user_id, status):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT b.id, b.title, b.author, b.genre, b.year, b.description,
                       b.image_filename, b.pdf_filename, b.audio_filename, b.md_filename
                FROM books b 
                JOIN user_books ub ON b.id = ub.book_id
                WHERE ub.user_id = %s AND ub.status = %s 
                ORDER BY b.title
            """, (user_id, status))
            r = cur.fetchall()
            return r
        except Exception as e:
            print(f"Error in get_by_user_and_status: {e}")
            return []
        finally:
            cur.close()
            conn.close()
    @staticmethod
    def add(user_id, book_id, status):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""INSERT INTO user_books (user_id,book_id,status) VALUES (%s,%s,%s)
            ON CONFLICT (user_id,book_id) DO UPDATE SET status=EXCLUDED.status""",
                    (user_id, book_id, status))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def update_status(user_id, book_id, new_status):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("UPDATE user_books SET status=%s WHERE user_id=%s AND book_id=%s",
                    (new_status, user_id, book_id))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def delete(user_id, book_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM user_books WHERE user_id=%s AND book_id=%s",
                    (user_id, book_id))
        conn.commit(); cur.close(); conn.close(); return True


class ReadingProgressModel:
    @staticmethod
    def save_progress(user_id, book_id, current_page, total_pages, percentage):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""INSERT INTO reading_progress (user_id,book_id,current_page,total_pages,percentage,last_read)
            VALUES (%s,%s,%s,%s,%s,NOW()) ON CONFLICT (user_id,book_id) DO UPDATE SET
            current_page=EXCLUDED.current_page, total_pages=EXCLUDED.total_pages,
            percentage=EXCLUDED.percentage, last_read=NOW()""",
                    (user_id, book_id, current_page, total_pages, percentage))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def get_progress(user_id, book_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT current_page,total_pages,percentage,last_read FROM reading_progress
            WHERE user_id=%s AND book_id=%s""", (user_id, book_id))
        r = cur.fetchone(); cur.close(); conn.close()
        if r: return {'current_page':r[0],'total_pages':r[1],'percentage':r[2],
                      'last_read':r[3].isoformat() if r[3] else None}
        return None


class AudioProgressModel:
    @staticmethod
    def save_progress(user_id, book_id, current_time, is_playing, volume, current_track_index=0):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""INSERT INTO user_audio_progress (user_id,book_id,audio_time,is_playing,volume,current_track_index,last_updated)
            VALUES (%s,%s,%s,%s,%s,%s,NOW()) ON CONFLICT (user_id,book_id) DO UPDATE SET
            audio_time=EXCLUDED.audio_time, is_playing=EXCLUDED.is_playing,
            volume=EXCLUDED.volume, current_track_index=EXCLUDED.current_track_index, last_updated=NOW()""",
                    (user_id, book_id, current_time, is_playing, volume, current_track_index))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def get_progress(user_id, book_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT audio_time,is_playing,volume,current_track_index FROM user_audio_progress
            WHERE user_id=%s AND book_id=%s""", (user_id, book_id))
        r = cur.fetchone(); cur.close(); conn.close()
        if r: return {'current_time':r[0],'is_playing':r[1],'volume':r[2],'current_track_index':r[3] or 0}
        return None


class MarathonModel:
    @staticmethod
    def get_all_approved(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.book_count,m.duration,m.description,m.created_at,
            EXISTS(SELECT 1 FROM user_marathons WHERE marathon_id=m.id AND user_id=%s) AS is_joined,
            (SELECT u.username FROM users u JOIN user_marathons um2 ON u.id=um2.user_id
             WHERE um2.marathon_id=m.id AND um2.is_creator=TRUE LIMIT 1) AS creator,
            EXISTS(SELECT 1 FROM user_marathons WHERE marathon_id=m.id AND user_id=%s AND is_creator=TRUE) AS is_creator,
            m.status
            FROM marathons m
            WHERE (m.type='system' OR (m.type='user' AND m.status='approved'))
            AND NOT EXISTS(SELECT 1 FROM user_marathons WHERE marathon_id=m.id AND user_id=%s AND is_creator=TRUE)
            AND NOT EXISTS(SELECT 1 FROM user_marathons WHERE marathon_id=m.id AND user_id=%s AND progress>=m.book_count)
            ORDER BY m.created_at DESC""", (user_id,)*4)
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_user_approved(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.status,m.book_count,m.duration,m.description,m.created_at,
            um.user_id IS NOT NULL AS is_joined, um.progress,
            (SELECT COUNT(*) FROM user_marathons WHERE marathon_id=m.id) AS cnt,
            u.username AS creator_name
            FROM marathons m
            LEFT JOIN user_marathons um ON m.id=um.marathon_id AND um.user_id=%s AND um.is_creator=TRUE
            LEFT JOIN users u ON um.user_id=u.id
            WHERE m.type='user' AND m.status='approved' ORDER BY m.created_at DESC""", (user_id,))
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_system(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.status,m.book_count,m.duration,m.description,m.created_at,
            um.user_id IS NOT NULL AS is_joined, um.progress,
            (SELECT COUNT(*) FROM user_marathons WHERE marathon_id=m.id) AS cnt
            FROM marathons m LEFT JOIN user_marathons um ON m.id=um.marathon_id AND um.user_id=%s
            WHERE m.type='system' AND m.status='approved' ORDER BY m.created_at DESC""", (user_id,))
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_active(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.book_count,m.duration,m.description,m.created_at,
            COALESCE(um.progress,0), NULL, COALESCE(um.is_creator,FALSE), m.status
            FROM user_marathons um JOIN marathons m ON um.marathon_id=m.id
            WHERE um.user_id=%s AND um.progress IS NOT NULL AND um.progress<m.book_count AND m.status='approved'
            ORDER BY m.created_at DESC""", (user_id,))
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_completed(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.status,m.book_count,m.duration,m.description,m.created_at,um.progress,NULL
            FROM marathons m JOIN user_marathons um ON m.id=um.marathon_id
            WHERE um.user_id=%s AND um.progress>=m.book_count AND m.status='approved'
            ORDER BY m.created_at DESC""", (user_id,))
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_my(user_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.book_count,m.duration,m.description,m.created_at,m.status,
            um.progress IS NOT NULL, COALESCE(um.progress,0)
            FROM marathons m JOIN user_marathons um ON m.id=um.marathon_id
            WHERE um.user_id=%s AND um.is_creator=TRUE ORDER BY m.created_at DESC""", (user_id,))
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_pending():
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""SELECT m.id,m.name,m.type,m.book_count,m.duration,m.description,m.created_at,u.username,u.id
            FROM marathons m JOIN user_marathons um ON m.id=um.marathon_id JOIN users u ON um.user_id=u.id
            WHERE m.type='user' AND m.status='pending' AND um.is_creator=TRUE ORDER BY m.created_at DESC""")
        r = cur.fetchall(); cur.close(); conn.close(); return r

    @staticmethod
    def get_by_id(mid):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT id,name,type,book_count,duration,description,status FROM marathons WHERE id=%s", (mid,))
        r = cur.fetchone(); cur.close(); conn.close(); return r

    @staticmethod
    def create(name, mtype, status, book_count, duration, description):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""INSERT INTO marathons (name,type,status,book_count,duration,description,created_at)
            VALUES (%s,%s,%s,%s,%s,%s,NOW()) RETURNING id""",
                    (name, mtype, status, book_count, duration, description))
        id_ = cur.fetchone()[0]; conn.commit(); cur.close(); conn.close(); return id_

    @staticmethod
    def update(mid, name, book_count, duration, description):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("UPDATE marathons SET name=%s,book_count=%s,duration=%s,description=%s WHERE id=%s",
                    (name, book_count, duration, description, mid))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def delete(mid):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM marathons WHERE id=%s", (mid,))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def set_status(mid, status):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("UPDATE marathons SET status=%s WHERE id=%s", (status, mid))
        conn.commit(); cur.close(); conn.close(); return True


class UserMarathonModel:
    @staticmethod
    def add(user_id, marathon_id, is_creator=False, progress=0):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""INSERT INTO user_marathons (user_id,marathon_id,progress,is_creator)
            VALUES (%s,%s,%s,%s)""", (user_id, marathon_id, progress, is_creator))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def get(user_id, marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT progress,is_creator FROM user_marathons WHERE user_id=%s AND marathon_id=%s",
                    (user_id, marathon_id))
        r = cur.fetchone(); cur.close(); conn.close(); return r

    @staticmethod
    def update_progress(user_id, marathon_id, progress):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("UPDATE user_marathons SET progress=%s WHERE user_id=%s AND marathon_id=%s",
                    (progress, user_id, marathon_id))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def set_progress_null(user_id, marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("UPDATE user_marathons SET progress=NULL WHERE user_id=%s AND marathon_id=%s",
                    (user_id, marathon_id))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def delete(user_id, marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM user_marathons WHERE user_id=%s AND marathon_id=%s", (user_id, marathon_id))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def delete_all(marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM user_marathons WHERE marathon_id=%s", (marathon_id,))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def is_creator(user_id, marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT 1 FROM user_marathons WHERE user_id=%s AND marathon_id=%s AND is_creator=TRUE",
                    (user_id, marathon_id))
        r = cur.fetchone(); cur.close(); conn.close(); return r is not None


class MarathonProgressModel:
    @staticmethod
    def get_notes(user_id, marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT notes FROM marathon_progress WHERE user_id=%s AND marathon_id=%s", (user_id, marathon_id))
        r = cur.fetchone(); cur.close(); conn.close(); return r[0] if r else None

    @staticmethod
    def update_notes(user_id, marathon_id, notes):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""UPDATE marathon_progress SET notes=%s WHERE user_id=%s AND marathon_id=%s""",
                    (notes, user_id, marathon_id))
        if cur.rowcount == 0:
            cur.execute("INSERT INTO marathon_progress (user_id,marathon_id,notes) VALUES (%s,%s,%s)",
                        (user_id, marathon_id, notes))
        conn.commit(); cur.close(); conn.close(); return True

    @staticmethod
    def delete_notes(user_id, marathon_id):
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM marathon_progress WHERE user_id=%s AND marathon_id=%s", (user_id, marathon_id))
        conn.commit(); cur.close(); conn.close(); return True
_orig_UBM = UserBookModel

