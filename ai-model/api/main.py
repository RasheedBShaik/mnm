
import csv
import json
import os
import shutil
import threading
import uuid
from pathlib import Path
from math import ceil

import torch
from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    BackgroundTasks,
    HTTPException,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments,
    TrainerCallback,
)

# =========================================================
# 1. ENVIRONMENT CONFIGURATION
# =========================================================

# =========================================================
# 1. ENVIRONMENT CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def resolve_path(value, default):
    path = Path(os.getenv(value, default))
    return path if path.is_absolute() else BASE_DIR / path


MODEL_PATH = resolve_path(
    "MODEL_PATH",
    "models/maintenance-bert"
)

DATA_PATH = resolve_path(
    "DATA_PATH",
    "data/data.json"
)

NEW_MODEL_PATH = MODEL_PATH.parent / "maintenance-bert-new"
OLD_MODEL_PATH = MODEL_PATH.parent / "maintenance-bert-old"

EPOCHS = int(os.getenv("EPOCHS", "3"))
MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_LENGTH = 128
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))


# =========================================================
# 2. CORS CONFIGURATION
# =========================================================

# =========================================================
# CORS CONFIGURATION
# =========================================================

def get_allowed_origins():
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()

    if not raw:
        raise ValueError(
            "ALLOWED_ORIGINS is missing from .env"
        )

    try:
        origins = json.loads(raw)

        if not isinstance(origins, list):
            raise ValueError(
                "ALLOWED_ORIGINS must be a JSON array."
            )

        origins = [
            str(origin).strip().rstrip("/")
            for origin in origins
            if str(origin).strip()
        ]

        if not origins:
            raise ValueError(
                "No valid CORS origins configured."
            )

        return origins

    except json.JSONDecodeError as error:
        raise ValueError(
            f"Invalid ALLOWED_ORIGINS JSON: {error}"
        )


ALLOWED_ORIGINS = get_allowed_origins()

print("CORS ORIGINS:", ALLOWED_ORIGINS)
# =========================================================
# 2. DEVICE CONFIGURATION
# =========================================================

if torch.cuda.is_available():
    device = torch.device("cuda")
elif torch.backends.mps.is_available():
    device = torch.device("mps")
else:
    device = torch.device("cpu")

print("Loading MNM BERT model...")
print("Model path:", MODEL_PATH)
print("Dataset path:", DATA_PATH)
print("Allowed origins:", ALLOWED_ORIGINS)
print("Device:", device)

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

print("MNM BERT model loaded successfully!")

# =========================================================
# 3. FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="MNM AI Classifier",
    description="Maintenance Complaint Classification API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# 4. LOCKS AND TRAINING STATUS
# =========================================================

training_lock = threading.Lock()
dataset_lock = threading.RLock()
model_lock = threading.RLock()

training_status = {
    "status": "idle",
    "progress": 0,
    "message": "Ready",
    "job_id": None,
}

# =========================================================
# 5. REQUEST MODELS
# =========================================================

class ComplaintRequest(BaseModel):
    complaint: str


class DatasetRecordUpdate(BaseModel):
    text: str
    category: str


# =========================================================
# 6. DATASET FUNCTIONS
# =========================================================

def load_dataset():
    """Load dataset from local JSON storage."""

    with dataset_lock:
        if not DATA_PATH.exists():
            return []

        try:
            with open(DATA_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
        except json.JSONDecodeError as error:
            raise ValueError(
                f"Dataset JSON is corrupted: {error}"
            )

        if isinstance(data, dict):
            data = data.get("complaints", [])

        if not isinstance(data, list):
            raise ValueError(
                "Dataset must contain a complaints list."
            )

        return data


def save_dataset(records):
    """Safely save dataset using atomic file replacement."""

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)

    temporary_path = DATA_PATH.with_suffix(".tmp")

    with dataset_lock:
        try:
            with open(
                temporary_path,
                "w",
                encoding="utf-8"
            ) as file:
                json.dump(
                    {"complaints": records},
                    file,
                    indent=2,
                    ensure_ascii=False,
                )

                file.flush()
                os.fsync(file.fileno())

            os.replace(temporary_path, DATA_PATH)

        finally:
            if temporary_path.exists():
                temporary_path.unlink()


def get_next_id(records):
    """Generate the next available record ID."""

    highest_id = max(
        (
            int(record.get("id", 0))
            for record in records
            if str(record.get("id", "")).isdigit()
        ),
        default=0,
    )

    return highest_id + 1


