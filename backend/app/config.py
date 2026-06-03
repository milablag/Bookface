import os

DB_CONFIG = {
    'dbname':   os.environ.get('DB_NAME',     'bookface'),
    'user':     os.environ.get('DB_USER',     'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'postgres123'),
    'host':     os.environ.get('DB_HOST',     'postgres'),
    'port':     os.environ.get('DB_PORT',     '5432'),
}

MINIO_ENDPOINT   = os.environ.get('MINIO_ENDPOINT',   'minio:9000')
MINIO_ACCESS_KEY = os.environ.get('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.environ.get('MINIO_SECRET_KEY', 'minioadmin123')
MINIO_BUCKET     = os.environ.get('MINIO_BUCKET',     'bookface')
MINIO_SECURE     = os.environ.get('MINIO_SECURE',     'False').lower() == 'true'
MINIO_PUBLIC_URL = os.environ.get('MINIO_PUBLIC_URL', 'http://localhost:9000')
