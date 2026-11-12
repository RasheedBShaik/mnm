
import json
import torch
from pathlib import Path
from torch.utils.data import Dataset, DataLoader
from transformers import (
    BertTokenizer,
    BertForSequenceClassification
)
from tqdm import tqdm

# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "maintenance_dataset.json"
MODEL_PATH = BASE_DIR / "models" / "maintenance-bert"

MODEL_NAME = "google-bert/bert-base-cased"

EPOCHS = 10
BATCH_SIZE = 8
LEARNING_RATE = 2e-5
MAX_LENGTH = 128

DEVICE = torch.device(
    "mps" if torch.backends.mps.is_available()
    else "cpu"
)

# ==========================================
# LOAD DATASET
# ==========================================

print("\n========================================")
print("       MNM BERT TRAINING SYSTEM")
print("========================================")

print("\nLoading JSON dataset...")

if not DATA_PATH.exists():
    raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

with open(DATA_PATH, "r", encoding="utf-8") as file:
    data = json.load(file)

complaints = data["complaints"]

if not complaints:
    raise ValueError("Dataset is empty!")

# Validate records
for index, item in enumerate(complaints):
    if not item.get("text") or not item.get("category"):
        raise ValueError(f"Invalid dataset record at index {index}")

categories = sorted(set(
    item["category"] for item in complaints
))

label2id = {
    category: index
    for index, category in enumerate(categories)
}

id2label = {
    index: category
    for category, index in label2id.items()
}

print(f"Total complaints : {len(complaints)}")
print(f"Categories       : {len(categories)}")
print(f"Device           : {DEVICE}")

for category in categories:
    count = sum(
        item["category"] == category
        for item in complaints
    )
    print(f"{category:15}: {count}")

# ==========================================
# LOAD TOKENIZER
# ==========================================

print("\nLoading BERT tokenizer...")

tokenizer = BertTokenizer.from_pretrained(MODEL_NAME)

# ==========================================
# DATASET CLASS
# ==========================================

class MaintenanceDataset(Dataset):

    def __init__(self, records):
        self.records = records

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):

        item = self.records[index]

        # IMPORTANT: JSON uses "text"
        complaint = item["text"]
        category = item["category"]

        encoding = tokenizer(
            complaint,
            max_length=MAX_LENGTH,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(
                label2id[category],
                dtype=torch.long
            )
        }


dataset = MaintenanceDataset(complaints)

loader = DataLoader(
    dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=0
)

# ==========================================
# LOAD BERT MODEL
# ==========================================

print("\nLoading BERT classification model...")

model = BertForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=len(categories),
    id2label=id2label,
    label2id=label2id
)

model.to(DEVICE)

optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=LEARNING_RATE
)

# ==========================================
# TRAINING
# ==========================================

print("\n========================================")
print("          TRAINING STARTED")
print("========================================")

total_batches = len(loader)
total_steps = EPOCHS * total_batches
completed_steps = 0

print(f"Epochs           : {EPOCHS}")
print(f"Batch size       : {BATCH_SIZE}")
print(f"Batches/Epoch    : {total_batches}")
print(f"Total steps      : {total_steps}")
print(f"Learning rate    : {LEARNING_RATE}")

progress = tqdm(
    total=total_steps,
    desc="MNM Training",
    unit="batch",
    dynamic_ncols=True
)

epoch_losses = []

for epoch in range(EPOCHS):

    model.train()
    total_loss = 0

    for batch_number, batch in enumerate(loader, start=1):

        input_ids = batch["input_ids"].to(DEVICE)
        attention_mask = batch["attention_mask"].to(DEVICE)
        labels = batch["labels"].to(DEVICE)

        optimizer.zero_grad()

        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels
        )

        loss = outputs.loss

        loss.backward()
        optimizer.step()

        batch_loss = loss.item()
        total_loss += batch_loss

        completed_steps += 1

        percentage = (
            completed_steps / total_steps
        ) * 100

        progress.update(1)

        progress.set_postfix({
            "epoch": f"{epoch + 1}/{EPOCHS}",
            "batch": f"{batch_number}/{total_batches}",
            "loss": f"{batch_loss:.4f}",
            "overall": f"{percentage:.1f}%"
        })

    average_loss = total_loss / total_batches
    epoch_losses.append(average_loss)

    progress.write(
        f"Epoch {epoch + 1}/{EPOCHS} completed"
        f" | Average Loss: {average_loss:.4f}"
        f" | Overall: {percentage:.1f}%"
    )

progress.close()

# ==========================================
# SAVE MODEL
# ==========================================

print("\nSaving trained model...")

MODEL_PATH.mkdir(parents=True, exist_ok=True)

model.save_pretrained(MODEL_PATH)
tokenizer.save_pretrained(MODEL_PATH)

# Save category mapping
with open(
    MODEL_PATH / "labels.json",
    "w",
    encoding="utf-8"
) as file:
    json.dump(
        {
            "label2id": label2id,
            "id2label": {
                str(k): v for k, v in id2label.items()
            }
        },
        file,
        indent=4
    )

# ==========================================
# FINAL REPORT
# ==========================================

print("\n========================================")
print("          TRAINING COMPLETED")
print("========================================")

print(f"Total examples : {len(dataset)}")
print(f"Total epochs   : {EPOCHS}")
print(f"Total steps    : {completed_steps}")
print(f"Final loss     : {epoch_losses[-1]:.4f}")
print("Final progress : 100.00%")
print(f"Model saved at : {MODEL_PATH}")

print("\nEpoch Loss Report:")

for i, loss in enumerate(epoch_losses, start=1):
    print(f"Epoch {i:02d}: {loss:.4f}")

print("========================================")
