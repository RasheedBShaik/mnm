"use client";

import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";
// const API_URL = "https://pzrvhx4s-8000.inc1.devtunnels.ms";

export default function Home() {
  const [complaint, setComplaint] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!complaint.trim()) {
      setError("Please enter a complaint.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        // IMPORTANT:
        // Change this field to match your FastAPI Pydantic schema.
        body: JSON.stringify({
          complaint: complaint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data.detail || data));
      }

      setResult({
        category:
          data.category ??
          data.prediction ??
          data.predicted_category ??
          data.label ??
          "Unknown",

        confidence: data.confidence ?? null,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to connect to FastAPI.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold">MNM AI Classifier</h1>

          <p className="text-slate-400 mt-3">
            Maintenance Complaint Classification System
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-xl">
          <h2 className="text-xl font-semibold mb-5">Analyze Complaint</h2>

          <label className="block text-sm text-slate-300 mb-3">
            Enter your complaint
          </label>

          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Example: The air conditioner is not working properly..."
            rows={8}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />

          <div className="text-right text-xs text-slate-500 mt-2">
            {complaint.length} characters
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition"
          >
            {loading ? "Analyzing..." : "Classify Complaint"}
          </button>

          {error && (
            <div className="mt-5 bg-red-950 border border-red-800 text-red-300 rounded-xl p-4 wrap-break-words">
              <p className="font-semibold mb-1">API Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 bg-green-950 border border-green-700 rounded-xl p-6">
              <p className="text-green-400 text-sm font-medium">
                Predicted Category
              </p>

              <h2 className="text-3xl font-bold mt-2">{result.category}</h2>

              {result.confidence !== null && (
                <p className="text-green-300 mt-3">
                  Confidence: {result.confidence}
                </p>
              )}

              <p className="text-green-400 text-sm mt-3">
                Classification completed successfully.
              </p>
            </div>
          )}
        </div>

        {/* 
        <p className="text-center text-slate-500 text-sm mt-6">
          Powered by MNM BERT + FastAPI
        </p> 
        */}
        
      </div>
    </main>
  );
}