def read_uploaded_file(file_name, content):
    """Read CSV or JSON dataset uploads."""

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError(
            "Please upload a UTF-8 CSV or JSON file."
        )

    if file_name.endswith(".json"):
        data = json.loads(text)

        if isinstance(data, dict):
            data = data.get("complaints", [])

    elif file_name.endswith(".csv"):
        data = list(csv.DictReader(text.splitlines()))

    else:
        raise ValueError(
            "Only CSV and JSON files are supported."
        )

    if not isinstance(data, list) or not data:
        raise ValueError(
            "No complaint records were found."
        )

    records = []

    for number, row in enumerate(data, start=1):

        if not isinstance(row, dict):
            raise ValueError(
                f"Invalid record at row {number}."
            )

        complaint = str(
            row.get("text") or row.get("complaint") or ""
        ).strip()

        category = str(
            row.get("category") or ""
        ).strip()

        if not complaint or not category:
            raise ValueError(
                f"Row {number} must contain text and category."
            )

        records.append({
            "text": complaint,
            "category": category,
        })

    return records

# =========================================================
# 7. BASIC API ROUTES
# =========================================================

@app.get("/")
def home():
    return {
        "message": "MNM AI Classifier API is running",
        "device": str(device),
        "status": "online",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "device": str(device),
        "model_loaded": model is not None,
    }


# =========================================================
# 8. DATASET INFORMATION
# =========================================================

@app.get("/dataset/info")
def dataset_info():
    try:
        records = load_dataset()

        categories = sorted({
            str(record.get("category", ""))
            for record in records
            if record.get("category")
        })

        return {
            "total_records": len(records),
            "total_categories": len(categories),
            "categories": categories,
            "latest_records": records[-10:],
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


@app.get("/dataset")
def get_dataset():
    return dataset_info()


# =========================================================
# 9. PAGINATED DATASET API
# =========================================================

@app.get("/dataset/records")
def get_dataset_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str = Query("", max_length=200),
    category: str = Query("", max_length=100),
):
    try:
        records = load_dataset()

        search_term = search.strip().casefold()
        category_filter = category.strip().casefold()

        # Search text, category and ID.
        if search_term:
            records = [
                record for record in records
                if (
                    search_term in str(
                        record.get("text", "")
                    ).casefold()
                    or search_term in str(
                        record.get("category", "")
                    ).casefold()
                    or search_term in str(
                        record.get("id", "")
                    ).casefold()
                )
            ]

        # Category filtering.
        if category_filter:
            records = [
                record for record in records
                if str(
                    record.get("category", "")
                ).casefold() == category_filter
            ]

        total_records = len(records)

        total_pages = (
            ceil(total_records / page_size)
            if total_records else 0
        )

        actual_page = min(
            page,
            max(total_pages, 1),
        )

        start = (actual_page - 1) * page_size
        paginated_records = records[
            start:start + page_size
        ]

        return {
            "records": paginated_records,
            "total_records": total_records,
            "page": actual_page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": actual_page < total_pages,
            "has_previous": actual_page > 1,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load dataset: {str(error)}",
        )


# =========================================================
# 10. UPDATE DATASET RECORD
# =========================================================

@app.put("/dataset/records/{record_id}")
def update_dataset_record(
    record_id: int,
    request: DatasetRecordUpdate,
):
    text = request.text.strip()
    category = request.category.strip()

    if not text or not category:
        raise HTTPException(
            status_code=400,
            detail="Text and category cannot be empty.",
        )

    try:
        with dataset_lock:
            records = load_dataset()

            record = next(
                (
                    item for item in records
                    if str(item.get("id", "")) == str(record_id)
                ),
                None,
            )

            if record is None:
                raise HTTPException(
                    status_code=404,
                    detail="Dataset record not found.",
                )

            record["text"] = text
            record["category"] = category

            save_dataset(records)

        return {
            "message": "Dataset record updated successfully.",
            "record": record,
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not update record: {str(error)}",
        )


# =========================================================
# 11. DELETE DATASET RECORD
# =========================================================

