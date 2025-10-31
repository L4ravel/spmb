// app/admin/data-daftar-ulang/page.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ChevronRight, Search } from "lucide-react";
import { listUsersWithPaymentPage } from "./data/firestore";
import DafulTable from "./components/DafulTable";

import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, orderBy, limit as fbLimit, query,
} from "firebase/firestore";

/* ========= Helpers ========= */
const up = (v) => (v ?? "").toString().trim().toUpperCase();
const normPTK = (v) => {
  const s = up(v);
  if (["APPROVED","VERIFIED","ACCEPTED","CONFIRMED"].includes(s)) return "APPROVED";
  if (["REJECTED","DENIED","DECLINED"].includes(s)) return "REJECTED";
  return s || "PENDING";
};

// ambil kandidat key dokumen users_app (urutan penting: docId/username dulu)
function pickDocKeys(r) {
  const cands = [
    r?.id,
    r?.docId,
    r?.username,      // kebiasaan: username = id dokumen (contoh "02970011")
    r?.uid,
    r?.userId,
    r?.NIS, r?.NISN,
    r?.nisn,          // paling belakang karena sering beda dengan doc id
  ].map((x) => (x ?? "").toString().trim()).filter(Boolean);
  return Array.from(new Set(cands));
}

/* ========= Prefetch & Cache (dipakai lintas batch) =========
   Kita kurangi latency dengan:
   1) Kumpulkan semua KEY unik dari satu batch.
   2) Prefetch paralel:
      - users_app/{k}  -> ambil finalDecision (jika ada)
      - users_app/{k}/ptk_confirmation/current -> status PTK
   3) HANYA untuk key yang belum dapat finalDecision, barulah query subkoleksi
      users_app/{k}/finalDecision (orderBy finalDecidedAt desc, limit 1).
   4) Simpan ke cache agar batch berikutnya reuse.
*/
async function prefetchMetaForKeys(keys, cache) {
  const unique = Array.from(new Set(keys)).filter(Boolean);
  const missing = unique.filter((k) => !cache.has(k));

  if (missing.length === 0) return cache;

  // Pass 1: ambil dok utama & ptk current secara paralel
  await Promise.all(
    missing.map(async (k) => {
      let fd = "";
      let ptkApproved = false;
      try {
        const [userDoc, ptkDoc] = await Promise.all([
          getDoc(doc(db, "users_app", k)),
          getDoc(doc(db, "users_app", k, "ptk_confirmation", "current")),
        ]);
        if (userDoc.exists()) fd = up(userDoc.data()?.finalDecision);
        if (ptkDoc.exists())  ptkApproved = normPTK(ptkDoc.data()?.status) === "APPROVED";
      } catch {}
      cache.set(k, { fd, ptkApproved });
    })
  );

  // Pass 2: untuk yang finalDecision masih kosong -> cek subkoleksi (batasi paralel)
  const needFd = missing.filter((k) => !cache.get(k)?.fd);
  const CONCURRENCY = 6;
  for (let i = 0; i < needFd.length; i += CONCURRENCY) {
    const slice = needFd.slice(i, i + CONCURRENCY);
    // jalankan paralel per slice agar tidak over-fetch
    await Promise.all(
      slice.map(async (k) => {
        try {
          const qref = query(
            collection(db, "users_app", k, "finalDecision"),
            orderBy("finalDecidedAt", "desc"),
            fbLimit(1)
          );
          const snap = await getDocs(qref);
          if (!snap.empty) {
            const fd = up(snap.docs[0].data()?.finalDecision);
            const prev = cache.get(k) || { fd: "", ptkApproved: false };
            cache.set(k, { ...prev, fd });
          }
        } catch {}
      })
    );
  }

  return cache;
}

