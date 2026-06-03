import time
import psycopg2
from psycopg2 import pool as pg_pool
from app.config import DB_CONFIG

_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        for attempt in range(5):
            try:
                _pool = pg_pool.ThreadedConnectionPool(2, 15, **DB_CONFIG)
                print("✅ Пул соединений с БД создан (2-15 conn)")
                break
            except Exception as e:
                if attempt < 4:
                    print(f"Попытка {attempt + 1}/5 подключения к БД...")
                    time.sleep(3)
                else:
                    raise e
    return _pool


class _PooledConn:
    """
    Обёртка: при close() возвращает соединение в пул вместо физического закрытия.
    Все существующие conn.close() работают без изменений.
    """
    __slots__ = ("_conn", "_pool")

    def __init__(self, conn, pool):
        object.__setattr__(self, "_conn", conn)
        object.__setattr__(self, "_pool", pool)

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_conn"), name)

    def __setattr__(self, name, value):
        setattr(object.__getattribute__(self, "_conn"), name, value)

    def close(self):
        p = object.__getattribute__(self, "_pool")
        c = object.__getattribute__(self, "_conn")
        try:
            p.putconn(c)
        except Exception:
            c.close()

    def cursor(self, *args, **kwargs):
        return object.__getattribute__(self, "_conn").cursor(*args, **kwargs)

    def commit(self):
        return object.__getattribute__(self, "_conn").commit()

    def rollback(self):
        return object.__getattribute__(self, "_conn").rollback()


def get_db_connection():
    """Берёт соединение из пула. conn.close() вернёт его обратно."""
    p = _get_pool()
    return _PooledConn(p.getconn(), p)


def init_db():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(100) NOT NULL,
            profile_image VARCHAR(255)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(100) NOT NULL,
            profile_image VARCHAR(255)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(100) NOT NULL,
            genre VARCHAR(50) NOT NULL,
            year INTEGER,
            description TEXT,
            image_filename VARCHAR(255),
            pdf_filename VARCHAR(255),
            audio_filename VARCHAR(255),
            md_filename VARCHAR(255)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS marathons (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('system','user')),
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
            book_count INTEGER NOT NULL,
            duration VARCHAR(50),
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS user_books (
            user_id INTEGER NOT NULL REFERENCES users(id),
            book_id INTEGER NOT NULL REFERENCES books(id),
            status VARCHAR(20) NOT NULL CHECK (status IN ('planned','reading','read')),
            PRIMARY KEY (user_id, book_id)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS favorites (
            user_id INTEGER NOT NULL REFERENCES users(id),
            book_id INTEGER NOT NULL REFERENCES books(id),
            PRIMARY KEY (user_id, book_id)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS user_marathons (
            user_id INTEGER NOT NULL REFERENCES users(id),
            marathon_id INTEGER NOT NULL REFERENCES marathons(id),
            progress INTEGER DEFAULT 0,
            is_creator BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (user_id, marathon_id)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS marathon_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            marathon_id INTEGER NOT NULL REFERENCES marathons(id),
            notes TEXT,
            UNIQUE (user_id, marathon_id)
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS book_audio_tracks (
            id SERIAL PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            track_order INTEGER NOT NULL DEFAULT 1,
            title VARCHAR(255) NOT NULL DEFAULT 'Часть 1',
            filename VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS user_audio_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            book_id INTEGER NOT NULL REFERENCES books(id),
            audio_time FLOAT DEFAULT 0,
            is_playing BOOLEAN DEFAULT FALSE,
            volume FLOAT DEFAULT 0.7,
            current_track_index INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, book_id)
        )""")

        cur.execute("""ALTER TABLE user_audio_progress
            ADD COLUMN IF NOT EXISTS current_track_index INTEGER DEFAULT 0""")

        cur.execute("""ALTER TABLE books
            ADD COLUMN IF NOT EXISTS md_filename VARCHAR(255)""")

        cur.execute("""CREATE TABLE IF NOT EXISTS reading_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            book_id INTEGER NOT NULL REFERENCES books(id),
            current_page INTEGER DEFAULT 1,
            total_pages INTEGER DEFAULT 0,
            percentage FLOAT DEFAULT 0,
            last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, book_id)
        )""")

        cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_books_title_trgm  ON books USING gin (title gin_trgm_ops)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_books_author_trgm ON books USING gin (author gin_trgm_ops)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_books_genre       ON books (genre)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_books_user   ON user_books (user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user    ON favorites  (user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audio_tracks_book ON book_audio_tracks (book_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_uaudio_user_book  ON user_audio_progress (user_id, book_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_rp_user_book      ON reading_progress (user_id, book_id)")

        conn.commit()

        cur.execute("""INSERT INTO admins (username, email, password)
            VALUES ('admin','admin@mail.ru','admin') ON CONFLICT (username) DO NOTHING""")
        cur.execute("""INSERT INTO users (username, email, password)
            VALUES ('user','user@mail.ru','user') ON CONFLICT (username) DO NOTHING""")
        conn.commit()
        print("✅ БД инициализирована. admin/admin@mail.ru/admin | user/user@mail.ru/user")
    except Exception as e:
        print(f"Ошибка инициализации БД: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()