"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
const API_URLS: string[] = JSON.parse(
  process.env.NEXT_PUBLIC_API_URLS || "[]"
);

const IS_LOCAL =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

const API_URL = IS_LOCAL
  ? API_URLS.find((url) => url.includes("127.0.0.1")) ||
    "http://127.0.0.1:8000"
  : API_URLS.find((url) => url.includes("railway.app")) ||
    "https://mnm-production-de44b4b8.up.railway.app";

// Normalize the URL and ensure it has a protocol.
const BASE_URL = API_URL.startsWith("http")
  ? API_URL
  : `https://${API_URL}`;
interface Prediction {
  complaint: string;
  category: string;
  confidence: number;
}

interface DatasetRecord {
  text: string;
  category: string;
}

interface TrainingProgress {
  status: string;
  progress: number;
  message: string;
}

export default function Home() {
  // Complaint classification
  const [complaint, setComplaint] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState("");

  // Dataset information and input
  const [records, setRecords] = useState<(DatasetRecord & { id: number })[]>(
    [],
  );

  const [editText, setEditText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  
  const [datasetCount, setDatasetCount] = useState<number | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  // Training
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trainingMessage, setTrainingMessage] = useState("");
  const [trainingError, setTrainingError] = useState("");
  const [trainingSuccess, setTrainingSuccess] = useState(false);
  const [jobId, setJobId] = useState("");

  async function readError(response: Response, fallback: string) {
    try {
      const data = await response.json();
      return data.detail || data.message || fallback;
    } catch {
      return fallback;
    }
  }

  // Read the number of records stored by the backend.
  async function refreshDataset() {
    setDatasetLoading(true);
    setDatasetError("");

    try {
      const response = await fetch(`${API_URL}/dataset/info`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not load dataset information."),
        );
      }

      const data = await response.json();
      const count =
        data.total_records ?? data.count ?? data.record_count ?? data.total;

      if (typeof count !== "number") {
        throw new Error("The dataset API did not return a record count.");
      }

      setDatasetCount(count);
    } catch (error) {
      setDatasetError(
        error instanceof Error
          ? error.message
          : "Could not connect to the backend.",
      );
    } finally {
      setDatasetLoading(false);
    }
  }

  useEffect(() => {
    refreshDataset();
  }, []);

  // Send one complaint to the BERT model.
  async function classifyComplaint() {
    if (!complaint.trim()) {
      setPredictError("Please enter a maintenance complaint.");
      return;
    }

    setPredicting(true);
    setPredictError("");
    setPrediction(null);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: complaint.trim() }),
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not classify the complaint."),
        );
      }

      const data = await response.json();
      if (
        typeof data.category !== "string" ||
        typeof data.confidence !== "number"
      ) {
        throw new Error("The backend returned an invalid prediction.");
      }

      setPrediction({
        complaint: data.complaint || complaint.trim(),
        category: data.category,
        confidence: Math.min(100, Math.max(0, data.confidence)),
      });
    } catch (error) {
      setPredictError(
        error instanceof Error
          ? error.message
          : "Could not connect to the backend.",
      );
    } finally {
      setPredicting(false);
    }
  }

  // Accept either [ {...} ] or { "complaints": [ {...} ] }.
  function validateJSON(value: string): string | null {
    if (!value.trim()) return "Please enter JSON data.";

    try {
      const parsed: unknown = JSON.parse(value);
      const records = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" &&
            parsed !== null &&
            "complaints" in parsed
          ? (parsed as { complaints: unknown }).complaints
          : null;

      if (!Array.isArray(records) || records.length === 0) {
        return 'JSON must be a non-empty array or an object containing a "complaints" array.';
      }

      const valid = records.every(
        (record) =>
          typeof record === "object" &&
          record !== null &&
          !Array.isArray(record) &&
          typeof (record as DatasetRecord).text === "string" &&
          (record as DatasetRecord).text.trim().length > 0 &&
          typeof (record as DatasetRecord).category === "string" &&
          (record as DatasetRecord).category.trim().length > 0,
      );

      return valid
        ? null
        : "Every record must contain non-empty text and category fields.";
    } catch {
      return "Please enter valid JSON.";
    }
  }

  function changeJSON(value: string) {
    setJsonText(value);
    setFile(null);
    setTrainingError("");
    setTrainingSuccess(false);
    setJsonError(value.trim() ? validateJSON(value) || "" : "");
  }

  function changeFile(selected: File | null) {
    setFile(null);
    setJsonText("");
    setJsonError("");
    setTrainingError("");
    setTrainingSuccess(false);

    if (!selected) return;

    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "json") {
      setTrainingError("Only CSV and JSON files are supported.");
      return;
    }
    if (selected.size === 0) {
      setTrainingError("The selected file is empty.");
      return;
    }

    // Check JSON files before sending them to the backend.
    if (extension === "json") {
      const reader = new FileReader();
      reader.onload = () => {
        const error = validateJSON(String(reader.result || ""));
        if (error) {
          setTrainingError(error);
        } else {
          setFile(selected);
        }
      };
      reader.onerror = () => setTrainingError("Could not read the JSON file.");
      reader.readAsText(selected);
    } else {
      setFile(selected);
    }
  }

  // Ask the backend for real training progress until the job finishes.
  async function watchTraining(id: string) {
    for (let attempt = 0; attempt < 1200; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await fetch(
        `${API_URL}/train/progress/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not get training progress."),
        );
      }

      const data: TrainingProgress = await response.json();
      const currentProgress = Number(data.progress);
      if (!Number.isFinite(currentProgress)) {
        throw new Error("The backend returned an invalid progress value.");
      }

      setProgress(Math.min(100, Math.max(0, currentProgress)));
      setTrainingMessage(data.message || "Training is running...");

      const status = String(data.status || "").toLowerCase();
      if (["completed", "complete", "success", "successful"].includes(status)) {
        setProgress(100);
        setTrainingSuccess(true);
        setTrainingMessage(
          data.message || "Model training completed successfully.",
        );
        return;
      }

      if (["failed", "error", "cancelled", "canceled"].includes(status)) {
        throw new Error(data.message || "Model training failed.");
      }
    }

    throw new Error(
      "Training is taking longer than expected. Check the backend.",
    );
  }

  function startEditing(record: DatasetRecord & { id: number }) {
    setEditingId(record.id);
    setEditText(record.text);
    setEditCategory(record.category);
  }


  // Upload the dataset and start model training.
  async function trainModel() {
    if (training) return;

    if (!file && !jsonText.trim()) {
      setTrainingError("Choose a CSV/JSON file or paste JSON data first.");
      return;
    }

    if (jsonText.trim()) {
      const error = validateJSON(jsonText);
      if (error) {
        setJsonError(error);
        setTrainingError("Please fix the JSON validation error.");
        return;
      }
    }

    setTraining(true);
    setProgress(0);
    setTrainingError("");
    setTrainingSuccess(false);
    setTrainingMessage("Uploading dataset...");
    setJobId("");

    try {
      const formData = new FormData();

      if (jsonText.trim()) {
        // Keep IDs out of the frontend. The backend creates sequential IDs.
        const jsonFile = new File([jsonText], "training-dataset.json", {
          type: "application/json",
        });
        formData.append("file", jsonFile);
      } else if (file) {
        formData.append("file", file);
      }

      const response = await fetch(`${API_URL}/train`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Could not upload the dataset or start training.",
          ),
        );
      }

      const data = await response.json();
      const id = data.job_id || data.id;
      if (!id) throw new Error("The backend did not return a training job ID.");

      setJobId(String(id));
      setTrainingMessage(
        data.message || "Dataset uploaded. Training started...",
      );
      await watchTraining(String(id));
      await refreshDataset();
    } catch (error) {
      setTrainingSuccess(false);
      setTrainingError(
        error instanceof Error
          ? error.message
          : "An unexpected training error occurred.",
      );
      setTrainingMessage("Training failed.");
    } finally {
      setTraining(false);
    }
  }

  function clearDatasetInput() {
    if (training) return;
    setFile(null);
    setJsonText("");
    setJsonError("");
    setTrainingError("");
    setTrainingSuccess(false);
    setProgress(0);
    setTrainingMessage("");
    setJobId("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            MNM AI Classifier
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Intelligent Maintenance Complaint Classification powered by BERT and
            FastAPI.
          </p>
        </header>

        {/* Dataset count and training status */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Dataset Overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Current records saved by the backend.
              </p>
            </div>
            <button
              onClick={refreshDataset}
              disabled={datasetLoading}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {datasetLoading ? "Refreshing..." : "Refresh Dataset"}
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-blue-50 p-5">
              <p className="text-sm font-medium text-blue-700">
                Dataset Records
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-900">
                {datasetCount === null ? "N/A" : datasetCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 p-5">
              <p className="text-sm font-medium text-purple-700">
                Training Status
              </p>
              <p className="mt-2 text-xl font-bold text-purple-900">
                {training
                  ? "Training..."
                  : trainingSuccess
                    ? "Completed"
                    : "Ready"}
              </p>
            </div>
          </div>
          {datasetError && (
            <p className="mt-3 text-sm text-red-600">{datasetError}</p>
          )}
        </section>

{/* Dataset Management */}
<section className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 className="text-lg font-bold">Dataset Management</h2>
      <p className="mt-1 text-sm text-slate-500">
        Manage, search, edit and delete your maintenance records.
      </p>
    </div>

    <Link
      href="/dataset"
      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Manage Dataset →
    </Link>
  </div>
</section>

        {/* Complaint classification */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold">Analyze Complaint</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Enter a maintenance issue and let the trained model predict its
            category.
          </p>
          <label
            htmlFor="complaint"
            className="mb-2 mt-6 block text-sm font-semibold"
          >
            Maintenance Complaint
          </label>
          <textarea
            id="complaint"
            value={complaint}
            onChange={(event) => {
              setComplaint(event.target.value);
              setPredictError("");
            }}
            rows={5}
            disabled={predicting}
            placeholder="Example: The air conditioner is not cooling the meeting room."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>Describe the issue clearly.</span>
            <span>{complaint.length} characters</span>
          </div>
          <button
            onClick={classifyComplaint}
            disabled={predicting || !complaint.trim()}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {predicting ? "Analyzing Complaint..." : "Classify Complaint"}
          </button>
          {predictError && (
            <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {predictError}
            </p>
          )}
          {prediction && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-700">
                Predicted Category
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-3xl font-bold text-emerald-900">
                  {prediction.category}
                </h3>
                <p className="rounded-xl bg-white px-4 py-3 text-xl font-bold text-emerald-700">
                  {prediction.confidence.toFixed(2)}%
                </p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${prediction.confidence}%` }}
                />
              </div>
              <p className="mt-4 border-t border-emerald-200 pt-4 text-sm leading-6 text-emerald-900">
                <strong>Complaint:</strong> {prediction.complaint}
              </p>
            </div>
          )}
        </section>

        {/* Dataset upload and model training */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold">
            Dataset Management & Model Training
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Upload a CSV/JSON file or paste JSON records, then train the model
            with the updated dataset.
          </p>

          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            New records are added to the existing dataset. The backend preserves
            old records and assigns new sequential IDs automatically. You only
            need to provide <strong>text</strong> and <strong>category</strong>.
          </div>

          <label
            htmlFor="dataset-file"
            className="mb-2 mt-6 block text-sm font-semibold"
          >
            Upload CSV or JSON
          </label>
          <input
            id="dataset-file"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={training}
            onChange={(event) => changeFile(event.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white disabled:opacity-50"
          />
          {file && (
            <p className="mt-2 text-sm text-emerald-700">
              Selected: {file.name}
            </p>
          )}

          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> OR PASTE JSON{" "}
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="json-input" className="text-sm font-semibold">
              JSON Training Data
            </label>
            {jsonText.trim() && (
              <span
                className={`text-xs font-semibold ${jsonError ? "text-red-600" : "text-emerald-700"}`}
              >
                {jsonError || "Valid JSON"}
              </span>
            )}
          </div>
          <textarea
            id="json-input"
            value={jsonText}
            onChange={(event) => changeJSON(event.target.value)}
            disabled={training}
            rows={9}
            spellCheck={false}
            placeholder={
              '[\n  {\n    "text": "The sink is leaking water.",\n    "category": "Plumbing"\n  }\n]'
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm"
          />
          <p className="mt-2 text-xs text-slate-400">
            JSON can be an array or an object with a complaints array. IDs are
            optional.
          </p>
          {jsonError && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {jsonError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={clearDatasetInput}
              disabled={training}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Clear Input
            </button>
            <button
              onClick={trainModel}
              disabled={training || (!file && !jsonText.trim()) || !!jsonError}
              className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-slate-300"
            >
              {training ? "Training Model..." : "Train AI Model"}
            </button>
          </div>

          {(training || progress > 0 || trainingError || trainingSuccess) && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold">Training Progress</h3>
                <span className="text-sm font-semibold">
                  {trainingSuccess
                    ? "Completed"
                    : trainingError
                      ? "Failed"
                      : training
                        ? "Running"
                        : "Pending"}
                </span>
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <span>Progress</span>
                <strong>{Math.round(progress)}%</strong>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full transition-all ${trainingError ? "bg-red-500" : trainingSuccess ? "bg-emerald-500" : "bg-purple-600"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-600">{trainingMessage}</p>
              {jobId && (
                <p className="mt-2 break-all text-xs text-slate-400">
                  Job ID: {jobId}
                </p>
              )}
              {trainingError && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {trainingError}
                </p>
              )}
              {trainingSuccess && (
                <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Model trained successfully. Dataset count:{" "}
                  {datasetCount ?? "Refresh to check"}
                </p>
              )}
            </div>
          )}
        </section>


        <footer className="mt-8 pb-4 text-center text-sm text-slate-500">
          MNM AI Classifier · Powered by BERT, FastAPI and Next.js
        </footer>
      </div>
    </main>
  );
}