@app.delete("/dataset/records/{record_id}")
def delete_dataset_record(record_id: int):
    try:
        with dataset_lock:
            records = load_dataset()

            updated_records = [
                record for record in records
                if str(record.get("id", "")) != str(record_id)
            ]

            if len(updated_records) == len(records):
                raise HTTPException(
                    status_code=404,
                    detail="Dataset record not found.",
                )

            save_dataset(updated_records)

        return {
            "message": "Dataset record deleted successfully.",
            "deleted_id": record_id,
            "total_records": len(updated_records),
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete record: {str(error)}",
        )


# =========================================================
# 12. BERT PREDICTION
# =========================================================

@app.post("/predict")
def predict(request: ComplaintRequest):

    complaint = request.complaint.strip()

    if not complaint:
        raise HTTPException(
            status_code=400,
            detail="Please enter a complaint.",
        )

    try:
        with model_lock:

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
                    probabilities[0][predicted_id].item()
                    * 100
                )

            category = model.config.id2label[predicted_id]

        return {
            "complaint": complaint,
            "category": category,
            "confidence": round(confidence, 2),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}",
        )


# =========================================================
# 13. TRAINING DATASET CLASS
# =========================================================

class ComplaintDataset(torch.utils.data.Dataset):

    def __init__(self, complaints, labels, training_tokenizer):

        self.encodings = training_tokenizer(
            complaints,
            truncation=True,
            padding="max_length",
            max_length=MAX_LENGTH,
        )

        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, index):

        item = {
            key: torch.tensor(
                value[index],
                dtype=torch.long,
            )
            for key, value in self.encodings.items()
        }

        item["labels"] = torch.tensor(
            self.labels[index],
            dtype=torch.long,
        )

        return item


# =========================================================
# 14. TRAINING PROGRESS CALLBACK
# =========================================================

class TrainingProgress(TrainerCallback):

    def on_step_end(
        self,
        args,
        state,
        control,
        **kwargs,
    ):

        if state.max_steps > 0:

            progress = int(
                state.global_step / state.max_steps * 100
            )

            training_status.update({
                "progress": min(progress, 99),
                "message": (
                    f"Training: step "
                    f"{state.global_step}/{state.max_steps}"
                ),
            })

        return control

# =========================================================
# 15. TRAIN THE BERT MODEL
# =========================================================

