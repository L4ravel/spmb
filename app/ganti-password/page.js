"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";

/* ===== Firebase init ===== */
function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}
const app = getFirebaseApp();
const db = getFirestore(app);

/* ===== Utils ===== */
function cn(...xs) { return xs.filter(Boolean).join(" "); }
const hasLetter = (s) => /[A-Za-z]/.test(s || "");
const hasNumber = (s) => /\d/.test(s || "");
const strongEnough = (s) => (s?.length >= 8 && hasLetter(s) && hasNumber(s));

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ambil NISN dari berbagai sumber di portal
function getNisnMulti() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get("nisn") || url.searchParams.get("NISN");
  const ls = localStorage.getItem("nisn") || localStorage.getItem("ppdb_nisn") || localStorage.getItem("username");
  const ss = sessionStorage.getItem("nisn") || sessionStorage.getItem("ppdb_nisn") || sessionStorage.getItem("username");
  let fromAppUser = null;
  try {
    const raw = localStorage.getItem("appUser");
    if (raw) {
      const u = JSON.parse(raw);
      if (u && typeof u.username === "string") fromAppUser = u.username;
    }
  } catch {}
  // @ts-ignore
  const globalVar = typeof window.PPDB_NISN !== "undefined" ? window.PPDB_NISN : null;
  return (q || ls || ss || fromAppUser || globalVar || "").toString().trim() || null;
}

export default function ChangePasswordPage() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const score = useMemo(() => {
    let s = 0;
    if ((newPw || "").length >= 8) s += 1;
    if (hasLetter(newPw)) s += 1;
    if (hasNumber(newPw)) s += 1;
    if ((newPw || "").length >= 12) s += 1;
    return s; // 0..4
  }, [newPw]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    const nisn = getNisnMulti();
    if (!nisn) {
      setMsg({ type: "error", text: "NISN tidak ditemukan di sesi. Silakan login ulang." });
      return;
    }

    // Validasi form
    if (!currentPw) return setMsg({ type: "error", text: "Masukkan password saat ini." });
    if (!strongEnough(newPw))
      return setMsg({ type: "error", text: "Password baru minimal 8 karakter serta mengandung huruf dan angka." });
    if (newPw !== confirmPw)
      return setMsg({ type: "error", text: "Konfirmasi password tidak cocok." });

    setSubmitting(true);
    try {
      // 1) Baca dokumen user
      const ref = doc(db, "users_app", nisn);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setMsg({ type: "error", text: "Akun tidak ditemukan." });
        setSubmitting(false);
        return;
      }
      const data = snap.data() || {};
      const currentHash = (data.passwordHash || "").toString();

      // 2) Verifikasi password saat ini (hash match)
      const inputOldHash = await sha256Hex(currentPw);
      if (!currentHash || inputOldHash !== currentHash) {
        setMsg({ type: "error", text: "Password saat ini salah." });
        setSubmitting(false);
        return;
      }

      // 3) Siapkan hash password baru (dan pastikan beda)
      const newHash = await sha256Hex(newPw);
      if (newHash === currentHash) {
        setMsg({ type: "error", text: "Password baru tidak boleh sama dengan yang lama." });
        setSubmitting(false);
        return;
      }

      // 4) Update dokumen user
      await updateDoc(ref, {
        passwordHash: newHash,
        passwordChangedAt: serverTimestamp(),
      });

      setMsg({ type: "success", text: "Password berhasil diubah. Silakan gunakan password baru saat login berikutnya." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      console.error("[ganti-password] error:", err);
      setMsg({ type: "error", text: "Gagal mengubah password. Coba lagi sebentar." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto w-full max-w-xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/portal" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft size={18} /><span>Kembali</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Shield className="text-emerald-700" size={20} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-slate-900">Ganti Password</h1>
              <p className="text-sm text-slate-600">Gunakan password yang kuat. Disarankan tidak memakai <b>NISN</b>.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-black">
            {/* Current Password */}
            <div>
              <label className="text-sm font-medium text-slate-700">Password Saat Ini</label>
              <div className="mt-1 relative">
                <input
                  type={showCur ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10"
                  placeholder="Masukkan password saat ini"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowCur((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700" tabIndex={-1}>
                  {showCur ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-sm font-medium text-slate-700">Password Baru</label>
              <div className="mt-1 relative">
                <input
                  type={showNew ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10"
                  placeholder="Minimal 8 karakter, kombinasi huruf & angka"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button type="button" onClick={() => setShowNew((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700" tabIndex={-1}>
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Strength meter */}
              <div className="mt-2">
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      score <= 1 && "bg-rose-500",
                      score === 2 && "bg-amber-500",
                      score >= 3 && "bg-emerald-600"
                    )}
                    style={{ width: `${(score / 4) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Syarat: minimal 8 karakter, mengandung huruf dan angka.</p>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label className="text-sm font-medium text-slate-700">Konfirmasi Password Baru</label>
              <div className="mt-1 relative">
                <input
                  type={showConf ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10"
                  placeholder="Ulangi password baru"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button type="button" onClick={() => setShowConf((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700" tabIndex={-1}>
                  {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Alert */}
            {!!msg.text && (
              <div className={cn(
                "rounded-lg px-3 py-2 text-sm",
                msg.type === "success" && "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300",
                msg.type === "error" && "bg-rose-50 text-rose-800 ring-1 ring-rose-300"
              )}>
                {msg.text}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">Tips: jangan gunakan NISN sebagai password lagi.</div>
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold text-white",
                  "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? "Menyimpan…" : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
