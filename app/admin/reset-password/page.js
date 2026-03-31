"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  RefreshCw,
  UserSearch,
  CheckCircle2,
  AlertTriangle,
  Shield,
  KeyRound,
} from "lucide-react";

/* ========= Firebase init ========= */
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

/* ========= Utils ========= */
const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());
const cx = (...xs) => xs.filter(Boolean).join(" ");

// Tetap gunakan SHA-256 di belakang layar (tanpa menampilkan di UI)
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminResetPasswordPage() {
  const [nisn, setNisn] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);
  const [userDoc, setUserDoc] = useState(null);

  const [confirmNisn, setConfirmNisn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const canLookup = useMemo(() => isNISN(nisn), [nisn]);
  const canConfirm = useMemo(
    () => isNISN(nisn) && confirmNisn.trim() === String(nisn).trim(),
    [nisn, confirmNisn]
  );

  useEffect(() => {
    setMsg({ type: "", text: "" });
  }, [nisn]);

  async function handleLookup() {
    setMsg({ type: "", text: "" });
    if (!canLookup) {
      setMsg({ type: "error", text: "Masukkan NISN yang valid (8–12 digit)." });
      return;
    }
    setLoadingUser(true);
    try {
      const snap = await getDoc(doc(db, "users_app", String(nisn)));
      if (!snap.exists()) {
        setUserDoc(null);
        setMsg({ type: "error", text: "Nisn tidak ditemukan." });
        return;
      }
      setUserDoc({ id: nisn, ...snap.data() });
    } catch (e) {
      console.error("[lookup user] error:", e);
      setMsg({ type: "error", text: "Gagal mengambil data pengguna." });
    } finally {
      setLoadingUser(false);
    }
  }

  async function handleReset() {
    setMsg({ type: "", text: "" });
    if (!canConfirm) {
      setMsg({ type: "error", text: "Konfirmasi NISN belum sesuai." });
      return;
    }
    setSubmitting(true);
    try {
      const newHash = await sha256Hex(String(nisn));
      const ref = doc(db, "users_app", String(nisn));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setMsg({ type: "error", text: "Akun tidak ditemukan saat reset." });
        setSubmitting(false);
        return;
      }
      const curHash = (snap.data()?.passwordHash || "").toString();

      await updateDoc(ref, {
        passwordHash: newHash,
        passwordChangedAt: serverTimestamp(),
        passwordResetBy: "admin",
        passwordResetReason: "reset_to_nisn",
      });

      setMsg({
        type: "success",
        text:
          curHash === newHash
            ? "Password sudah sama dengan NISN. Waktu reset diperbarui."
            : "Berhasil! Password di-reset menjadi NISN.",
      });

      await handleLookup();
      setConfirmNisn("");
    } catch (e) {
      console.error("[reset password] error:", e);
      setMsg({ type: "error", text: "Gagal melakukan reset password." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      {/* Judul (bukan header/sticky) */}
      <div className="px-4 md:px-8 pt-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-600/10 grid place-items-center ring-1 ring-emerald-200">
            <Shield className="text-emerald-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
              Reset Password Peserta
            </h1>
            <p className="text-base md:text-lg text-slate-700">
              Mengembalikan password menjadi <b>NISN</b> peserta.
            </p>
          </div>
        </div>
      </div>

      {/* Konten penuh & scrollable */}
      <div className="w-full px-4 md:px-8 py-8 space-y-10">
        {/* LOOKUP */}
        <section className="w-full">
          <label className="block text-lg md:text-xl font-semibold text-slate-900">
            NISN Peserta
          </label>
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              inputMode="numeric"
              pattern="\d*"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-base md:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Masukkan NISN Peserta"
              value={nisn}
              onChange={(e) => setNisn(e.target.value.replace(/[^\d]/g, ""))}
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={loadingUser || !canLookup}
              className={cx(
                "inline-flex items-center justify-center text-black gap-2 rounded-lg px-4 py-3 text-base md:text-lg font-semibold",
                "border border-slate-300 bg-slate-50 hover:bg-white",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Ambil data pengguna"
            >
              <UserSearch size={18} />
              <span>Lihat</span>
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Disarankan periksa data dulu sebelum reset.
          </p>

          {/* PREVIEW USER (tanpa info hash) */}
          {userDoc && (
            <div className="mt-6 rounded-xl border border-slate-300 bg-slate-50 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-200/60 grid place-items-center ring-1 ring-emerald-300">
                  <KeyRound className="text-emerald-800" size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-slate-900">
                    {userDoc.fullName || userDoc.nama || "Tanpa Nama"}
                  </div>
                  <div className="text-sm text-slate-700 mt-0.5">
                    NISN: <span className="font-mono">{nisn}</span>
                    {userDoc.registrationLevel ? (
                      <> • Level: {String(userDoc.registrationLevel)}</>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* MESSAGES */}
        {!!msg.text && (
          <div
            className={cx(
              "rounded-xl px-4 py-3 text-base",
              msg.type === "success" &&
                "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300",
              msg.type === "error" &&
                "bg-rose-50 text-rose-900 ring-1 ring-rose-300",
              msg.type === "warn" &&
                "bg-amber-50 text-amber-900 ring-1 ring-amber-300"
            )}
          >
            {msg.text}
          </div>
        )}

        {/* KONFIRMASI */}
        <section className="w-full rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-700 mt-1" size={22} />
            <div className="flex-1">
              <div className="text-lg font-extrabold text-amber-900">
                Konfirmasi Reset
              </div>
              <p className="text-base text-amber-900/90 mt-1">
                Tindakan ini akan mengganti password menjadi <b>NISN peserta</b>.
                Peserta disarankan segera mengganti password setelah login.
              </p>

              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  className="flex-1 sm:flex-none sm:w-72 rounded-lg border border-amber-400 bg-white px-4 py-3 text-base text-amber-900 placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="Ketik ulang NISN"
                  value={confirmNisn}
                  onChange={(e) =>
                    setConfirmNisn(e.target.value.replace(/[^\d]/g, ""))
                  }
                />
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!canConfirm || submitting}
                  className={cx(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-extrabold text-white",
                    "bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <RefreshCw size={18} />
                  {submitting ? "Memproses…" : "Reset ke NISN"}
                </button>
                {msg.type === "success" && (
                  <span className="inline-flex items-center gap-2 text-emerald-700 text-base font-semibold">
                    <CheckCircle2 size={18} /> Selesai
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="h-10" />
      </div>
    </div>
  );
}
