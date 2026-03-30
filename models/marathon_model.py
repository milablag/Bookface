from models.database import get_db_connection

class MarathonModel:
    @staticmethod
    def get_all(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                m.id,
                m.name,
                m.type,
                m.book_count,
                m.duration,
                m.description,
                m.created_at,
                EXISTS (
                    SELECT 1 FROM user_marathons 
                    WHERE marathon_id = m.id AND user_id = %s
                ) AS is_joined,
                u.username AS creator_name,
                EXISTS (
                    SELECT 1 FROM user_marathons 
                    WHERE marathon_id = m.id AND user_id = %s AND is_creator = TRUE
                ) AS is_creator
            FROM marathons m
            LEFT JOIN users u ON m.type = 'user' AND u.id = (
                SELECT user_id FROM user_marathons
                WHERE marathon_id = m.id AND is_creator = TRUE LIMIT 1
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM user_marathons 
                WHERE marathon_id = m.id AND user_id = %s AND is_creator = TRUE
            )
            AND NOT EXISTS (  -- Добавлено: исключаем завершенные марафоны
                SELECT 1 FROM user_marathons 
                WHERE marathon_id = m.id AND user_id = %s AND progress >= m.book_count
            )
            ORDER BY m.created_at DESC
        """, (user_id, user_id, user_id, user_id))  # Добавлен параметр
        marathons = cursor.fetchall()
        cursor.close()
        conn.close()
        return marathons

    @staticmethod
    def get_system(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT m.*, 
                   um.user_id IS NOT NULL AS is_joined,
                   um.progress,
                   (SELECT COUNT(*) FROM user_marathons WHERE marathon_id = m.id) AS participants_count
            FROM marathons m
            LEFT JOIN user_marathons um ON m.id = um.marathon_id AND um.user_id = %s
            WHERE m.type = 'system'
            ORDER BY m.created_at DESC
        """, (user_id,))
        marathons = cursor.fetchall()
        cursor.close()
        conn.close()
        return marathons

    @staticmethod
    def get_user_marathons():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT ON (m.id)
                m.id,
                m.name,
                m.type,
                m.book_count,
                m.duration,
                m.description,
                m.created_at,
                u.username AS creator_name
            FROM marathons m
            JOIN user_marathons um ON m.id = um.marathon_id
            JOIN users u ON um.user_id = u.id
            WHERE m.type = 'user'
            ORDER BY m.id, m.created_at ASC
        """)
        marathons = cursor.fetchall()
        cursor.close()
        conn.close()
        return marathons

    @staticmethod
    def get_my(user_id, role):
        conn = get_db_connection()
        cursor = conn.cursor()

        if role == 'admin':
            cursor.execute("""
                SELECT
                    m.id,
                    m.name,
                    m.type,
                    m.book_count,
                    m.duration,
                    m.description,
                    m.created_at,
                    FALSE AS is_participant,
                    0 AS progress
                FROM marathons m
                WHERE m.type = 'system'
                ORDER BY m.created_at DESC
            """)
        else:
            cursor.execute("""
                SELECT
                    m.id,
                    m.name,
                    m.type,
                    m.book_count,
                    m.duration,
                    m.description,
                    m.created_at,
                    um.progress IS NOT NULL AS is_participant,
                    COALESCE(um.progress, 0) AS progress
                FROM marathons m
                JOIN user_marathons um ON m.id = um.marathon_id
                WHERE um.user_id = %s AND um.is_creator = TRUE
                ORDER BY m.created_at DESC
            """, (user_id,))

        marathons = cursor.fetchall()
        cursor.close()
        conn.close()
        return marathons

    @staticmethod
    def get_active(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                m.id,
                m.name,
                m.type,
                m.book_count,
                m.duration,
                m.description,
                m.created_at,
                COALESCE(um.progress, 0) as progress,
                u.username AS creator_name,
                COALESCE(um.is_creator, FALSE) as is_creator
            FROM user_marathons um
            JOIN marathons m ON um.marathon_id = m.id
            LEFT JOIN users u ON (
                SELECT user_id FROM user_marathons 
                WHERE marathon_id = m.id AND is_creator = TRUE LIMIT 1
            ) = u.id
            WHERE um.user_id = %s
              AND um.progress IS NOT NULL
              AND (um.progress < m.book_count OR um.progress IS NULL)
            ORDER BY m.created_at DESC
        """, (user_id,))
        marathons = cursor.fetchall()
        cursor.close()
        conn.close()
        return marathons

    @staticmethod
    def get_completed(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT m.*, um.progress,
        (SELECT u.username FROM users u 
         JOIN user_marathons um2 ON u.id = um2.user_id 
         WHERE um2.marathon_id = m.id AND um2.is_creator = TRUE 
         LIMIT 1) AS creator_name
        FROM marathons m
        JOIN user_marathons um ON m.id = um.marathon_id
        WHERE um.user_id = %s AND um.progress > 0 AND um.progress >= m.book_count
        ORDER BY m.created_at DESC
        """, (user_id,))
        marathons = cursor.fetchall()
        cursor.close()
        conn.close()
        return marathons

    @staticmethod
    def get_by_id(marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, type, book_count, duration, description 
            FROM marathons WHERE id = %s
        """, (marathon_id,))
        marathon = cursor.fetchone()
        cursor.close()
        conn.close()
        return marathon

    @staticmethod
    def create(name, type, book_count, duration, description):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO marathons (name, type, book_count, duration, description)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (name, type, book_count, duration, description))
        marathon_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return marathon_id

    @staticmethod
    def update(marathon_id, name, book_count, duration, description):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE marathons
            SET name = %s, book_count = %s, duration = %s, description = %s
            WHERE id = %s
        """, (name, book_count, duration, description, marathon_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def delete(marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM marathons WHERE id = %s", (marathon_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def get_type(marathon_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT type FROM marathons WHERE id = %s", (marathon_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result[0] if result else None