/* Enrich batch dengan cache & prefetch (super cepat) */
async function enrichBatch(rows, cache) {
  // 1) kumpulkan semua key unik dari rows (termasuk fallback id/username/nisn)
  const allKeys = rows.flatMap((r) => pickDocKeys(r));
  // 2) prefetch meta ke cache
  await prefetchMetaForKeys(allKeys, cache);
  // 3) susun output
  return rows.map((r) => {
    const keys = pickDocKeys(r);
    let fd = up(r?.finalDecision);
    let ptkApproved = false;

    for (const k of keys) {
      const m = cache.get(k);
      if (!m) continue;
      if (!fd && m.fd) fd = m.fd;
      if (m.ptkApproved) ptkApproved = true;
      if (fd && ptkApproved) break; // cukup
    }

    return { ...r, __finalDecision: fd, __ptkApproved: !!ptkApproved };
  });
}

/* --- Aturan dataset halaman ---
   - PTK = __ptkApproved === true (ikut untuk tab "Semua")
   - Non-PTK = !__ptkApproved && __finalDecision === "LULUS"
   - Lainnya dibuang dari dataset
*/
const coreFilter = (rows) =>
  rows.filter((r) => r.__ptkApproved || (!r.__ptkApproved && up(r.__finalDecision) === "LULUS"));

