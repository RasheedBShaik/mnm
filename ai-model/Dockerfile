FROM python:3.13-slim

WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your entire project (including your 414MB models/ folder) into the cloud server
COPY . .

# Start the FastAPI app
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}