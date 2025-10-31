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
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
getStorage(app);

/* ========= Utils ========= */
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

function uniqById(arr) {
  const m = new Map();
  for (const r of arr) m.set(r.id || r._id, r);
  return Array.from(m.values());
}

/* ========= Table Component ========= */
function SoalTable({ rows = [], loading, onRefresh, onOpen, offset = 0 }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
        <div className="p-8 text-center text-slate-600">
          <div className="animate-pulse">Memuat data...</div>
        </div>
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="rounded-2xl p-6 text-center text-slate-500 ring-1 ring-violet-100 bg-white shadow-sm">
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
    <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-violet-50 border-b border-violet-200">
              <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">No</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Pertanyaan</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Mapel</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Kode Tingkat</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Tingkat (Label)</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Paket</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Jumlah Opsi</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Jawaban Benar</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Gambar</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const opsiLen = r?.opsi?.length ?? 0;
              const benar = typeof r?.jawabanIndex === "number" ? r?.opsi?.[r.jawabanIndex] : "-";
              const hasImage = !!(r?.imageUrl ?? r?.image ?? r?.imgUrl ?? r?.gambarUrl ?? r?.gambar);
              const label = r?.tingkatRaw || r?.jenjang || "-";
              const kode  = r?.tingkat || toSafeUpperSnake(label);

              return (
                <tr
                  key={r.id || `${offset}-${idx}`}
                  className="border-b border-violet-100 hover:bg-violet-50/50 transition-colors cursor-pointer"
                  onClick={() => onOpen?.(r)}
                >
                  <td className="px-4 py-3 text-sm text-slate-700">{offset + idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900 line-clamp-2 max-w-md">
                      {r?.pertanyaan || `Soal #${offset + idx + 1}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {r?.mapel || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <code className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {kode}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      {label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">
                    {r?.paketId || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-slate-900">
                    {opsiLen}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-900 font-medium line-clamp-1 max-w-xs">
                      {benar}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hasImage ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                        <span className="text-xs">Ada</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen?.(r);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-200 transition-colors"
                    >
                      Buka
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========= Page ========= */
export default function SoalAkademikBuilderPage() {
  const [open, setOpen] = useState(false);
  const [paketId, setPaketId] = useState("paket-1");
  const [viewMode, setViewMode] = useState("grid"); // "grid" atau "table"

  // Filter tingkat (LABEL dari fees); "ALL" = tanpa filter
  const [tingkatFilterRaw, setTingkatFilterRaw] = useState("ALL");
  const [tingkatOptions, setTingkatOptions] = useState([]); // array of fees.label
  const [tingkatLoading, setTingkatLoading] = useState(false);
  const [tingkatErr, setTingkatErr] = useState("");

  // Data soal
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // === State fitur copy massal tingkat → tingkat ===
  const [copyToLabel, setCopyToLabel] = useState("");
  const [copyLoading, setCopyLoading] = useState(false);

  // === Pagination (50 per halaman) ===
  const pageSize = 50;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageStart = page * pageSize;
  const pageRows = items.slice(pageStart, pageStart + pageSize);

  /* ====== Load daftar tingkat dari FEES (pakai field label) ====== */
  async function loadLevels() {
    setTingkatLoading(true);
    setTingkatErr("");
    try {
      const snap = await getDocs(query(collection(db, "fees"), qLimit(2000)));
      const set = new Set();
      snap.forEach((d) => {
        const label = (d.data()?.label || "").toString().trim();
        if (label) set.add(label);
      });
      const arr = Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
      setTingkatOptions(arr);
      // jaga filter tetap valid
      setTingkatFilterRaw((prev) =>
        prev === "ALL" ? "ALL" : arr.includes(prev) ? prev : "ALL"
      );
    } catch (e) {
      setTingkatErr(String(e.message || e));
      setTingkatOptions([]);
    } finally {
      setTingkatLoading(false);
    }
  }

  /* ====== Load list soal (paket + tingkat) ====== */
  async function loadList(nextPaketId = paketId, nextTingkatRaw = tingkatFilterRaw) {
    setLoading(true);
    try {
      const id = (nextPaketId ?? "").trim();
      const raw = (nextTingkatRaw ?? "ALL");
      const safe = raw === "ALL" ? "ALL" : toSafeUpperSnake(raw);

      const base = collection(db, "soal");

      // query utama
      const mainClauses = [];
      if (id) mainClauses.push(where("paketId", "==", id));
      if (safe !== "ALL") mainClauses.push(where("tingkat", "==", safe));

      const mainRef = mainClauses.length
        ? query(base, ...mainClauses, orderBy("updatedAt", "desc"), qLimit(120))
        : query(base, orderBy("updatedAt", "desc"), qLimit(120));

      const mainSnap = await getDocs(mainRef);
      let rows = mainSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // kompatibilitas soal lama: cari juga tingkatRaw == label, atau jenjang == label
      if (raw !== "ALL") {
        const rawRef = query(
          base,
          ...(id ? [where("paketId", "==", id)] : []),
          where("tingkatRaw", "==", raw),
          orderBy("updatedAt", "desc"),
          qLimit(120)
        );
        const jenjRef = query(
          base,
          ...(id ? [where("paketId", "==", id)] : []),
          where("jenjang", "==", raw),
          orderBy("updatedAt", "desc"),
          qLimit(120)
        );
        const [rawSnap, jenjSnap] = await Promise.all([getDocs(rawRef), getDocs(jenjRef)]);
        const moreA = rawSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const moreB = jenjSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows = uniqById([...rows, ...moreA, ...moreB]);
      }

      setItems(rows);
      setPage(0); // reset ke halaman pertama setiap reload/filter
    } catch (e) {
      console.error("loadList error:", e);
      setItems([]);
      setPage(0);
    } finally {
      setLoading(false);
    }
  }

  /* ====== Copy massal tingkat → tingkat (paket sama) ====== */
  async function copySoalBetweenLevels({
    fromLabel,   // mis. "SMA Putra"
    toLabel,     // mis. "SMA Putri"
    usePaketId,  // paket aktif
  }) {
    if (!fromLabel || fromLabel === "ALL") throw new Error("Pilih tingkat sumber yang spesifik.");
    if (!toLabel || toLabel === fromLabel) throw new Error("Tingkat tujuan harus berbeda.");

    const base = collection(db, "soal");
    const safeFrom = toSafeUpperSnake(fromLabel);
    const safeTo   = toSafeUpperSnake(toLabel);

    // Ambil sumber: dukung tingkat, tingkatRaw, dan jenjang (kompat)
    const clauses = [];
    if (usePaketId) clauses.push(where("paketId", "==", usePaketId));
    clauses.push(where("tingkat", "==", safeFrom));
    const qMain = clauses.length
      ? query(base, ...clauses, orderBy("updatedAt", "desc"), qLimit(500))
      : query(base, orderBy("updatedAt", "desc"), qLimit(500));

    const [snapMain, snapRaw, snapJenjang] = await Promise.all([
      getDocs(qMain),
      getDocs(
        query(
          base,
          ...(usePaketId ? [where("paketId", "==", usePaketId)] : []),
          where("tingkatRaw", "==", fromLabel),
          orderBy("updatedAt", "desc"),
          qLimit(500)
        )
      ),
      getDocs(
        query(
          base,
          ...(usePaketId ? [where("paketId", "==", usePaketId)] : []),
          where("jenjang", "==", fromLabel),
          orderBy("updatedAt", "desc"),
          qLimit(500)
        )
      ),
    ]);

    const sourceRows = new Map();
    for (const d of snapMain.docs) sourceRows.set(d.id, { id: d.id, ...d.data() });
    for (const d of snapRaw.docs)  sourceRows.set(d.id, { id: d.id, ...d.data() });
    for (const d of snapJenjang.docs) sourceRows.set(d.id, { id: d.id, ...d.data() });
    const sources = Array.from(sourceRows.values());

    // Ambil existing tujuan utk cegah duplikat berdasarkan pertanyaan (per paket & tingkat)
    const destSnap = await getDocs(
      query(
        base,
        ...(usePaketId ? [where("paketId", "==", usePaketId)] : []),
        where("tingkat", "==", safeTo),
        orderBy("updatedAt", "desc"),
        qLimit(1000)
      )
    );
    const destQuestions = new Set(
      destSnap.docs.map((d) => (d.data()?.pertanyaan || "").toString().trim())
    );

    let created = 0;
    for (const s of sources) {
      const qText = (s?.pertanyaan || "").toString().trim();
      if (!qText) continue;
      if (destQuestions.has(qText)) continue; // sudah ada — skip

      const payload = {
        paketId: (usePaketId || s?.paketId || "").toString().trim(),
        mapel: (s?.mapel || "Umum"),
        tingkat: safeTo,
        tingkatRaw: toLabel,
        pertanyaan: qText,
        opsi: Array.isArray(s?.opsi) ? s.opsi.slice() : [],
        opsiImages: Array.isArray(s?.opsiImages) ? s.opsiImages.slice(0, (s?.opsi?.length || 0)) : [],
        jawabanIndex: typeof s?.jawabanIndex === "number" ? s.jawabanIndex : 0,
        aktif: true,
        imageUrl: (s?.imageUrl || s?.image || s?.imgUrl || s?.gambarUrl || s?.gambar || ""),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(base, payload);
      destQuestions.add(qText);
      created++;
    }
    return { totalSource: sources.length, created };
  }

  /* ===== Effects ===== */
  useEffect(() => { loadLevels(); }, []);
  useEffect(() => { loadList(); }, []);
  useEffect(() => { loadList(paketId, tingkatFilterRaw); }, [paketId, tingkatFilterRaw]);

  /* ===== Render ===== */
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* HERO */}
      <HeroSection onAdd={() => { setSelected(null); setOpen(true); }} />

      {/* Toolbar Paket + Filter + Toggle View */}
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

            {/* Filter Tingkat (LABEL dari fees) */}
            <div className="flex items-center gap-2 bg-white rounded-full border border-violet-200 px-3 py-2 w-fit shadow-sm">
              <span className="text-sm text-slate-600">Tingkat:</span>
              <select
                value={tingkatFilterRaw}
                onChange={(e) => setTingkatFilterRaw(e.target.value)}
                className="text-sm bg-transparent outline-none"
                title="Filter tingkat berdasarkan label (fees)"
                disabled={tingkatLoading}
              >
                <option value="ALL">Semua</option>
                {tingkatOptions.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
              {tingkatErr && <span className="text-xs text-amber-600">{tingkatErr}</span>}
            </div>

            {/* Copy massal: dari tingkatFilterRaw → copyToLabel */}
            <div className="flex items-center gap-2 bg-white rounded-full border border-violet-200 px-3 py-2 w-fit shadow-sm">
              <span className="text-sm text-slate-600">Copy ke:</span>
              <select
                value={copyToLabel}
                onChange={(e) => setCopyToLabel(e.target.value)}
                className="text-sm bg-transparent outline-none"
                disabled={tingkatLoading || tingkatFilterRaw === "ALL"}
                title="Pilih tingkat tujuan"
              >
                <option value="">Pilih…</option>
                {tingkatOptions
                  .filter((j) => j !== tingkatFilterRaw)
                  .map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
              <button
                onClick={async () => {
                  if (!tingkatFilterRaw || tingkatFilterRaw === "ALL") { alert("Pilih tingkat sumber dulu."); return; }
                  if (!copyToLabel) { alert("Pilih tingkat tujuan."); return; }
                  setCopyLoading(true);
                  try {
                    const res = await copySoalBetweenLevels({
                      fromLabel: tingkatFilterRaw,
                      toLabel: copyToLabel,
                      usePaketId: paketId,
                    });
                    alert(`Selesai. Sumber: ${res.totalSource}, dibuat baru: ${res.created}.`);
                    // tampilkan tujuan setelah copy
                    await loadList(paketId, copyToLabel);
                    setTingkatFilterRaw(copyToLabel);
                  } catch (e) {
                    alert(String(e.message || e));
                  } finally {
                    setCopyLoading(false);
                  }
                }}
                disabled={copyLoading || tingkatFilterRaw === "ALL" || !copyToLabel}
                className="text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-full disabled:opacity-50"
                title="Salin semua soal dari tingkat sumber ke tingkat tujuan untuk paket aktif"
              >
                {copyLoading ? "Menyalin…" : "Copy Soal"}
              </button>
            </div>
          </div>

          {/* Toggle View Buttons */}
          <div className="flex rounded-full border border-violet-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={[
                "px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "grid"
                  ? "bg-violet-600 text-white"
                  : "bg-white text-slate-800 hover:bg-violet-50"
              ].join(" ")}
              title="Tampilan Grid"
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={[
                "px-3 py-2 text-sm font-semibold transition-colors border-l border-violet-200",
                viewMode === "table"
                  ? "bg-violet-600 text-white"
                  : "bg-white text-slate-800 hover:bg-violet-50"
              ].join(" ")}
              title="Tampilan Tabel"
            >
              ≡ Tabel
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 pb-12 mt-4">
        {viewMode === "grid" ? (
          <SoalCards
            rows={pageRows}
            loading={loading}
            onRefresh={loadList}
            onOpen={(row) => { setSelected(row); setOpen(true); }}
          />
        ) : (
          <SoalTable
            rows={pageRows}
            loading={loading}
            onRefresh={loadList}
            onOpen={(row) => { setSelected(row); setOpen(true); }}
            offset={pageStart}
          />
        )}

        {/* Pagination Controls */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Menampilkan{" "}
            <span className="font-semibold text-violet-700">
              {pageRows.length}
            </span>{" "}
            dari <span className="font-semibold">{items.length}</span> soal • Halaman{" "}
            <span className="font-semibold">{page + 1}</span> / {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg px-3 py-2 text-sm font-semibold border border-slate-300 disabled:opacity-50 hover:bg-slate-50"
              aria-label="Halaman sebelumnya"
            >
              ‹ Prev
            </button>

            {/* nomor halaman ringkas */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).slice(Math.max(0, page - 2), Math.min(totalPages, page + 3)).map((_, i, arr) => {
                const start = Math.max(0, page - 2);
                const n = start + i;
                const active = n === page;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={[
                      "h-8 w-8 rounded-md text-sm font-semibold",
                      active ? "bg-violet-600 text-white" : "border border-slate-300 hover:bg-slate-50"
                    ].join(" ")}
                    aria-label={`Halaman ${n + 1}`}
                  >
                    {n + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg px-3 py-2 text-sm font-semibold border border-slate-300 disabled:opacity-50 hover:bg-slate-50"
              aria-label="Halaman berikutnya"
            >
              Next ›
            </button>
          </div>
        </div>
      </main>

      {/* Modal (builder) */}
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
