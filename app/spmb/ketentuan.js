"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

export default function Ketentuan({
  children,
  storageKey = "spmb_terms_v1",
  durationMs = 1800_000,
}) {
  const [readChecked, setReadChecked] = useState(false);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // === helpers storage ===
  const loadState = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.accepted || !obj?.expiresAt) return null;
      return obj;
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveState = useCallback((obj) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch {}
  }, [storageKey]);

  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  // On mount: jika belum expired → lanjut tanpa overlay
  useEffect(() => {
    const st = loadState();
    const now = Date.now();
    if (st && now < st.expiresAt) {
      setAccepted(true);
    } else {
      clearState();
      setAccepted(false);
    }
  }, [loadState, clearState]);

  // Reminder: saat user balik fokus ke tab/halaman, cek kedaluwarsa.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const st = loadState();
      const now = Date.now();
      if (!st || now >= st.expiresAt) {
        clearState();
        setAccepted(false);
        setReadChecked(false);
        setAgreeChecked(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [loadState, clearState]);

  const canConfirm = useMemo(() => readChecked && agreeChecked, [readChecked, agreeChecked]);

  const onConfirm = useCallback(() => {
    if (!canConfirm) return;
    const expiresAt = Date.now() + Number(durationMs || 60_000);
    saveState({ accepted: 1, expiresAt });
    setAccepted(true);
  }, [canConfirm, durationMs, saveState]);

  // enter key support
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && canConfirm && !accepted) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canConfirm, accepted, onConfirm]);

  // Jika sudah diterima → tampilkan form apa adanya (tanpa overlay)
  if (accepted) return children;

  // === Overlay ketentuan (responsive) ===
  return (
    <div className="relative">
      {/* Konten di-blur saat overlay muncul */}
      <div className="pointer-events-none select-none blur-[2px] opacity-70">{children}</div>

      {/* Backdrop full screen + safe area padding */}
      <div className="fixed inset-0 z-50 bg-black/50 p-2 sm:p-4 md:p-6 [padding:env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)] flex">
        {/* Dialog container: full pada mobile, card pada md+ */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="spmb-terms-title"
          className="m-auto w-full max-w-[min(100%,40rem)] md:max-w-2xl rounded-none md:rounded-2xl bg-white shadow-2xl grid"
          style={{
            gridTemplateRows: "auto 1fr auto",
            maxHeight: "min(92vh, 56rem)",
          }}
        >
          {/* Sticky header */}
          <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur px-4 py-3 sm:px-5 sm:py-4">
            <h2 id="spmb-terms-title" className="text-base sm:text-lg font-bold text-slate-800">
              Syarat &amp; Ketentuan
            </h2>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 text-[15px] sm:text-base leading-relaxed text-slate-700">
            <ol className="list-decimal pl-5 space-y-3">
              <li>
                Menyetujui semua peraturan dan kebijakan pengurus Pondok Pesantren Assunnah Lombok
                yang berkaitan dengan proses pembelajaran dan pembinaan santri/santriwati di
                lingkungan Pondok Pesantren Assunnah Lombok.
              </li>
              <li>
                Tidak memindahkan anak saya ke sekolah lain dan atau menariknya untuk berhenti dari
                pendidikan Pondok Pesantren Assunnah Lombok setelah melakukan{" "}
                <span className="font-semibold">Daftar Ulang</span>. Jika melanggar poin ini, maka
                saya sanggup untuk tidak menarik kembali seluruh biaya yang telah saya keluarkan.
              </li>
              <li>
                Tidak memindahkan anak saya ke sekolah lain dan atau menariknya untuk berhenti dari
                pendidikan Pondok Pesantren Assunnah Lombok pada saat tahun pembelajaran sedang
                berjalan. Jika saya melanggar poin ini, maka saya sanggup membayar seluruh kerugian
                yang disebabkan oleh hal tersebut.
              </li>
              <li>
                Apabila terjadi kerusuhan, tawuran, kawin lari, dan pelanggaran lainnya yang
                merupakan keinginan santri/santriwati itu sendiri, maka kami selaku wali
                santri/santriwati tidak akan menuntut keberatan kepada pihak Pengurus Pondok
                Pesantren Assunnah Lombok melalui jalur hukum.
              </li>
            </ol>
            <p className="mt-4">
              Demikian pernyataan ini saya buat untuk dapat saya pertanggungjawabkan di kemudian hari.
            </p>

            {/* Checkboxes: aksesibel + tap-target besar */}
            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={readChecked}
                  onChange={(e) => setReadChecked(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
                />
                <span className="text-sm sm:text-[15px] text-slate-800">Saya sudah membacanya</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
                />
                <span className="text-sm sm:text-[15px] text-slate-800">Saya menyetujui</span>
              </label>
            </div>
          </div>

          {/* Sticky footer actions */}
          <div className="sticky bottom-0 z-10 border-t bg-white/90 backdrop-blur px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                aria-disabled={!canConfirm}
                className={`inline-flex items-center justify-center rounded-lg px-4 sm:px-5 py-2.5 text-sm font-semibold transition
                  ${canConfirm
                    ? "bg-violet-600 text-white hover:bg-violet-700 active:scale-[.99]"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
