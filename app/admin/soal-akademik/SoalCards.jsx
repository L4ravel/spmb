"use client";

import { useEffect, useState } from "react";

/* ===== Firebase Storage (untuk resolve downloadURL) ===== */
import { getApp, getApps, initializeApp } from "firebase/app";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";

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
const storage = getStorage(app);

/* ===== Utils gambar ===== */
function pickImageCandidate(d = {}) {
  return (
    d?.imageUrl ??
    d?.image ??
    d?.imgUrl ??
    d?.gambarUrl ??
    d?.gambar ??
    ""
  );
}
function isHttpUrl(u = "") { return /^https?:\/\//i.test(u); }
function isGsUrl(u = "") { return /^gs:\/\//i.test(u); }
/** path storage relatif = bukan http/gs/data: */
function isStoragePath(u = "") {
  return !!u && !isHttpUrl(u) && !isGsUrl(u) && !u.startsWith("data:");
}

/* ===== Single Card ===== */
function SoalCard({ data, index = 0, onOpen }) {
  const opsiLen = data?.opsi?.length ?? 0;
  const benar =
    typeof data?.jawabanIndex === "number" ? data?.opsi?.[data.jawabanIndex] : "-";

  // ===== Resolve thumbnail =====
  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbLoading, setThumbLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        setThumbLoading(true);
        const candidate = pickImageCandidate(data);
        if (!candidate) { setThumbUrl(""); return; }

        if (isHttpUrl(candidate)) {
          if (!ignore) setThumbUrl(candidate);
          return;
        }
        if (isGsUrl(candidate) || isStoragePath(candidate)) {
          const ref = storageRef(storage, candidate);
          const url = await getDownloadURL(ref);
          if (!ignore) setThumbUrl(url);
          return;
        }
        // tipe lain (data:) kita tidak tampilkan di kartu
        setThumbUrl("");
      } catch {
        setThumbUrl("");
      } finally {
        if (!ignore) setThumbLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [data]);

  // ===== Badge jenjang (gantikan bobot) =====
  const jenjang = (data?.tingkat || data?.jenjang || "—").toString();

  return (
    <div
      className={[
        "group relative rounded-2xl overflow-hidden bg-white",
        "ring-1 ring-violet-100",
        "shadow-[0_10px_25px_rgba(24,0,75,.06)]",
        "transition-all duration-300 hover:-translate-y-0.5",
        "cursor-pointer",
      ].join(" ")}
      onClick={() => onOpen?.(data)}
    >
      {/* THUMBNAIL (16:9) */}
      <div className="relative w-full pt-[56%] bg-slate-50">
        {/* skeleton */}
        {thumbLoading && (
          <div className="absolute inset-0 animate-pulse bg-slate-100" />
        )}
        {/* img */}
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={data?.pertanyaan ? data.pertanyaan : `Soal #${index + 1}`}
            className="absolute inset-0 w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          !thumbLoading && (
            <div className="absolute inset-0 grid place-items-center text-slate-400 text-xs">
              (tidak ada gambar)
            </div>
          )
        )}
        {/* badge jenjang di pojok */}
        <span className="absolute top-2 right-2 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
          {jenjang}
        </span>
      </div>

      {/* BODY */}
      <div className="p-5">
        {/* header kecil + ikon */}
        <div className="flex items-start justify-between">
          <div className="text-[11px] tracking-wide text-slate-500">PPDB</div>
          <div className="rounded-xl p-2 bg-violet-50 ring-1 ring-violet-100">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-violet-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6a2 2 0 0 1 2-2h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="M14 4v4h4" />
            </svg>
          </div>
        </div>

        {/* judul soal */}
        <div className="mt-3 font-semibold text-slate-900">
          {data?.pertanyaan ? (
            <span className="line-clamp-1">{data.pertanyaan}</span>
          ) : (
            `Soal #${index + 1}`
          )}
        </div>

        {/* meta ringkas */}
        <div className="mt-1 text-sm text-slate-600">
          {data?.mapel || "—"} • {data?.tingkat || "—"} • {opsiLen} opsi
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Jawaban benar: <b className="text-slate-700">{benar}</b>
        </div>

        {/* footer: tombol Buka */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen?.(data); }}
            className={[
              "inline-flex items-center gap-1 text-sm font-semibold",
              "text-violet-700 hover:text-violet-800",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 rounded-full px-1",
              "transition-colors",
              "cursor-pointer",
            ].join(" ")}
          >
            Buka
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* glow halus saat hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ boxShadow: "inset 0 0 0 1px rgba(124,58,237,.08), 0 0 0 1px rgba(124,58,237,.06)" }}
      />
    </div>
  );
}

/* ===== Skeleton untuk loading ===== */
function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white ring-1 ring-violet-100 shadow-[0_8px_20px_rgba(24,0,75,.06)]">
      <div className="w-full pt-[56%] bg-slate-100 animate-pulse" />
      <div className="p-5">
        <div className="h-4 w-10 bg-slate-200 rounded" />
        <div className="mt-3 h-5 w-3/4 bg-slate-200 rounded" />
        <div className="mt-2 h-4 w-1/2 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

/* ===== Grid Kartu Langsung ===== */
export default function SoalCards({ rows = [], loading, onRefresh, onOpen }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="rounded-2xl p-6 text-center text-slate-500 ring-1 ring-violet-100 bg-white shadow-[0_8px_20px_rgba(24,0,75,.06)]">
        Belum ada soal.
        <button
          onClick={onRefresh}
          className="ml-2 text-violet-700 font-semibold hover:text-violet-800 underline decoration-violet-300 underline-offset-4"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((r, i) => (
        <SoalCard key={r.id || i} data={r} index={i} onOpen={onOpen} />
      ))}
    </div>
  );
}
