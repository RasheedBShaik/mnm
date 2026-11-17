
import os
import json
import time
from pathlib import Path

import torch
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
)

# ==========================================
# 1. CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

MODEL_PATH = Path(
    os.getenv("MODEL_PATH", "models/maintenance-bert")
)

if not MODEL_PATH.is_absolute():
    MODEL_PATH = BASE_DIR / MODEL_PATH

MAX_LENGTH = 128

# ==========================================
# 2. DEVICE CONFIGURATION
# ==========================================

if torch.cuda.is_available():
    device = torch.device("cuda")
elif torch.backends.mps.is_available():
    device = torch.device("mps")
else:
    device = torch.device("cpu")

if device.type == "cpu":
    torch.set_num_threads(
        int(os.getenv("TORCH_NUM_THREADS", "2"))
    )
    torch.set_num_interop_threads(1)

print("Device:", device)
print("Model path:", MODEL_PATH)

# ==========================================
# 3. LOAD BERT MODEL
# ==========================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model directory not found: {MODEL_PATH}"
    )

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_PATH
)

model.to(device)
model.eval()

print("BERT model loaded successfully!")

# ==========================================
# 4. FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="MNM AI Classifier",
    description="Maintenance Complaint Classification API",
    version="2.0.0",
)

# ==========================================
# 5. CORS CONFIGURATION
# ==========================================

raw_origins = os.getenv("ALLOWED_ORIGINS", "")

if not raw_origins:
    raise ValueError("ALLOWED_ORIGINS is missing.")

try:
    ALLOWED_ORIGINS = json.loads(raw_origins)
except json.JSONDecodeError:
    raise ValueError("Invalid ALLOWED_ORIGINS configuration.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ==========================================
# 6. REQUEST MODEL
# ==========================================

class ComplaintRequest(BaseModel):
    complaint: str

# ==========================================
# 7. API STATUS
# ==========================================

@app.get("/")
def home():
    return {
        "message": "MNM AI Classifier API is running",
        "status": "online",
        "device": str(device),
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": str(device),
    }

# ==========================================
# 8. COMPLAINT CLASSIFICATION
# ==========================================

@app.post("/predict")
def predict(request: ComplaintRequest):

    complaint = request.complaint.strip()

    if not complaint:
        raise HTTPException(
            status_code=400,
            detail="Please enter a complaint.",
        )

    start_time = time.perf_counter()

    try:
        token_start = time.perf_counter()

        inputs = tokenizer(
            complaint,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LENGTH,
        )

        inputs = {
            key: value.to(device)
            for key, value in inputs.items()
        }

        token_time = time.perf_counter() - token_start

        inference_start = time.perf_counter()

        with torch.inference_mode():
            outputs = model(**inputs)

            probabilities = torch.softmax(
                outputs.logits,
                dim=1,
            )

            predicted_id = probabilities.argmax(
                dim=1
            ).item()

            confidence = (
                probabilities[0][predicted_id].item() * 100
            )

        inference_time = time.perf_counter() - inference_start

        category = model.config.id2label[predicted_id]

        total_time = time.perf_counter() - start_time

        print(f"Tokenization: {token_time:.3f}s")
        print(f"Inference: {inference_time:.3f}s")
        print(f"Total: {total_time:.3f}s")

        return {
            "complaint": complaint,
            "category": category,
            "confidence": round(confidence, 2),
        }

    except Exception as error:
        print("Prediction error:", str(error))

        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Please try again.",
        )
