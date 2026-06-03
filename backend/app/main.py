from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db
from app.routers import auth, users, profile


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    try:
        from app.services.minio_service import init_minio_bucket
        init_minio_bucket()
    except Exception as e:
        print(f"MinIO не доступен: {e}")
    yield


app = FastAPI(title="BookFace API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://frontend:5000",
        "http://frontend",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(users.router,   prefix="/api/users",   tags=["users"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
