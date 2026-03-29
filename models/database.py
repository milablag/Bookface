import psycopg2
from config import DB_CONFIG

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def create_tables():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                profile_image VARCHAR(255)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                profile_image VARCHAR(255)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                author VARCHAR(100) NOT NULL,
                genre VARCHAR(50) NOT NULL,
                year INTEGER,
                description TEXT,
                image_filename VARCHAR(255)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS marathons (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('system', 'user')),
                book_count INTEGER NOT NULL,
                duration VARCHAR(50),
                description TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_books (
                user_id INTEGER NOT NULL REFERENCES users(id),
                book_id INTEGER NOT NULL REFERENCES books(id),
                status VARCHAR(20) NOT NULL CHECK (status IN ('planned', 'reading', 'read')),
                PRIMARY KEY (user_id, book_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS favorites (
                user_id INTEGER NOT NULL REFERENCES users(id),
                book_id INTEGER NOT NULL REFERENCES books(id),
                PRIMARY KEY (user_id, book_id)
            )
        """)

        conn.commit()
        print("Таблицы успешно созданы или уже существуют")

    except Exception as e:
        print(f"Ошибка при создании таблиц: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cursor.close()
            conn.close()