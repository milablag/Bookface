FROM python:3.11-slim
WORKDIR /app

# Увеличиваем таймаут и количество retry для стабильной загрузки больших пакетов
RUN pip config set global.timeout 300 && \
    pip config set global.retries 10

COPY requirements.txt .

# --no-cache-dir экономит место; retry встроен через pip config
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
