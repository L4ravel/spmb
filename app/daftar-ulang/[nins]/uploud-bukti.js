"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Upload, X } from "lucide-react";

export default function UploadBukti({ open, onClose, onUploaded, nisn }) {
  const [files, setFiles] = useState([]);
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setAmountStr("");
      setNote("");
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  const onPickFiles = (e) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files));
  };

    const formatAmount = (value) => {
  // ambil digit saja
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  // sisipkan titik setiap 3 angka dari belakang
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleaned = (amountStr || "").replace(/[^\d]/g, "");
    const amount = Number(cleaned);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Jumlah pembayaran wajib dan harus lebih dari 0.");
      return;
    }
    if (!files.length) {
      setError("Minimal pilih satu bukti (gambar/PDF).");
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.set("amount", String(amount));
      fd.set("note", note || "");
      fd.set("nisn", String(nisn || ""));
      for (const f of files) fd.append("files", f, f.name);

      const res = await fetch("/api/re_registration_payments/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Gagal menyimpan pembayaran.");
      }

      onUploaded && onUploaded();
      onClose && onClose();
    } catch (err) {
      setError(err?.message || "Gagal mengupload bukti.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const modalUI = (
    <div
      className="fixed inset-0 z-[100]"
      aria-modal="true"
      role="dialog"
      onClick={submitting ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div
          className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h3 className="text-base md:text-lg font-semibold text-slate-900">
              Upload Bukti Pembayaran
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
              aria-label="Tutup"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            encType="multipart/form-data"
            className="px-5 py-4 space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-slate-700">
                Jumlah Pembayaran (IDR)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => setAmountStr(formatAmount(e.target.value))}
                placeholder="mis. 300.000"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Isi nominal transfer untuk bukti yang diupload pada batch ini.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Bukti (gambar/PDF) — boleh lebih dari satu
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={onPickFiles}
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-50"
              />
              {files.length > 0 && (
                <ul className="mt-2 text-xs text-slate-600 list-disc list-inside max-h-24 overflow-auto">
                  {files.map((f, i) => (
                    <li key={i}>
                      {f.name} <span className="text-slate-400">({Math.ceil(f.size / 1024)} KB)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Catatan (opsional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Contoh: Transfer via M-Banking, an. Wali, 17 Okt 2025"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-70"
              >
                <Upload className="h-4 w-4" />
                {submitting ? "Mengunggah..." : "Upload Bukti"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalUI, document.body);
}
