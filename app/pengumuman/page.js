"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

/** =========================
 *  Firebase boot (client)
 *  ========================= */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
// Reuse app jika sudah ada
function getDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}
const db = getDb();

/** =========================
 *  DATA MAP CONFIG (ubah di sini kalau perlu)
 *  ========================= */
const COLLECTION_SOURCE   = "users_app";  // ← sumber pengumuman
const COLLECTION_PPDB     = "ppdb";       // untuk ambil ayahNama
const FIELD_DECISION      = "finalDecision";         // "LULUS" / "TIDAK_LULUS"
const FIELD_NAME_CANDIDATES = ["fullName","fullname","displayName","name"]; // nama di users_app
const FIELD_LEVELS        = ["registrationLevel","level"]; // jenjang
const FIELD_NISN_CANDIDATES = ["username","nisn","id"];    // kandidat field NISN
const FIELD_AYAH          = "ayahNama";    // di ppdb
const PASS_VALUE          = "LULUS";

function pick(obj, keys, fallback="") {
  for (const k of keys) if (obj && obj[k]) return obj[k];
  return fallback;
}

/** Ambil field jenjang yang tersedia */
function pickLevel(obj) {
  for (const k of FIELD_LEVELS) {
    if (obj && obj[k]) return obj[k];
  }
  return "";
}

/** Pastikan NISN tampil dengan leading zero (jangan casting number) */
function keepLeading(v) {
  if (v == null) return "";
  return String(v);
}

/** =========================
 *  Page Component
 *  ========================= */
export default function PengumumanPage() {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState([]); // data mentah lulus
  const [ayahMap, setAyahMap] = useState(new Map()); // nisn -> ayahNama
  const [error, setError] = useState("");

  // UI state
  const [qText, setQText] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Ambil data lulus
  useEffect(() => {
  (async () => {
    setLoading(true);
    setError("");
    try {
      // Ambil langsung dari users_app: siswa, verified, finalDecision = LULUS
      const qUsers = query(
        collection(db, COLLECTION_SOURCE),
        where("role", "==", "siswa"),
        where("registrationPaymentStatus", "==", "verified"),
        where(FIELD_DECISION, "==", PASS_VALUE)
      );
      const snap = await getDocs(qUsers);

      // Map rows dasar
      const rows = snap.docs.map((d) => {
        const data = d.data() || {};
        const nisn = String(pick(data, FIELD_NISN_CANDIDATES, d.id));
        return {
          id: d.id,
          nisn,
          name: pick(data, FIELD_NAME_CANDIDATES, ""),
          level: pick(data, FIELD_LEVELS, ""),
        };
      });

      // Join ayahNama dari ppdb/{nisn}
      const ayahPairs = [];
      await Promise.all(
        rows.map(async (r) => {
          const ref = doc(db, COLLECTION_PPDB, r.nisn);
          const ds = await getDoc(ref);
          const ayahNama = ds.exists() ? (ds.data()?.[FIELD_AYAH] ?? "") : "";
          ayahPairs.push([r.nisn, ayahNama]);
        })
      );

      setAyahMap(new Map(ayahPairs));
      setRaw(rows);
    } catch (e) {
      console.error(e);
      setError("Gagal memuat data pengumuman.");
    } finally {
      setLoading(false);
    }
  })();
}, []);


  // Daftar jenjang unik (untuk filter)
  const levelOptions = useMemo(() => {
    const s = new Set(raw.map((r) => (r.level || "").toString()));
    const arr = Array.from(s).filter(Boolean).sort();
    return ["ALL", ...arr];
  }, [raw]);

  // Filter + search
  const filtered = useMemo(() => {
    const term = qText.trim().toLowerCase();
    return raw.filter((r) => {
      if (levelFilter !== "ALL" && (r.level || "") !== levelFilter) return false;
      if (!term) return true;
      const hay =
        `${r.nisn} ${r.name} ${r.level} ${r.ayahNama ?? ayahMap.get(r.nisn) ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [raw, qText, levelFilter, ayahMap]);

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * pageSize;
  const current = filtered.slice(start, start + pageSize);

  useEffect(() => {
    // reset ke page 1 saat filter/search berubah
    setPage(1);
  }, [qText, levelFilter, pageSize]);

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-violet-700 tracking-tight">
          Pengumuman Kelulusan
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Menampilkan data yang berstatus <span className="font-semibold">LULUS</span>.
        </p>
      </header>

      {/* Controls */}
      <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Cari nama / NISN / ayah…"
              className="w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {levelOptions.map((lv) => (
              <option key={lv} value={lv}>
                {lv === "ALL" ? "Semua Jenjang" : lv}
              </option>
            ))}
          </select>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-slate-600">
          Total lulus:{" "}
          <span className="font-semibold text-slate-900">{total}</span>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-3xl border border-violet-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm text-black">
            <thead>
              <tr className="bg-violet-50 text-slate-800">
                {["No", "NISN", "Nama", "Ayah", "Jenjang"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-violet-100 px-4 py-3 text-left font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Memuat data…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : current.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Belum ada data lulus untuk filter saat ini.
                  </td>
                </tr>
              ) : (
                current.map((r, idx) => {
                  const no = start + idx + 1;
                  const ayahNama = r.ayahNama ?? ayahMap.get(r.nisn) ?? "";
                  return (
                    <tr key={`${r.nisn}-${no}`} className="hover:bg-violet-50/40">
                      <td className="border-b border-slate-100 px-4 py-2">{no}</td>
                      <td className="border-b border-slate-100 px-4 py-2 font-mono tabular-nums">
                        {keepLeading(r.nisn)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2">{r.name}</td>
                      <td className="border-b border-slate-100 px-4 py-2">{ayahNama}</td>
                      <td className="border-b border-slate-100 px-4 py-2">{r.level}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-slate-600">
            Halaman <span className="font-semibold">{pageSafe}</span> dari{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 disabled:opacity-50 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 disabled:opacity-50 hover:bg-slate-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
