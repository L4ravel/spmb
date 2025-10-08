"use client";

import { useEffect, useState } from "react";
import HeroSection from "./HeroSection";
import SoalModal from "./SoalModal";
import SoalCards from "./SoalCards";

/* === Firebase client === */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as qLimit,
} from "firebase/firestore";

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
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

/* ========= Page ========= */
export default function SoalAkademikBuilderPage() {
  const [open, setOpen] = useState(false);
  const [paketId, setPaketId] = useState("paket-1");

  // Filter tingkat (RAW dari users_app.registrationLevel); "ALL" = tanpa filter
  const [tingkatFilterRaw, setTingkatFilterRaw] = useState("ALL");
  const [tingkatOptions, setTingkatOptions] = useState([]); // array of raw labels
  const [tingkatLoading, setTingkatLoading] = useState(false);
  const [tingkatErr, setTingkatErr] = useState("");

  // Data soal
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  /* ====== Load daftar tingkat dari users_app.registrationLevel ====== */
  async function loadLevels() {
    setTingkatLoading(true);
    setTingkatErr("");
    try {
      // longgar saat tes: public read ok (rules sudah kamu longgarkan)
      const snap = await getDocs(
        // ambil maksimal 2000 user; kalau lebih besar, nanti kita paging
        // @ts-ignore
        query(collection(db, "users_app"), qLimit(2000))
      );
      const set = new Set();
      snap.forEach((d) => {
        const v = (d.data()?.registrationLevel || "").toString().trim();
        if (v) set.add(v);
      });
      const arr = Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
      setTingkatOptions(arr);
      // jika sebelumnya ALL, biarkan; kalau tidak ada, tetap ALL
      setTingkatFilterRaw((prev) => (prev === "ALL" ? "ALL" : (arr.includes(prev) ? prev : "ALL")));
    } catch (e) {
      setTingkatErr(String(e.message || e));
      setTingkatOptions([]);
    } finally {
      setTingkatLoading(false);
    }
  }

  /* ====== Load list soal (paket + tingkat safe) ====== */
  async function loadList(nextPaketId = paketId, nextTingkatRaw = tingkatFilterRaw) {
    setLoading(true);
    try {
      const id = (nextPaketId ?? "").trim();
      const raw = (nextTingkatRaw ?? "ALL");
      const safe = raw === "ALL" ? "ALL" : toSafeUpperSnake(raw);

      const base = collection(db, "soal");
      const clauses = [];
      if (id) clauses.push(where("paketId", "==", id));
      if (safe !== "ALL") clauses.push(where("tingkat", "==", safe)); // 'tingkat' tersimpan UPPER_SNAKE_CASE

      const qRef = clauses.length
        ? query(base, ...clauses, orderBy("updatedAt", "desc"), qLimit(100))
        : query(base, orderBy("updatedAt", "desc"), qLimit(100));

      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(rows);
    } catch (e) {
      console.error("loadList error:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  /* ===== Effects ===== */
  useEffect(() => { loadLevels(); }, []);
  useEffect(() => { loadList(); }, []); // initial
  useEffect(() => { loadList(paketId, tingkatFilterRaw); }, [paketId, tingkatFilterRaw]);

  /* ===== Render ===== */
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">   

      {/* HERO */}
      <HeroSection onAdd={() => { setSelected(null); setOpen(true); }} />

      {/* Toolbar Paket + Filter */}
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 mt-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Paket */}
          <div className="flex items-center gap-2 bg-white rounded-full border border-violet-200 px-3 py-2 w-fit shadow-sm">
            <span className="text-sm text-slate-600">Paket:</span>
            <input
              value={paketId}
              onChange={(e) => setPaketId(e.target.value)}
              className="bg-transparent outline-none text-sm px-1 w-40"
              placeholder="paket-1"
            />
            <button onClick={() => loadList()} className="text-sm text-violet-700 hover:text-violet-800">
              Reload
            </button>
          </div>

          {/* Filter Tingkat (RAW dari users_app) */}
          <div className="flex items-center gap-2 bg-white rounded-full border border-violet-200 px-3 py-2 w-fit shadow-sm">
            <span className="text-sm text-slate-600">Tingkat:</span>
            <select
              value={tingkatFilterRaw}
              onChange={(e) => setTingkatFilterRaw(e.target.value)}
              className="text-sm bg-transparent outline-none"
              title="Filter tingkat dari registrationLevel"
              disabled={tingkatLoading}
            >
              <option value="ALL">Semua</option>
              {tingkatOptions.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            {tingkatErr && <span className="text-xs text-amber-600">{tingkatErr}</span>}
          </div>
        </div>
      </div>

      {/* Grid kartu */}
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 pb-12 mt-4">
        <SoalCards
          rows={items}
          loading={loading}
          onRefresh={loadList}
          onOpen={(row) => { setSelected(row); setOpen(true); }}
        />
      </main>

      {/* Modal */}
      <SoalModal
        open={open}
        onClose={() => { setOpen(false); setSelected(null); }}
        defaultPaketId={paketId}
        initialData={selected}
        onSaved={() => { setOpen(false); setSelected(null); loadList(); }}
      />
    </div>
  );
}
