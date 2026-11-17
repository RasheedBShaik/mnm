
"use client";

import { useState } from "react";
import { BrainCircuit} from "lucide-react";

const API_URLS: string[] = JSON.parse(process.env.NEXT_PUBLIC_API_URLS || "[]");

function getApiUrl() {
  const isLocal = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const url = isLocal ? API_URLS.find((u) => u.includes("127.0.0.1")) : API_URLS.find((u) => u.includes("railway.app"));
  return (url || "https://mnm-production-de44b4b8.up.railway.app").replace(/\/+$/, "");
}

interface Prediction {
  complaint: string;
  category: string;
  confidence: number;

}

const categories = [
  { name: "Civil", icon: "🏗️", description: "Building structures, walls, floors, roofs and general civil maintenance.", color: "bg-orange-50 text-orange-700" },
  { name: "Security", icon: "🔒", description: "Security systems, surveillance, access control and safety issues.", color: "bg-red-50 text-red-700" },
  { name: "HVAC", icon: "❄️", description: "Heating, ventilation, air conditioning and cooling problems.", color: "bg-sky-50 text-sky-700" },
  { name: "Plumbing", icon: "🚰", description: "Water leakage, drainage, pipes and water supply problems.", color: "bg-cyan-50 text-cyan-700" },
  { name: "Electricity", icon: "⚡", description: "Electrical wiring, lighting, power supply and circuit issues.", color: "bg-yellow-50 text-yellow-700" },
  { name: "Appliances", icon: "🔌", description: "Equipment, machines and electrical appliance-related problems.", color: "bg-purple-50 text-purple-700" },
];

export default function Home() {
  const [complaint, setComplaint] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");

  async function classifyComplaint() {
    if (!complaint.trim()) {
      setError("Please enter a maintenance complaint.");
      return;
    }

    setPredicting(true);
    setError("");
    setPrediction(null);

    try {
      const response = await fetch(`${getApiUrl()}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: complaint.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.message || "Classification failed.");

      if (typeof data.category !== "string" || typeof data.confidence !== "number") {
        throw new Error("Invalid prediction received from the server.");
      }

      setPrediction({
        complaint: data.complaint || complaint.trim(),
        category: data.category,
        confidence: Math.min(100, Math.max(0, data.confidence)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the server.");
    } finally {
      setPredicting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <header className="mb-10 text-center">
  <div className="mb-4 flex items-center justify-center gap-3">
    <BrainCircuit size={30} className="text-blue-600" strokeWidth={2} />
    <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      MNM AI Classifier
    </h1>
  </div>

  <p className="mx-auto max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
    Intelligent Maintenance Complaint Classification using Natural Language Processing and BERT.
  </p>
</header>
        {/* Project Overview */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Project Overview</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            MNM AI Classifier is a text classification application that analyzes maintenance-related complaints and automatically predicts their category using a BERT-based machine learning model.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-600">AI Model</p>
              <p className="mt-1 text-lg font-bold text-blue-900">BERT Base Cased</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-xs font-medium text-purple-600">Classification</p>
              <p className="mt-1 text-lg font-bold text-purple-900">Text Analysis</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-600">Categories</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">6 Classes</p>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Classification Categories</h2>
          <p className="mt-1 text-sm text-slate-500">The system identifies complaints across six maintenance categories.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-100 p-4 transition hover:border-blue-200 hover:shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{item.icon}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.color}`}>{item.name}</span>
                </div>
                <p className="text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Model Information */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Machine Learning Model</h2>
          <p className="mt-1 text-sm text-slate-500">Technology used for understanding and classifying text.</p>

          <div className="mt-5 rounded-xl bg-slate-50 p-5">
            <p className="text-xs font-medium text-slate-500">MODEL IDENTIFIER</p>
            <p className="mt-2 break-all text-base font-bold text-blue-700">google-bert/bert-base-cased</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Architecture</p>
                <p className="mt-1 text-sm font-semibold">Transformer (BERT)</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Model Type</p>
                <p className="mt-1 text-sm font-semibold">Pre-trained Language Model</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Task</p>
                <p className="mt-1 text-sm font-semibold">Multi-class Classification</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Output</p>
                <p className="mt-1 text-sm font-semibold">Category and Confidence</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">How It Works</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Enter Text", "User enters a maintenance complaint."],
              ["02", "Text Processing", "Input is tokenized for BERT analysis."],
              ["03", "AI Prediction", "The model analyzes the text and predicts a category."],
              ["04", "View Result", "The predicted category and confidence are displayed."],
            ].map(([step, title, desc]) => (
              <div key={step} className="rounded-xl bg-slate-50 p-4">
                <span className="text-sm font-extrabold text-blue-600">{step}</span>
                <h3 className="mt-2 text-sm font-bold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Complaint Classification */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">AI TEXT ANALYSIS</span>
            <h2 className="mt-3 text-2xl font-bold">Analyze Your Complaint</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter a maintenance-related problem below. The AI model will identify the most suitable category.
            </p>
          </div>

          <label htmlFor="complaint" className="mb-2 block text-sm font-semibold">Maintenance Complaint</label>
          <textarea
            id="complaint"
            value={complaint}
            onChange={(e) => { setComplaint(e.target.value); setError(""); setPrediction(null); }}
            rows={5}
            disabled={predicting}
            placeholder="Example: The air conditioner is not cooling the meeting room."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>Enter a clear description of the issue.</span>
            <span>{complaint.length} characters</span>
          </div>

          <button
            onClick={classifyComplaint}
            disabled={predicting || !complaint.trim()}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {predicting ? "Analyzing Text..." : "✦  Classify Complaint"}
          </button>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

          {prediction && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-700">Classification Result</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-emerald-700">Predicted Category</p>
                  <h3 className="mt-1 text-3xl font-extrabold text-emerald-900">{prediction.category}</h3>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 text-center">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="text-2xl font-extrabold text-emerald-700">{prediction.confidence.toFixed(2)}%</p>
                </div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${prediction.confidence}%` }} />
              </div>
              <p className="mt-4 border-t border-emerald-200 pt-4 text-sm leading-6 text-emerald-900">
                <strong>Original Complaint:</strong> {prediction.complaint}
              </p>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-8 pb-4 text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-500">MNM AI Classifier</p>
          <p className="mt-1">Powered by Google BERT · FastAPI · Next.js</p>
        </footer>
      </div>
    </main>
  );
}
