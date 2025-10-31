"use client";

import { useEffect, useState, useRef } from "react";

export default function ResultModal({
  open,
  onClose,
  // props lama tetap ada untuk kompatibilitas, tapi tidak dipakai:
  benar = 0,
  total = 0,
  poin = 100,
  detail = [],
}) {
  if (!open) return null;

  // === Animasi kemunculan ===
  const [appeared, setAppeared] = useState(false);

  // === Fase modal: "loading" (±3s) -> "done" ===
  const [phase, setPhase] = useState("loading"); // "loading" | "done"
  const timerRef = useRef(null);

  useEffect(() => {
    // Trigger animasi sesaat setelah mount
    const id = requestAnimationFrame(() => setAppeared(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    // Set fase ke loading setiap modal dibuka, lalu auto ke done setelah 3 detik
    setPhase("loading");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPhase("done"), 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open]);

  // Tutup via Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const goPortal = () => {
    if (typeof window !== "undefined") window.location.href = "/portal";
  };

  return (
    <div className="fixed inset-0 z-[100]" aria-modal="true" role="dialog">
      {/* Backdrop (fade-in) */}
      <div
        className={[
          "absolute inset-0 bg-black/50 backdrop-blur-[2px]",
          "transition-opacity duration-300 ease-out",
          appeared ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={() => onClose?.()}
      />

      {/* Dialog wrapper untuk animasi transform */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden",
            "transition-all duration-300 ease-out",
            appeared ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95",
          ].join(" ")}
        >
          {/* header */}
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {phase === "loading" ? "Memproses Tes Akademik…" : "Tes Akademik Selesai"}
            </h3>
            <button
              onClick={() => onClose?.()}
              className="rounded-full p-2 hover:bg-slate-100"
              aria-label="Tutup"
              title="Tutup"
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div className="px-5 py-6 text-center">
            {phase === "loading" ? (
              <>
                <div className="mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                  <div className="h-8 w-8 border-4 border-slate-300 border-t-violet-600 rounded-full animate-spin" />
                </div>
                <p className="text-base font-medium text-slate-900">
                  Mohon tunggu, sedang memproses hasil…
                </p>
                     </>
            ) : (
              <>
                <div className="mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                  <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-600">
                    <path
                      fill="currentColor"
                      d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-900">
                  Tes akademik sudah diselesaikan.
                </p>
                <p className="mt-1 text-slate-600">
                  Silakan kembali ke <b>Portal</b>.
                </p>
              </>
            )}
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
            {phase === "loading" ? (
              <button
                type="button"
                disabled
                className="rounded-lg px-4 py-2 font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
              >
                Menyiapkan…
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  className="rounded-lg px-4 py-2 font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200"
                >
                  Akhiri
                </button>                
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
