"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

/* Header dari app/component/Header.js */
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

const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());

/** Konversi aman berbagai tipe waktu -> milliseconds */
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

export default function HasilUjianPage() {
  const { nisn } = useParams();
  const router = useRouter();

  /* ====== state ====== */
  const [checking, setChecking] = useState(true);
  const [allow, setAllow] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showContent, setShowContent] = useState(false);

  // validasi sesi
  useEffect(() => {
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("appUser") : null;
        if (!raw) {
          router.replace("/login");
          return;
        }
        const u = JSON.parse(raw);
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

  // ambil hasil dari users_app/{nisn}
  useEffect(() => {
    if (!allow) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users_app", String(nisn)));
        setData(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("Gagal memuat hasil ujian:", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [allow, nisn]);

  const percent = useMemo(() => {
    const p = Number(data?.examScorePercent ?? 0);
    return Number.isFinite(p) ? p : 0;
  }, [data]);

  const nilai = useMemo(() => Math.round(Math.max(0, Math.min(100, percent))), [percent]);

  const ring = useMemo(() => {
    const p = Math.max(0, Math.min(100, percent));
    const r = 70;
    const c = 2 * Math.PI * r;
    const dash = (p / 100) * c;
    return { r, c, dash };
  }, [percent]);

  // Animasi counter dan reveal content
  useEffect(() => {
    if (!loading && data) {
      // Delay reveal
      setTimeout(() => setShowContent(true), 100);
      
      // Animasi counter
      let start = 0;
      const end = nilai;
      const duration = 2000;
      const increment = end / (duration / 16);
      
      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setAnimatedScore(end);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }
  }, [loading, data, nilai]);

  /* ====== gates ====== */
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
          <div className="text-lg font-semibold text-slate-800">Data tidak ditemukan</div>
          <div className="text-slate-600 mt-1">Silakan hubungi panitia PPDB.</div>
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

  const status = data.examStatus || "—";
  const benar = Number(data.examScoreBenar ?? 0);
  const total = Number(data.examScoreTotal ?? 0);

  const finishedAt = toMs(data.examFinishedAt);
  const winStart = toMs(data.examWindowStartAt) || null;
  const winEnd = toMs(data.examWindowEndAt) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <Header />

      <main className="mx-auto w-full max-w-4xl px-4 md:px-6 py-10 flex-1 relative z-10">
        {/* Success celebration banner */}
        <div 
          className={`mb-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white shadow-xl transform transition-all duration-700 ${
            showContent ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg">Selamat! Ujian Telah Selesai</h3>
              <p className="text-white/90 text-sm mt-0.5">Hasil ujian Anda telah tersimpan dengan baik</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Kartu ring skor */}
          <div 
            className={`md:col-span-1 rounded-2xl border border-violet-400 bg-white shadow-2xl p-6 text-center transform transition-all duration-700 hover:scale-105 hover:shadow-violet-200/50 ${
              showContent ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'
            }`}
            style={{ transitionDelay: '100ms' }}
          >
            <div className="text-sm text-slate-500 font-medium">Hasil Nilai Ujian</div>
            <div className="relative mx-auto mt-4 h-[180px] w-[180px]">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 160 160" aria-hidden>
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0%" stopColor="#6a11cb" />
                    <stop offset="60%" stopColor="#763be4ff" />
                    <stop offset="100%" stopColor="#4121a0ff" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <circle cx="80" cy="80" r={ring.r} fill="none" stroke="#e9d7ff" strokeWidth="14" />
                <circle
                  cx="80"
                  cy="80"
                  r={ring.r}
                  fill="none"
                  stroke="url(#g)"
                  strokeWidth="14"
                  strokeDasharray={`${ring.dash} ${ring.c - ring.dash}`}
                  strokeLinecap="round"
                  filter="url(#glow)"
                  className="transition-all duration-1000 ease-out"
                  style={{ 
                    strokeDasharray: `${ring.dash} ${ring.c - ring.dash}`,
                  }}
                />
              </svg>

              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="flex flex-col items-center translate-y-[4px] md:translate-y-[5px]">
                  <div className="text-[44px] leading-none font-extrabold tracking-tight bg-gradient-to-br from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    {animatedScore}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 font-medium">Benar {benar} / {total}</div>
                </div>
              </div>
            </div>

            {/* Score badge */}
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200">
              <svg className="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold text-violet-700">Hasil Ujian Akademik</span>
            </div>
          </div>

          {/* Detail ujian */}
          <div 
            className={`md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 transform transition-all duration-700 hover:shadow-slate-200/50 ${
              showContent ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-violet-500 to-purple-500 rounded-full"></div>
              Rincian Hasil
            </h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div 
                className="rounded-lg border border-slate-200 p-4 bg-gradient-to-br from-white to-slate-50 transform transition-all duration-300 hover:scale-105 hover:shadow-md hover:border-violet-200"
                style={{ transitionDelay: '300ms' }}
              >
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Status</div>
                <div className="mt-2 font-semibold">
                  {status === "completed" ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3 py-1 text-sm font-semibold animate-pulse">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-ping"></span>
                      Selesai
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-3 py-1 text-sm">
                      {String(status).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  Waktu selesai: <b className="text-slate-800">{finishedAt ? fmtWITA(finishedAt) : "—"}</b>
                  <span className="block text-xs text-slate-500 mt-0.5">(WITA)</span>
                </div>
              </div>

              <div 
                className="rounded-lg border border-slate-200 p-4 bg-gradient-to-br from-white to-slate-50 transform transition-all duration-300 hover:scale-105 hover:shadow-md hover:border-violet-200"
                style={{ transitionDelay: '400ms' }}
              >
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Rentang Jadwal</div>
                <div className="mt-2 font-semibold text-slate-800 text-sm">
                  {winStart && winEnd ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-slate-600">Mulai: {fmtWITA(winStart)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-slate-600">Selesai: {fmtWITA(winEnd)}</span>
                      </div>
                    </div>
                  ) : "—"}
                </div>
                <div className="mt-3 text-xs text-slate-600">
                  Jadwal yang telah diatur oleh panitia.
                </div>
              </div>
            </div>

            {/* Additional info card */}
            <div 
              className="mt-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 p-4 transform transition-all duration-300"
              style={{ transitionDelay: '500ms' }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 text-sm">Informasi Penting</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Hasil ini bersifat final dan telah tercatat dalam sistem SPMB. 
                    Untuk informasi lebih lanjut, silakan hubungi panitia SPMB.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer mini */}
      <footer className="mt-auto py-6 text-center text-xs text-slate-500 relative z-10 transform transition-all duration-700">
        © {new Date().getFullYear()} SPMB • Tes Akademik
      </footer>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}