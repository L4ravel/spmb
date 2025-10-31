"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Users,
  Hand,
  Star,
  Loader2,
  MessageSquareMore,
  XCircle,
  Info,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * PortalSurveyPopup (Dropdown source, "Lainnya" opsional)
 * Flow:
 * 1) source (dropdown) → 2) ask → 3) rate (opsional komentar via tombol)
 * Simpan ke: portal_feedback
 */
export default function PortalSurveyPopup({
  userId,
  storageKeyPrefix = "portal_survey",
  onDone,
}) {
  // Resolve user id
  const resolvedUserId = useMemo(() => {
    if (userId && String(userId).trim()) return String(userId).trim();
    try {
      const raw = localStorage.getItem("appUser");
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.username) return String(u.username);
      }
    } catch {}
    return "anonymous";
  }, [userId]);

  const storageKey = `${storageKeyPrefix}:${resolvedUserId}:v1`;

  // Mount & visibility
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const shouldOpen = !raw;
      setOpen(shouldOpen);
      if (shouldOpen) setTimeout(() => setShow(true), 10);
    } catch {
      setOpen(true);
      setTimeout(() => setShow(true), 10);
    }
  }, [mounted, storageKey]);

  // Steps & submitting
  const [step, setStep] = useState("source"); // "source" | "ask" | "rate"
  const [submitting, setSubmitting] = useState(false);

  // ---------- STEP: SOURCE (Dropdown) ----------
  const SOURCE_OPTIONS = [
    "Keluarga",
    "Alumni",
    "Ustadz/Ustadzah",
    "WhatsApp",
    "Media Sosial",
    "Website",
    "Kunjungan ke Pondok",
    "Brosur",
    "Lainnya",
  ];
  const [sourceOption, setSourceOption] = useState(""); // single value
  const [sourceOther, setSourceOther] = useState("");

  const hasOther = sourceOption === "Lainnya";
  // PERUBAHAN: tidak wajib isi "Lainnya" → valid cukup pilih salah satu opsi
  const sourceValid = !!sourceOption;

  // ---------- STEP: ASK/RATE ----------
  const [hoverStars, setHoverStars] = useState(0);
  const [clickedRating, setClickedRating] = useState(null);
  const [commentMode, setCommentMode] = useState(false);
  const [comment, setComment] = useState("");

  // Helpers
  async function persist(payload) {
    // cache local
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ userId: resolvedUserId, ...payload, ts: Date.now() })
      );
    } catch {}
    // write firestore (append)
    await addDoc(collection(db, "portal_feedback"), {
      userId: resolvedUserId,
      ...payload,
      version: "v4",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      createdAt: serverTimestamp(),
    });
  }

  async function withLoading(fn) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fn();
      await new Promise((r) => setTimeout(r, 350));
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setShow(false);
    setTimeout(() => {
      setOpen(false);
      onDone && onDone();
    }, 180);
  }

  // Actions
  function goAskIfSourceValid() {
    if (!sourceValid) return;
    setStep("ask");
  }

  async function handlePanitiaYes() {
    await withLoading(async () => {
      await persist({
        sources: [sourceOption],
        // "Lainnya" opsional → kirim hanya jika terisi
        sourceOther: hasOther && sourceOther.trim() ? sourceOther.trim() : null,
        registeredBy: "committee",
        committeeRegistered: true,
        rating: null,
        comment: null,
      });
      close();
    });
  }

  function handlePanitiaNo() {
    setStep("rate");
  }

  const ratingDisabled = submitting || (commentMode && !comment.trim());
  async function handlePickRating(n) {
    if (ratingDisabled) return;
    setClickedRating(n);
    await withLoading(async () => {
      await persist({
        sources: [sourceOption],
        sourceOther: hasOther && sourceOther.trim() ? sourceOther.trim() : null,
        registeredBy: "self",
        committeeRegistered: false,
        rating: n,
        comment: commentMode ? comment.trim() : null,
      });
      close();
    });
  }

  if (!mounted || !open) return null;

  // Judul dinamis: khusus step "source" pakai judul survey sumber informasi
  const title =
    step === "source"
      ? "Sumber informasi pendaftaran"
      : "Bantu kami mempermudah sistem";

  return (
    <div
      className={[
        "fixed inset-0 z-[90] grid place-items-center px-4 select-none",
        show ? "bg-slate-900/60 backdrop-blur-[2px]" : "bg-slate-900/0 backdrop-blur-0",
        "transition-[background-color,backdrop-filter] duration-200 ease-out",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
    >
      {/* Panel */}
      <div
        className={[
          "w-full max-w-md relative rounded-3xl shadow-2xl ring-1 ring-slate-200/70 bg-white",
          show ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95",
          "transition-all duration-200 ease-out",
        ].join(" ")}
      >
        {/* Ribbon */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 text-white px-3 py-1 text-xs font-semibold shadow-lg shadow-violet-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            Survey singkat
          </div>
        </div>

        <div className="p-6">
          {/* Icon */}
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Users className="h-6 w-6" />
          </div>

          {/* JUDUL DINAMIS */}
          <h3 className="text-xl font-bold text-slate-900 text-center">
            {title}
          </h3>

          {/* STEP: SOURCE (Dropdown) */}
          {step === "source" && (
            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-800 text-center">
                Dari mana Anda mengetahui <b>Ponpes As-Sunnah</b>?
              </label>

              <div className="mt-2">
                <select
                  value={sourceOption}
                  onChange={(e) => setSourceOption(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="" disabled>
                    — Pilih sumber informasi —
                  </option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {hasOther && (
                <div className="mt-3 text-black">
                  {/* PERUBAHAN: label tanpa tanda wajib → opsional */}
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Sebutkan sumber lainnya <span className="text-slate-400">(opsional)</span>
                  </label>
                  <input
                    value={sourceOther}
                    onChange={(e) => setSourceOther(e.target.value)}
                    disabled={submitting}
                    placeholder="Contoh: Spanduk, Teman kerja, dll."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              )}

              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={goAskIfSourceValid}
                  disabled={!sourceValid || submitting}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all",
                    sourceValid
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses…
                    </>
                  ) : (
                    <>Lanjut</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP: ASK */}
          {step === "ask" && (
            <div className="mt-5 grid gap-2">
              <p className="text-slate-800 text-center">
                Apakah Anda <b>didaftarkan panitia</b>?
              </p>

              <button
                onClick={handlePanitiaYes}
                disabled={submitting}
                className={[
                  "mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-all",
                  "bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.99]",
                  submitting ? "opacity-70 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan…
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Iya, didaftarkan panitia
                  </>
                )}
              </button>

              <button
                onClick={handlePanitiaNo}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <Hand className="h-4 w-4" />
                Tidak / daftar sendiri
              </button>
            </div>
          )}

          {/* STEP: RATE */}
          {step === "rate" && (
            <div className="mt-5">
              <p className="text-center text-slate-800">
                Seberapa mudah pendaftaran <b>mandiri</b>?
              </p>

              {/* Badge biru hint 1–5 */}
              <div className="mt-1 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                  <Info className="h-3.5 w-3.5" />
                  1 = sangat sulit • 5 = sangat mudah
                </span>
              </div>

              {/* Toggle Komentar */}
              <div className="mt-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setCommentMode((v) => !v);
                    if (commentMode) setComment("");
                  }}
                  disabled={submitting}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    commentMode
                      ? "border-violet-600 text-violet-700 bg-violet-50 hover:bg-violet-100"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {commentMode ? (
                    <>
                      <XCircle className="h-4 w-4" />
                      Batalkan komentar
                    </>
                  ) : (
                    <>
                      <MessageSquareMore className="h-4 w-4" />
                      Beri komentar
                    </>
                  )}
                </button>
              </div>

              {/* Textarea muncul hanya saat commentMode aktif */}
              {commentMode && (
                <div className="mt-3 text-black">
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <MessageSquareMore className="h-4 w-4" />
                    Komentar <span className="text-red-500">*</span>
                    <span className="ml-1 text-xs text-slate-500">(wajib diisi)</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={submitting}
                    placeholder="Tulis saran/masukan singkat…"
                    className="w-full min-h-[72px] rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
              )}

              {/* Deretan bintang */}
              <div className="mt-4 flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const disabled = submitting || (commentMode && !comment.trim());
                  const hovering = !disabled && n <= hoverStars;
                  const isClicked = clickedRating === n && submitting;
                  const active = hovering || isClicked;
                  return (
                    <button
                      key={n}
                      onMouseEnter={() => !disabled && setHoverStars(n)}
                      onMouseLeave={() => !disabled && setHoverStars(0)}
                      onClick={() => !disabled && handlePickRating(n)}
                      disabled={disabled}
                      className={[
                        "h-12 w-12 rounded-2xl border font-bold transition-all",
                        active
                          ? "bg-violet-600 border-violet-600 text-white scale-105 shadow-lg shadow-violet-500/25"
                          : "bg-white border-slate-300 text-slate-800 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                      aria-label={`Pilih rating ${n}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {isClicked ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className={active ? "h-4 w-4 fill-white" : "h-4 w-4"} />
                        )}
                        <span>{n}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Garis loading permanen di bawah bintang */}
              <div className="mt-5">
                <div className="h-[3px] overflow-hidden rounded-full bg-violet-200/70 shadow-sm">
                  <div className="h-full w-full animate-barber bg-[length:40px_3px]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS animasi garis progress */}
      <style jsx>{`
        @keyframes barber {
          from { background-position: 0 0; }
          to { background-position: 40px 0; }
        }
        .animate-barber {
          background-image: repeating-linear-gradient(
            45deg,
            rgba(124, 58, 237, 0.95) 0px,
            rgba(124, 58, 237, 0.95) 10px,
            rgba(168, 85, 247, 0.85) 10px,
            rgba(168, 85, 247, 0.85) 20px
          );
          animation: barber 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
