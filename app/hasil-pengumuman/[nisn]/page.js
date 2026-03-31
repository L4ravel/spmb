"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";

import Header from "@/app/components/Header";

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

/* ========= Helpers ========= */
const TZ_WITA = "Asia/Makassar";
const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());
const fmtWITA = (ms) =>
  ms
    ? new Date(ms).toLocaleString("id-ID", {
        timeZone: TZ_WITA,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
function toMs(v) {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

export default function HasilPengumumanPage() {
  const { nisn } = useParams();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [allow, setAllow] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // Gate: pastikan sesi & NISN cocok
  useEffect(() => {
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("appUser") : null;
        if (!raw) { router.replace("/login"); return; }
        const u = JSON.parse(raw || "{}");
        const sessionNisn = u?.username;
        if (!isNISN(sessionNisn) || String(sessionNisn) !== String(nisn)) {
          router.replace("/portal");
          return;
        }
        setAllow(true);
      } catch {
        router.replace("/login");
        return;
      } finally {
        setChecking(false);
      }
    })();
  }, [nisn, router]);

  // Ambil finalDecision dari users_app/{nisn} (field), fallback subkoleksi users_app/{nisn}/finalDecision
  useEffect(() => {
    if (!allow) return;
    (async () => {
      setLoading(true);
      try {
        const userRef = doc(db, "users_app", String(nisn));
        const snap = await getDoc(userRef);

        /** Bentuk data yang dipakai UI */
        let payload = null;

        if (snap.exists()) {
          const d = snap.data() || {};
          // Prioritas: field di root doc
          if (typeof d.finalDecision !== "undefined") {
            payload = {
              finalDecision: String(d.finalDecision || "").toUpperCase(),
              finalDecidedAt: toMs(d.finalDecidedAt) || 0,
              finalDecidedBy: d.finalDecidedBy || null,
              fullName: d.fullName || "",
              level: d.registrationLevel || "",
            };
          }
        }

        // Fallback: subkoleksi "finalDecision"
        if (!payload) {
          const cRef = collection(db, "users_app", String(nisn), "finalDecision");
          const list = await getDocs(cRef);
          if (!list.empty) {
            const first = list.docs[0].data() || {};
            payload = {
              finalDecision: String(first.finalDecision || first.status || "").toUpperCase(),
              finalDecidedAt: toMs(first.finalDecidedAt || first.decidedAt) || 0,
              finalDecidedBy: first.finalDecidedBy || first.decidedBy || null,
              fullName: first.fullName || snap?.data()?.fullName || "",
              level: first.registrationLevel || snap?.data()?.registrationLevel || "",
            };
          }
        }

        setData(payload);
      } catch (e) {
        console.error("Gagal memuat pengumuman:", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [allow, nisn]);

  // Animasi reveal
  useEffect(() => {
    if (!loading && data) {
      const t = setTimeout(() => setShowContent(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading, data]);

  /* === Gates === */
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 grid place-items-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto"></div>
          <div className="text-slate-600 mt-4 animate-pulse">Memeriksa sesi…</div>
        </div>
      </div>
    );
  }
  if (!allow) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="mt-3 h-4 w-full bg-slate-200 rounded animate-pulse" />
            <div className="mt-2 h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 grid place-items-center">
        <div className="text-center transform transition-all duration-500 hover:scale-105">
          <div className="text-lg font-semibold text-slate-800">Jadwal Pengumuman Kelulusan Belum Ditentukan</div>
          <div className="text-slate-600 mt-1">Informasi lebih lanjut hubungi panitia SPMB.</div>
          <button
            onClick={() => router.replace("/portal")}
            className="mt-4 rounded-lg bg-violet-600 text-white px-4 py-2 font-semibold hover:bg-violet-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          >
            Kembali ke Portal
          </button>
        </div>
      </div>
    );
  }

// Normalisasi keputusan: ganti "_" / "-" => spasi, lowercase, lalu mapping ke 3 nilai baku
const toDecision = (raw) => {
  const s = String(raw || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!s) return "MENUNGGU";
  if (["lulus", "accepted", "diterima", "pass"].includes(s)) return "LULUS";
  if (["tidak lulus", "tidaklulus", "gagal", "ditolak", "reject", "failed"].includes(s))
    return "TIDAK LULUS";
  return "MENUNGGU";
};

const decision = toDecision(data.finalDecision); // "LULUS" | "TIDAK LULUS" | "MENUNGGU"
const decidedAt = data.finalDecidedAt ? fmtWITA(data.finalDecidedAt) : "—";
const decidedBy = data.finalDecidedBy || "admin";

const isLulus = decision === "LULUS";
const isTidak = decision === "TIDAK LULUS";
const isPending = decision === "MENUNGGU";

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex flex-col relative overflow-hidden">
      {/* Bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <Header />

      <main className="mx-auto w-full max-w-4xl px-4 md:px-6 py-10 flex-1 relative z-10">
        {/* Banner keputusan */}
        <div
          className={`mb-6 rounded-xl p-6 text-white shadow-xl transform transition-all duration-700 ${
            showContent ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
          } ${
            isLulus
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
              : isTidak
              ? 'bg-gradient-to-r from-rose-500 to-red-600'
              : 'bg-gradient-to-r from-amber-500 to-yellow-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full grid place-items-center">
              {isLulus ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : isTidak ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 10-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12h2V8H9v4zm0 4h2v-2H9v2z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-14a6 6 0 100 12A6 6 0 0010 4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {isLulus ? "Selamat! Anda dinyatakan LULUS" : isTidak ? "Mohon maaf, Anda tidak lulus" : "Pengumuman Belum Final"}
              </h3>
              <p className="text-white/90 text-sm mt-0.5">
                Keputusan: <b>{decision || "—"}</b>{' '}
                <span className="opacity-80">• Ditentukan oleh Panitia • {decidedAt} (WITA)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Pesan khusus: permohonan maaf bila tidak lulus (TAMBAHAN) */}
        {isTidak && (
          <div
            className={`mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm transform transition-all duration-700 ${
              showContent ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
            }`}
          >
            <p className="font-semibold">Permohonan Maaf</p>
            <p className="text-sm mt-1 leading-relaxed">
              Kami mohon maaf, Anda dinyatakan <b>tidak lulus</b> pada seleksi SPMB tahun ini.
              Terima kasih atas partisipasi dan kepercayaannya. Silakan hubungi panitia bila
              membutuhkan penjelasan lebih lanjut atau opsi kesempatan berikutnya.
            </p>
          </div>
        )}

        {/* Detail kartu */}
        <div
          className={`rounded-2xl border bg-white shadow-2xl p-6 transform transition-all duration-700 ${
            showContent ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'
          }`}
          style={{ borderColor: isLulus ? "#10B981" : isTidak ? "#EF4444" : "#F59E0B" }}
        >
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <div className={`w-1 h-6 rounded-full ${
              isLulus ? "bg-emerald-500" : isTidak ? "bg-rose-500" : "bg-amber-500"
            }`} />
            Rincian Keputusan
          </h2>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
            {/* Nama */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white">
              <dt className="text-slate-500">Nama</dt>
              <dd className="font-semibold text-slate-900">{data.fullName || "—"}</dd>
            </div>

            {/* Level */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white">
              <dt className="text-slate-500">Jenjang / Level</dt>
              <dd className="font-semibold text-slate-900">{data.level || "—"}</dd>
            </div>

            {/* Keputusan */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white">
              <dt className="text-slate-500">Keputusan</dt>
              <dd>
                <span className={[
                  "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1",
                  isLulus && "bg-emerald-50 text-emerald-700 ring-emerald-200",
                  isTidak && "bg-rose-50 text-rose-700 ring-rose-200",
                  !isLulus && !isTidak && "bg-amber-50 text-amber-700 ring-amber-200",
                ].filter(Boolean).join(" ")}>
                  {decision || "—"}
                </span>
              </dd>
            </div>

            {/* Waktu */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white">
              <dt className="text-slate-500">Waktu Keputusan (WITA)</dt>
              <dd className="font-medium text-slate-900">{decidedAt}</dd>
            </div>
          </dl>
        </div>
      </main>

      <footer className="mt-auto py-6 text-center text-xs text-slate-500 relative z-10">
        © {new Date().getFullYear()} SPMB • Pengumuman
      </footer>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
