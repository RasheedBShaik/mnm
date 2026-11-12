
import torch
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# ==========================================
# CONFIGURATION
# ==========================================

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "maintenance-bert"

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

# ==========================================
# LOAD MODEL
# ==========================================

print("Loading MNM AI model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.to(DEVICE)
model.eval()

print("\nMNM MAINTENANCE CLASSIFIER")
print("Model status: WORKING")
print("Device:", DEVICE)
print("Type 'exit' or press Ctrl+C to quit.")

# ==========================================
# PREDICTION LOOP
# ==========================================

try:
    while True:

        complaint = input("\nEnter complaint: ").strip()

        if complaint.lower() == "exit":
            break

        if not complaint:
            print("Please enter a complaint.")
            continue

        inputs = tokenizer(
            complaint,
            return_tensors="pt",
            truncation=True,
            max_length=128
        ).to(DEVICE)

        with torch.inference_mode():
            outputs = model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=1)

        predicted_id = probabilities.argmax(dim=1).item()

        category = model.config.id2label[predicted_id]
        confidence = probabilities[0, predicted_id].item() * 100

        print("\n---------- RESULT ----------")
        print("Category  :", category)
        print("Confidence:", f"{confidence:.2f}%")
        print("----------------------------")

except KeyboardInterrupt:
    pass

finally:
    print("\nGoodbye!")
