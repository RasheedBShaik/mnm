
import torch
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Project paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "maintenance-bert"

# Device
DEVICE = torch.device(
    "mps" if torch.backends.mps.is_available() else "cpu"
)

# Load model once when API starts
print("Loading MNM BERT model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_PATH
)

model.to(DEVICE)
model.eval()

print("BERT model loaded successfully!")

# Create API
app = FastAPI(
    title="MNM Maintenance AI API",
    description="AI-powered maintenance complaint classification",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        # ADD YOUR FRONTEND DEV TUNNEL URL HERE
        # "https://pzrvhx4s-3000.inc1.devtunnels.ms",
                
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request format
class ComplaintRequest(BaseModel):
    complaint: str


# Health check
@app.get("/")
def home():
    return {
        "message": "MNM AI API is running",
        "model_loaded": True,
        "device": str(DEVICE)
    }


# Complaint prediction
@app.post("/predict")
def predict(request: ComplaintRequest):

    complaint = request.complaint.strip()

    if not complaint:
        raise HTTPException(
            status_code=400,
            detail="Complaint cannot be empty"
        )

    inputs = tokenizer(
        complaint,
        return_tensors="pt",
        truncation=True,
        max_length=128
    )

    inputs = {
        key: value.to(DEVICE)
        for key, value in inputs.items()
    }

    with torch.inference_mode():
        outputs = model(**inputs)

        probabilities = torch.softmax(
            outputs.logits,
            dim=1
        )

        predicted_id = probabilities.argmax(dim=1).item()

    category = model.config.id2label[predicted_id]
    confidence = probabilities[0][predicted_id].item()

    return {
        "complaint": complaint,
        "category": category,
        "confidence": round(confidence * 100, 2)
    }
