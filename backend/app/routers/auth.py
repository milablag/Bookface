from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db_connection

router = APIRouter()

class LoginReq(BaseModel):
    email: str
    password: str

class RegisterReq(BaseModel):
    username: str
    email: str
    password: str

@router.post("/login")
def login(data: LoginReq):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username FROM admins WHERE email=%s AND password=%s",
            (data.email, data.password)
        )
        admin = cur.fetchone()
        if admin:
            cur.close()
            return {"id": admin[0], "username": admin[1], "role": "admin"}
        cur.execute(
            "SELECT id, username FROM users WHERE email=%s AND password=%s",
            (data.email, data.password)
        )
        user = cur.fetchone()
        cur.close()
        if user:
            return {"id": user[0], "username": user[1], "role": "user"}
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    finally:
        conn.close()

@router.post("/register")
def register(data: RegisterReq):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email=%s", (data.email,))
        if cur.fetchone():
            raise HTTPException(400, "Email уже зарегистрирован")
        cur.execute("SELECT id FROM users WHERE username=%s", (data.username,))
        if cur.fetchone():
            raise HTTPException(400, "Имя пользователя уже занято")
        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s) RETURNING id",
            (data.username, data.email, data.password)
        )
        uid = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return {"id": uid, "username": data.username, "role": "user"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"Ошибка регистрации: {str(e)}")
    finally:
        conn.close()
