"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function ResultModal({
  open,
  onClose,
  benar = 0,
  total = 0,
  poin = 100,
  detail = [], // optional: [{no, benar: boolean}]
}) {
  if (!open) return null;

  const targetNilai = useMemo(
    () => (total > 0 ? Math.round((benar / total) * poin) : 0),
    [benar, total, poin]
  );

  // ====== Phase kontrol: "loading" -> "result" ======
  const [phase, setPhase] = useState("loading"); // "loading" | "result"
  const [progress, setProgress] = useState(0); // 0..100 untuk bar
  const [displayNilai, setDisplayNilai] = useState(0); // animasi count-up
  const animRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // reset saat modal dibuka
    setPhase("loading");
    setProgress(0);
    setDisplayNilai(0);

    // trigger progress bar transisi lebar 5s
    const raf = requestAnimationFrame(() => setProgress(100));

    // setelah 5 detik -> tampilkan hasil
    timeoutRef.current = setTimeout(() => {
      setPhase("result");
      // animasi count-up ~800ms
      const start = performance.now();
      const dur = 800;
      const from = 0;
      const to = targetNilai;

      const step = (t) => {
        const k = Math.min(1, (t - start) / dur);
        setDisplayNilai(Math.round(from + (to - from) * k));
        if (k < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    }, 5000);

    return () => {
      cancelAnimationFrame(raf);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetNilai]);

  const canClose = phase === "result";

  const handleClose = () => {
    if (!canClose) return; // cegah tutup selama loading
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-100"
        onClick={handleClose}
      />

      {/* dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
          {/* header */}
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {phase === "loading" ? "Memproses Hasil…" : "Hasil Ujian"}
            </h3>
            <button
              onClick={handleClose}
              disabled={!canClose}
              className={`rounded-full p-2 ${canClose ? "hover:bg-slate-100" : "opacity-40 cursor-not-allowed"}`}
              aria-label="Tutup"
              title={canClose ? "Tutup" : "Menunggu hasil…"}
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div className="px-5 py-5">
            {phase === "loading" ? (
              <div className="text-center">
                {/* Spinner cincin + shimmer */}
                <div className="mx-auto h-16 w-16 rounded-full border-4 border-violet-200 border-t-transparent animate-spin" />
                <div className="mt-3 text-slate-600">Menghitung nilai Anda…</div>

                {/* Progress bar 5 detik */}
                <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-[#6a11cb] via-[#5b22c7] to-[#3b1e8f]"
                    style={{
                      width: `${progress}%`,
                      transition: "width 5s linear",
                    }}
                  />
                </div>

                {/* Hint kecil */}
                <div className="mt-2 text-xs text-slate-500">
                  Mohon tunggu sebentar, hasil akan tampil otomatis.
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm text-slate-500">Nilai</div>
                <div className="mt-1 text-5xl font-extrabold text-violet-700">
                  {displayNilai}
                </div>
                <div className="mt-1 text-slate-600">
                  Benar <b>{benar}</b> dari <b>{total}</b> soal
                </div>

                {detail?.length ? (
                  <div className="mt-5 grid grid-cols-8 gap-2">
                    {detail.map((d, i) => (
                      <div
                        key={i}
                        className={[
                          "text-center text-xs rounded-md px-2 py-1 border",
                          d.benar
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200",
                        ].join(" ")}
                        title={d.benar ? "Benar" : "Salah"}
                      >
                        {d.no}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t flex items-center justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={!canClose}
              className={`rounded-lg px-4 py-2 font-semibold ${
                canClose
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {canClose ? "Tutup" : "Menunggu…"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