def train_model(records, job_id):

    global model, tokenizer

    try:

        training_status.update({
            "status": "training",
            "progress": 0,
            "message": "Preparing training data...",
            "job_id": job_id,
        })

        if len(records) < 2:
            raise ValueError(
                "At least two records are required for training."
            )

        # Extract complaints and categories.
        complaints = [
            str(record["text"]).strip()
            for record in records
        ]

        categories = sorted({
            str(record["category"]).strip()
            for record in records
        })

        if len(categories) < 2:
            raise ValueError(
                "Training requires at least two categories."
            )

        # Convert categories into numerical labels.
        label_to_id = {
            category: index
            for index, category in enumerate(categories)
        }

        id_to_label = {
            index: category
            for category, index in label_to_id.items()
        }

        labels = [
            label_to_id[record["category"]]
            for record in records
        ]

        training_status.update({
            "progress": 2,
            "message": "Loading BERT model...",
        })

        # Load a fresh model and tokenizer.
        new_tokenizer = AutoTokenizer.from_pretrained(
            MODEL_PATH
        )

        new_model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_PATH,
            num_labels=len(categories),
            ignore_mismatched_sizes=True,
        )

        # Reset classification layer for the new categories.
        if hasattr(new_model, "classifier"):
            new_model.classifier.reset_parameters()

        new_model.config.id2label = id_to_label
        new_model.config.label2id = label_to_id

        new_model.to(device)

        # Prepare tokenized training data.
        training_data = ComplaintDataset(
            complaints,
            labels,
            new_tokenizer,
        )

        # Prepare temporary model directory.
        if NEW_MODEL_PATH.exists():
            shutil.rmtree(NEW_MODEL_PATH)

        NEW_MODEL_PATH.mkdir(
            parents=True,
            exist_ok=True,
        )

        training_status.update({
            "progress": 5,
            "message": "Starting BERT training...",
        })

        # Training settings.
        settings = TrainingArguments(
            output_dir=str(NEW_MODEL_PATH / "training"),

            num_train_epochs=EPOCHS,

            per_device_train_batch_size=BATCH_SIZE,

            learning_rate=2e-5,

            logging_steps=10,

            save_strategy="no",

            report_to="none",

            fp16=(device.type == "cuda"),

            dataloader_num_workers=0,

            remove_unused_columns=True,
        )

        trainer = Trainer(
            model=new_model,
            args=settings,
            train_dataset=training_data,
            callbacks=[TrainingProgress()],
        )

        trainer.train()

        training_status.update({
            "progress": 95,
            "message": "Saving newly trained model...",
        })

        # Save trained model and tokenizer.
        trainer.save_model(str(NEW_MODEL_PATH))

        new_tokenizer.save_pretrained(
            str(NEW_MODEL_PATH)
        )

        # Load the newly trained model before replacing
        # the existing production model.
        candidate_tokenizer = AutoTokenizer.from_pretrained(
            NEW_MODEL_PATH
        )

        candidate_model = AutoModelForSequenceClassification.from_pretrained(
            NEW_MODEL_PATH
        )

        candidate_model.to(device)
        candidate_model.eval()

        training_status.update({
            "progress": 98,
            "message": "Activating the new model...",
        })

        # Backup the previous model.
        if OLD_MODEL_PATH.exists():
            shutil.rmtree(OLD_MODEL_PATH)

        if MODEL_PATH.exists():
            MODEL_PATH.rename(OLD_MODEL_PATH)

        try:

            NEW_MODEL_PATH.rename(MODEL_PATH)

            # Safely replace the active in-memory model.
            with model_lock:

                model = candidate_model
                tokenizer = candidate_tokenizer

            # Remove backup only after successful activation.
            if OLD_MODEL_PATH.exists():
                shutil.rmtree(OLD_MODEL_PATH)

        except Exception:

            # Restore the previous model directory.
            if MODEL_PATH.exists():
                shutil.rmtree(MODEL_PATH)

            if OLD_MODEL_PATH.exists():
                OLD_MODEL_PATH.rename(MODEL_PATH)

            raise

        training_status.update({
            "status": "completed",
            "progress": 100,
            "message": "Training completed successfully!",
            "job_id": job_id,
        })

        print(
            f"Training completed successfully. Job: {job_id}"
        )

    except Exception as error:

        print("TRAINING ERROR:", str(error))

        training_status.update({
            "status": "failed",
            "progress": 0,
            "message": str(error),
            "job_id": job_id,
        })

        if NEW_MODEL_PATH.exists():
            shutil.rmtree(
                NEW_MODEL_PATH,
                ignore_errors=True,
            )

    finally:

        if training_lock.locked():
            training_lock.release()


# =========================================================
# 16. UPLOAD DATASET AND START TRAINING
# =========================================================

@app.post("/train")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):

    if not training_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail="Training is already running. Please wait.",
        )

    training_started = False

    try:

        file_name = (
            file.filename or ""
        ).lower()

        if not file_name.endswith((".json", ".csv")):
            raise HTTPException(
                status_code=400,
                detail="Please upload a CSV or JSON file.",
            )

        content = await file.read()

        await file.close()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File size must be less than 20 MB.",
            )

        # Read uploaded records.
        new_records = read_uploaded_file(
            file_name,
            content,
        )

        # Load existing dataset.
        with dataset_lock:

            existing_records = load_dataset()

            next_id = get_next_id(existing_records)

            # Assign unique IDs.
            for record in new_records:

                record["id"] = next_id
                next_id += 1

            # Append uploaded records.
            all_records = (
                existing_records + new_records
            )

            # Save dataset before starting training.
            save_dataset(all_records)

        job_id = str(uuid.uuid4())

        training_status.update({
            "status": "queued",
            "progress": 0,
            "message": "Dataset added. Training is queued.",
            "job_id": job_id,
        })

        # Schedule training in the background.
        background_tasks.add_task(
            train_model,
            all_records,
            job_id,
        )

        training_started = True

        return {
            "message": "Dataset added successfully.",
            "new_records": len(new_records),
            "total_records": len(all_records),
            "first_new_id": new_records[0]["id"],
            "last_new_id": new_records[-1]["id"],
            "job_id": job_id,
            "status": "queued",
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    finally:

        # Release lock if training was not scheduled.
        if not training_started and training_lock.locked():
            training_lock.release()


# =========================================================
# 17. CHECK TRAINING PROGRESS
# =========================================================

@app.get("/train/progress/{job_id}")
def get_training_progress(job_id: str):

    if training_status["job_id"] != job_id:
        raise HTTPException(
            status_code=404,
            detail="Training job not found.",
        )

    return training_status
