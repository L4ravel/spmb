"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection, doc, getDocs, getCountFromServer, limit,
  orderBy, query, startAfter, where
} from "firebase/firestore";

/* ===== Komponen modular dari file kamu ===== */
import Header from "./Header";
import Footer from "./Footer";
import HeroSection from "./HeroSection";

/* ====== Helpers ====== */
function classNames(...a) { return a.filter(Boolean).join(" "); }

export default function UjianPublikPage() {
  /* ——— UI state ——— */
  const [pageSize, setPageSize] = useState(25);
  const [filterAllowed, setFilterAllowed] = useState("all");  // all | true | false
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [error, setError] = useState("");

  const lastDocRef = useRef(null);
  const [hasMore, setHasMore] = useState(false);

  /* ——— Hitung total ——— */
  async function refreshTotal() {
    try {
      const coll = collection(db, "users_app");
      const snap = await getCountFromServer(query(coll));
      setTotal(snap.data().count);
    } catch {
      setTotal(null);
    }
  }

  /* ——— Query builder ——— */
  function buildQuery({ after } = {}) {
    const coll = collection(db, "users_app");
    const constraints = [];

    if (filterAllowed === "true") constraints.push(where("examAllowed", "==", true));
    if (filterAllowed === "false") constraints.push(where("examAllowed", "==", false));

    const s = search.trim();
    if (s) {
      constraints.push(where("username", ">=", s));
      constraints.push(where("username", "<=", s + "\uf8ff"));
    }

    constraints.push(orderBy("username"));
    constraints.push(limit(pageSize));
    if (after) constraints.push(startAfter(after));
    return query(coll, ...constraints);
  }

  /* ——— Load page ——— */
  async function loadFirstPage() {
    setLoading(true); setError(""); setRows([]);
    lastDocRef.current = null;
    try {
      const q = buildQuery();
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data(), _ref: d }));
      setRows(items);
      setHasMore(snap.docs.length === pageSize);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
    } catch (e) {
      console.error(e);
      setError("Gagal memuat data. Periksa rules/indeks Firestore.");
    } finally {
      setLoading(false);
    }
  }

  async function loadNextPage() {
    if (!hasMore || !lastDocRef.current) return;
    setLoading(true); setError("");
    try {
      const q = buildQuery({ after: lastDocRef.current });
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data(), _ref: d }));
      setRows(prev => [...prev, ...items]);
      setHasMore(snap.docs.length === pageSize);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
    } catch (e) {
      console.error(e);
      setError("Gagal memuat halaman berikutnya.");
    } finally {
      setLoading(false);
    }
  }

  // refresh saat filter/search/pageSize berubah
  useEffect(() => {
    loadFirstPage();
    refreshTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAllowed, search, pageSize]);

  /* ====== Render ====== */
  return (
    <div className="min-h-screen bg-white">
      <Header name="Publik" />

      {/* Section dari file kamu */}
      <HeroSection />

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daftar Peserta Ujian</h1>
            <p className="text-sm text-slate-600 mt-1">
              Tampilan publik (read-only). Total user{total !== null ? `: ${total}` : ""}.
            </p>
          </div>
        </div>

        {/* Filter bar ringkas */}
        <div className="mt-4 flex flex-wrap gap-2 items-center text-black">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={filterAllowed}
            onChange={(e) => setFilterAllowed(e.target.value)}
            title="Filter akses"
          >
            <option value="all">Semua</option>
            <option value="true">Boleh</option>
            <option value="false">Belum</option>
          </select>

          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Cari username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
            title="Baris per halaman"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        {/* Table (read-only) */}
        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
  <table className="w-full text-sm">
    <thead className="bg-slate-100">
      <tr className="text-left text-slate-700 font-semibold">
        <th className="p-3">Username</th>
        <th className="p-3">Akses</th>
        <th className="p-3">Paket</th>
        <th className="p-3">Mapel</th>
        <th className="p-3">Role</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.id} className="border-t text-slate-800">
          <td className="p-3 font-medium">{r.username || r.id}</td>
          <td className="p-3">
            <span
              className={classNames(
                "inline-flex items-center rounded-full px-2 py-0.5 border text-xs font-medium",
                r.examAllowed
                  ? "bg-green-100 border-green-300 text-green-800"
                  : "bg-amber-100 border-amber-300 text-amber-800"
              )}
            >
              {r.examAllowed ? "Boleh" : "Belum"}
            </span>
          </td>
          <td className="p-3">{r.examPaketId || "-"}</td>
          <td className="p-3">{r.examMapel || "-"}</td>
          <td className="p-3">{r.role || "-"}</td>
        </tr>
      ))}
      {!rows.length && !loading && (
        <tr>
          <td colSpan={5} className="p-6 text-center text-slate-600">
            Tidak ada data.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>

        {/* Footer controls */}
        <div className="mt-4 flex items-center justify-between gap-3 text-black">
          <div className="text-sm text-slate-600">
            Menampilkan <b>{rows.length}</b> baris
            {search ? " (hasil pencarian)" : ""}
            {typeof total === "number" ? <> • Total: <b>{total}</b></> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadNextPage}
              disabled={!hasMore || loading}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Memuat…" : hasMore ? "Muat Lagi" : "Habis"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
