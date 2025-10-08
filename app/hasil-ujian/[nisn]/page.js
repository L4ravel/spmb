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
  if (typeof v?.toMillis === "function") return v.toMillis(); // Firestore Timestamp
  if (typeof v === "number" && Number.isFinite(v)) return v; // number ms
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0; // ISO/date string
  }
  return 0;
}

export default function HasilUjianPage() {
  const { nisn } = useParams();
  const router = useRouter();

  /* ====== state ====== */
  const [checking, setChecking] = useState(true);
  const [allow, setAllow] = useState(false);

  const [data, setData] = useState(null); // users_app doc
  const [loading, setLoading] = useState(true);

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

  const ring = useMemo(() => {
    const p = Math.max(0, Math.min(100, percent));
    const r = 70; // px
    const c = 2 * Math.PI * r;
    const dash = (p / 100) * c;
    return { r, c, dash };
  }, [percent]);

  /* ====== gates ====== */
  if (checking) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="text-slate-600 animate-pulse">Memeriksa sesi…</div>
      </div>
    );
  }
  if (!allow) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header dipanggil dari component */}
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
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
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-800">Data tidak ditemukan</div>
          <div className="text-slate-600 mt-1">Silakan hubungi panitia PPDB.</div>
          <button
            onClick={() => router.replace("/portal")}
            className="mt-4 rounded-lg bg-violet-600 text-white px-4 py-2 font-semibold hover:bg-violet-700"
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header dipanggil dari component */}
      <Header />

      {/* Body */}
      <main className="mx-auto w-full max-w-4xl px-4 md:px-6 py-10 flex-1">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Kartu ring skor */}
          <div className="md:col-span-1 rounded-2xl border border-violet-400 bg-white shadow-[0_15px_45px_rgba(24,0,75,.06)] p-6 text-center">
            <div className="text-sm text-slate-500">Hasil Nilai Ujian</div>
            <div className="relative mx-auto mt-4 h-[180px] w-[180px]">
              <svg className="h-full w-full" viewBox="0 0 160 160">
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0%" stopColor="#6a11cb" />
                    <stop offset="60%" stopColor="#763be4ff" />
                    <stop offset="100%" stopColor="#4121a0ff" />
                  </linearGradient>
                </defs>

                <circle cx="80" cy="80" r={ring.r} fill="none" stroke="#bb84f7ff" strokeWidth="14" />
                <circle
                  cx="80"
                  cy="80"
                  r={ring.r}
                  fill="none"
                  stroke="url(#g)"
                  strokeWidth="14"
                  strokeDasharray={`${ring.dash} ${ring.c - ring.dash}`}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-4xl font-extrabold text-violet-700">{percent}%</div>
                <div className="text-xs text-slate-500 mt-1">
                  Benar {benar} / {total}
                </div>
              </div>
            </div>
          </div>

          {/* Detail ujian */}
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-[0_15px_45px_rgba(24,0,75,.06)] p-6">
            <h2 className="text-lg font-bold text-slate-900">Rincian Hasil</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-1 font-semibold">
                  {status === "completed" ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-sm">
                      Selesai
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 text-sm">
                      {String(status).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Waktu selesai: <b>{finishedAt ? fmtWITA(finishedAt) : "—"}</b> (WITA)
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Rentang Jadwal</div>
                <div className="mt-1 font-semibold text-slate-800">
                  {winStart && winEnd ? `${fmtWITA(winStart)} — ${fmtWITA(winEnd)}` : "—"}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Jadwal yang telah diatur oleh panitia. 
                </div>
              </div>

              {/* (Rekomendasi & Tindakan dihapus sesuai permintaan) */}
            </div>
          </div>
        </div>
      </main>

      {/* Footer mini */}
      <footer className="mt-auto py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} PPDB • Tes Akademik
      </footer>
    </div>
  );
}