export default function DataDaftarUlangPage() {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState([]);
  const [enrichedRows, setEnrichedRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);

  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState("");

  const [filterJenjang, setFilterJenjang] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "PTK" | "Non-PTK"
  const [filterLunas, setFilterLunas] = useState("all");   // "all" | "lunas" | "belum"

  // cache meta lintas batch (key = users_app docId/username/nisn)
  const metaCacheRef = useRef(new Map());

  /* FILL-UNTIL-PAGE setelah coreFilter — dipercepat dengan enrichBatch */
  const reload = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      let localRaw = reset ? [] : [...raw];
      let localEnriched = reset ? [] : [...enrichedRows];
      let localCursor = reset ? null : cursorRef.current;
      let localHasMore = true;

      const SAFETY = 30;
      let iter = 0;

      while (true) {
        iter += 1;
        const current = coreFilter(localEnriched);
        if (current.length >= pageSize) break;
        if (!localHasMore && iter > 1) break;

        const res = await listUsersWithPaymentPage({
          pageSize,
          cursor: localCursor,
        });

        const batch = res.list || [];
        if (!batch.length) { localHasMore = false; break; }

        // ==== ENRICH CEPAT (prefetch+cache per batch) ====
        const enriched = await enrichBatch(batch, metaCacheRef.current);

        localRaw = [...localRaw, ...batch];
        localEnriched = [...localEnriched, ...enriched];

        localCursor = res.lastDoc || null;
        localHasMore = !!res.lastDoc;

        if (iter >= SAFETY || !localHasMore) break;
      }

      setRaw(localRaw);
      setEnrichedRows(localEnriched);
      cursorRef.current = localCursor;
      setHasMore(!!localCursor);
    } finally {
      setLoading(false);
    }
  }, [pageSize, raw, enrichedRows]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    setLoading(true);
    try {
      const res = await listUsersWithPaymentPage({ pageSize, cursor: cursorRef.current });
      const batch = res.list || [];
      // ==== ENRICH CEPAT ====
      const enriched = await enrichBatch(batch, metaCacheRef.current);

      setRaw((s) => [...s, ...batch]);
      setEnrichedRows((s) => [...s, ...enriched]);
      cursorRef.current = res.lastDoc || null;
      setHasMore(!!res.lastDoc);
    } finally {
      setLoading(false);
    }
  }, [hasMore, pageSize]);

  useEffect(() => { reload(true); /* on mount */ }, []);               // eslint-disable-line
  useEffect(() => { reload(true); }, [pageSize]);                      // refill saat pageSize berubah

  /* Dataset dasar halaman sesuai aturan */
  const effectiveRows = useMemo(() => coreFilter(enrichedRows), [enrichedRows]);

  /* Filter UI */
  const filtered = useMemo(() => {
    if (!q && filterJenjang === "all" && filterStatus === "all" && filterLunas === "all") {
      return effectiveRows;
    }
    return effectiveRows.filter((r) => {
      const qq = q.toLowerCase();
      const matchSearch =
        !q || `${r.nisn} ${r.username} ${r.fullName} ${r.level}`.toLowerCase().includes(qq);

      const matchJenjang = filterJenjang === "all" || r.level === filterJenjang;

      // Status pakai definisi baru:
      const isPTK = !!r.__ptkApproved;
      const isNonPTK = !r.__ptkApproved && up(r.__finalDecision) === "LULUS";
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "PTK" ? isPTK : isNonPTK);

      const isLunas = r.tunggakan <= 0 && r.kewajibanTotal > 0;
      const matchLunas =
        filterLunas === "all" ||
        (filterLunas === "lunas" && isLunas) ||
        (filterLunas === "belum" && !isLunas);

      return matchSearch && matchJenjang && matchStatus && matchLunas;
    });
  }, [effectiveRows, q, filterJenjang, filterStatus, filterLunas]);

  /* Jenjang & stats berdasarkan effectiveRows */
  const jenjangList = useMemo(() => {
    const set = new Set();
    for (const r of effectiveRows) if (r.level) set.add(r.level);
    return Array.from(set).sort();
  }, [effectiveRows]);

  const stats = useMemo(() => {
    const ptk = effectiveRows.filter((r) => !!r.__ptkApproved).length;
    const nonPtk = effectiveRows.filter((r) => !r.__ptkApproved && up(r.__finalDecision) === "LULUS").length;
    const lunas = effectiveRows.filter((r) => r.tunggakan <= 0 && r.kewajibanTotal > 0).length;
    const belumLunas = effectiveRows.length - lunas;
    return { ptk, nonPtk, lunas, belumLunas };
  }, [effectiveRows]);

  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-slate-700 via-slate-600 to-slate-500 shadow-lg" />
            <h1 className="text-3xl md:text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Data Daftar Ulang
            </h1>
          </div>
          
        </div>

        {/* Controls */}
        <div className="rounded-xl border border-slate-200/50 bg-white shadow-lg p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Data</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{effectiveRows.length}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">PTK</div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{stats.ptk}</div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-3 border border-violet-200">
              <div className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Lunas</div>
              <div className="text-2xl font-bold text-violet-900 mt-1">{stats.lunas}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
              <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Belum Lunas</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{stats.belumLunas}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Jenjang</label>
              <select
                value={filterJenjang}
                onChange={(e) => setFilterJenjang(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
              >
                <option value="all">Semua Jenjang</option>
                {jenjangList.map((j) => (<option key={j} value={j}>{j}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
              >
                <option value="all">Semua Status</option>
                <option value="PTK">PTK ({stats.ptk})</option>
                <option value="Non-PTK">Non-PTK ({stats.nonPtk})</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Pembayaran</label>
              <select
                value={filterLunas}
                onChange={(e) => setFilterLunas(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
              >
                <option value="all">Semua</option>
                <option value="lunas">Lunas ({stats.lunas})</option>
                <option value="belum">Belum Lunas ({stats.belumLunas})</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Baris per Halaman</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
              >
                <option value={10}>10 baris</option>
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
                <option value={100}>100 baris</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-12">
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Pencarian</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                  placeholder="Cari berdasarkan NISN/Username, Nama, atau Jenjang…"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400"></div>
                <span>
                  Menampilkan <span className="font-bold text-slate-800">{filtered.length}</span> dari{" "}
                  <span className="font-bold text-slate-800">{effectiveRows.length}</span> data dimuat
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => reload(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:shadow-lg hover:from-slate-800 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Muat ulang dari awal"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Muat Ulang
            </button>
            <button
              type="button"
              onClick={loadMore}
              disabled={!hasMore || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Muat Lagi
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <DafulTable rows={filtered} loading={loading} />
      </div>
    </div>
  );
}
