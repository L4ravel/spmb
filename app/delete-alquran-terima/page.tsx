"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore, collection, getDocs, query, where, orderBy, limit, startAfter,
  updateDoc, doc, serverTimestamp,
} from "firebase/firestore";

// ===== Firebase init =====
function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}
const app = getFirebaseApp();
const db = getFirestore(app);

// ===== Types =====
type TDoc = {
  id: string;
  nisn: string;
  name: string;
  level: string;
  surah?: string;
  verseRange?: string;
  recordUrl?: string;
  status: "pending" | "lulus" | "perlu_bimbingan" | "ditolak";
  createdAt?: any;
  uploadedAt?: any;
  tajwidScore?: number;
  fluencyScore?: number;
  memorizationScore?: number;
  remarks?: string;
  gradedBy?: string;
  gradedAt?: any;
};

export default function PageAlquranAdmin() {
  // TODO: ganti dari auth admin kamu
  const adminId = "ustadz001";

  const [statusFilter, setStatusFilter] = useState<"all"|"pending"|"lulus"|"perlu_bimbingan"|"ditolak">("pending");
  const [pageSize, setPageSize] = useState(25);
  const [items, setItems] = useState<TDoc[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(reset=false) {
    try {
      setErr(null);
      setLoading(true);
      const col = collection(db, "alquran_tests");

      const clauses: any[] = [];
      if (statusFilter !== "all") clauses.push(where("status", "==", statusFilter));
      // Pakai createdAt untuk ordering (irit index)
      let qBase = query(col, ...clauses, orderBy("createdAt", "desc"), limit(pageSize));
      if (!reset && cursor) {
        qBase = query(col, ...clauses, orderBy("createdAt", "desc"), startAfter(cursor), limit(pageSize));
      }
      const snap = await getDocs(qBase);

      const list: TDoc[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      if (reset) setItems(list);
      else setItems((prev) => [...prev, ...list]);

      setCursor(snap.docs[snap.docs.length - 1] || null);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [statusFilter, pageSize]);

  async function saveScore(row: TDoc) {
    try {
      setSavingId(row.id);
      const ref = doc(db, "alquran_tests", row.id);
      await updateDoc(ref, {
        tajwidScore: Number(row.tajwidScore || 0),
        fluencyScore: Number(row.fluencyScore || 0),
        memorizationScore: Number(row.memorizationScore || 0),
        remarks: row.remarks || "",
        status: row.status,
        gradedBy: adminId,
        gradedAt: serverTimestamp(),
      });
    } catch (e: any) {
      alert(e?.message || "Gagal menyimpan nilai");
    } finally {
      setSavingId(null);
    }
  }

  function setField(id: string, key: keyof TDoc, value: any) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [key]: value } : it));
  }

  const pageOptions = useMemo(() => [10, 25, 50], []);

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Panel Penilaian Tes Al-Qur’an</h1>

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="pending">Pending</option>
          <option value="lulus">Lulus</option>
          <option value="perlu_bimbingan">Perlu Bimbingan</option>
          <option value="ditolak">Ditolak</option>
          <option value="all">Semua</option>
        </select>

        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {pageOptions.map((n) => <option key={n} value={n}>{n}/halaman</option>)}
        </select>

        <button
          onClick={() => load(true)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Refresh
        </button>
        <button
          onClick={() => load(false)}
          disabled={!cursor || loading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Muat Lagi
        </button>

        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>

      {/* Tabel */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[800px] w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="px-3 py-2 text-left">Siswa</th>
              <th className="px-3 py-2 text-left">Surah/Ayat</th>
              <th className="px-3 py-2 text-left">Audio</th>
              <th className="px-3 py-2 text-left">Tajwid</th>
              <th className="px-3 py-2 text-left">Kelancaran</th>
              <th className="px-3 py-2 text-left">Hafalan</th>
              <th className="px-3 py-2 text-left">Catatan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{it.name}</div>
                  <div className="text-xs text-slate-500">{it.nisn} • {it.level}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{it.surah || "-"}</div>
                  <div className="text-xs text-slate-500">{it.verseRange || "-"}</div>
                </td>
                <td className="px-3 py-2">
                  {it.recordUrl ? (
                    <audio controls src={it.recordUrl} className="w-52" />
                  ) : (
                    <span className="text-xs text-amber-600">Belum ada file</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} max={100}
                    value={it.tajwidScore ?? ""}
                    onChange={(e) => setField(it.id, "tajwidScore", e.target.value === "" ? undefined : Number(e.target.value))}
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} max={100}
                    value={it.fluencyScore ?? ""}
                    onChange={(e) => setField(it.id, "fluencyScore", e.target.value === "" ? undefined : Number(e.target.value))}
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} max={100}
                    value={it.memorizationScore ?? ""}
                    onChange={(e) => setField(it.id, "memorizationScore", e.target.value === "" ? undefined : Number(e.target.value))}
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={it.remarks ?? ""}
                    onChange={(e) => setField(it.id, "remarks", e.target.value)}
                    className="w-56 rounded border border-slate-300 px-2 py-1"
                    placeholder="Catatan singkat…"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={it.status}
                    onChange={(e) => setField(it.id, "status", e.target.value as any)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="lulus">Lulus</option>
                    <option value="perlu_bimbingan">Perlu Bimbingan</option>
                    <option value="ditolak">Ditolak</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => saveScore(it)}
                    disabled={savingId === it.id}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
                  >
                    {savingId === it.id ? "Menyimpan…" : "Simpan"}
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && !loading && (
              <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={9}>Tidak ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
