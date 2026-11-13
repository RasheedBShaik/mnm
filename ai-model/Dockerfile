FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Automatically reassemble model parts into model.safetensors during build
RUN cat models/maintenance-bert/model_part_* > models/maintenance-bert/model.safetensors

CMD sh -c "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"