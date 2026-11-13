
"use client";

import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 20;

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

const BASE_URL = API_URL.startsWith("http")
  ? API_URL
  : `https://${API_URL}`;

interface DatasetRecord {
  id: number;
  text: string;
  category: string;
}

interface DatasetResponse {
  records: DatasetRecord[];
  total_records: number;
  page: number;
  limit: number;
  total_pages: number;
}

export default function DatasetPage() {
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const readError = async (
    response: Response,
    fallback: string
  ) => {
    try {
      const data = await response.json();
      return data.detail || data.message || fallback;
    } catch {
      return fallback;
    }
  };

  // Load only the requested page from the backend.
  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        search: search,
      });

      const response = await fetch(
        `${BASE_URL}/dataset/records?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not load dataset.")
        );
      }

      const data: DatasetResponse = await response.json();

      setRecords(data.records || []);
      setTotalRecords(data.total_records || 0);
      setTotalPages(Math.max(1, data.total_pages || 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to backend."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Search dataset.
  function handleSearch() {
    setPage(1);
    setSearch(searchInput.trim());
    setEditingId(null);
  }

  // Start editing.
  function startEditing(record: DatasetRecord) {
    setEditingId(record.id);
    setEditText(record.text);
    setEditCategory(record.category);
    setError("");
  }

  // Save changes.
  async function saveRecord(id: number) {
    if (!editText.trim() || !editCategory.trim()) {
      setError("Complaint text and category cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${BASE_URL}/dataset/records/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: editText.trim(),
            category: editCategory.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not update record.")
        );
      }

      setEditingId(null);
      await loadRecords();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  // Delete record.
  async function deleteRecord(id: number) {
    const confirmed = window.confirm(
      `Are you sure you want to delete record #${id}?`
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");

    try {
      const response = await fetch(
        `${BASE_URL}/dataset/records/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not delete record.")
        );
      }

      if (editingId === id) {
        setEditingId(null);
      }

      // If the deleted record was the only item on the page,
      // move back one page.
      if (records.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadRecords();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const startRecord =
    totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const endRecord = Math.min(
    page * PAGE_SIZE,
    totalRecords
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <header className="mb-8">
          <a
            href="/"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            ← Back to Dashboard
          </a>

          <h1 className="mt-5 text-3xl font-bold">
            Dataset Management
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            View, search, edit and delete maintenance complaint records.
          </p>
        </header>

        {/* Dataset overview */}
        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Dataset Records
              </p>

              <p className="mt-1 text-3xl font-bold text-blue-700">
                {totalRecords.toLocaleString()}
              </p>
            </div>

            <button
              onClick={loadRecords}
              disabled={loading}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

          </div>

        </section>

        {/* Search */}
        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">

          <h2 className="font-bold">
            Search Dataset
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Search by complaint description or category.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">

            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Search complaints or categories..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Search
            </button>

            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
                setEditingId(null);
              }}
              className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              Clear
            </button>

          </div>

          {search && (
            <p className="mt-3 text-sm text-blue-600">
              Searching for: "{search}"
            </p>
          )}

        </section>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Records */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>
              <h2 className="text-xl font-bold">
                Dataset Records
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Showing {startRecord}–{endRecord} of {totalRecords} records
              </p>
            </div>

            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              Page {page} of {totalPages}
            </span>

          </div>

          {loading ? (

            <div className="py-16 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
              <p className="mt-4 text-sm text-slate-500">
                Loading dataset records...
              </p>
            </div>

          ) : records.length === 0 ? (

            <div className="mt-6 rounded-xl bg-slate-50 p-12 text-center">
              <p className="font-semibold text-slate-600">
                No records found.
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Try another search or refresh the dataset.
              </p>
            </div>

          ) : (

            <div className="mt-6 space-y-4">

              {records.map((record) => (

                <article
                  key={record.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200"
                >

                  {editingId === record.id ? (

                    /* Edit mode */
                    <div className="space-y-4">

                      <h3 className="font-bold">
                        Editing Record #{record.id}
                      </h3>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Complaint Text
                        </label>

                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border p-3 text-sm outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Category
                        </label>

                        <input
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full rounded-xl border p-3 text-sm outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">

                        <button
                          onClick={() => saveRecord(record.id)}
                          disabled={saving}
                          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="rounded-lg border px-5 py-2.5 text-sm font-semibold"
                        >
                          Cancel
                        </button>

                      </div>

                    </div>

                  ) : (

                    /* Display mode */
                    <>

                      <div className="flex flex-wrap items-center justify-between gap-3">

                        <span className="text-xs font-bold text-slate-400">
                          RECORD #{record.id}
                        </span>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {record.category}
                        </span>

                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {record.text}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">

                        <button
                          onClick={() => startEditing(record)}
                          disabled={deletingId !== null}
                          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteRecord(record.id)}
                          disabled={deletingId !== null}
                          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingId === record.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>

                      </div>

                    </>

                  )}

                </article>

              ))}

            </div>

          )}

          {/* Pagination */}
          {!loading && totalRecords > 0 && (

            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row">

              <p className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">

                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  First
                </button>

                <button
                  onClick={() => setPage((current) => current - 1)}
                  disabled={page === 1}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
                  {page}
                </span>

                <button
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>

                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Last
                </button>

              </div>

            </div>

          )}

        </section>

        <footer className="mt-8 text-center text-sm text-slate-400">
          MNM AI Classifier · Dataset Management
        </footer>

      </div>

    </main>
  );
}
