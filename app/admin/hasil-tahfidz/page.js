"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
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

/* ========= Konstanta koleksi ========= */
const SCORES_COLLECTION = "tahfidz_scores";

/* ========= Util ========= */
function fmtDate(ts) {
  try {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return "-";
  }
}

export default function PageHasilTahfidz() {
  // kontrol UI
  const [pageSize, setPageSize] = useState(50); // default 50 seperti di halaman nilai
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // data & paging
  const [items, setItems] = useState([]);
  const [levels, setLevels] = useState(["ALL"]); // dropdown harus stabil (tidak menyusut)
  const [pageIndex, setPageIndex] = useState(0); // 0-based
  const [anchors, setAnchors] = useState([]);    // last doc per halaman
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const pageOptions = useMemo(() => [10, 25, 50], []);

  /* ===== Prefetch semua level sekali (agar dropdown tidak berkurang) ===== */
  async function prefetchLevels() {
    try {
      const colRef = collection(db, SCORES_COLLECTION);
      let qLv = query(colRef, orderBy("level", "asc"), limit(200));
      const setLv = new Set(["ALL"]);
      while (true) {
        const snap = await getDocs(qLv);
        if (snap.empty) break;
        snap.forEach((d) => {
          const lv = (d.data() || {}).level;
          if (lv) setLv.add(lv);
        });
        if (snap.size < 200) break;
        const last = snap.docs[snap.docs.length - 1];
        qLv = query(colRef, orderBy("level", "asc"), startAfter(last), limit(200));
      }
      setLevels(Array.from(setLv));
    } catch (e) {
      console.warn("prefetchLevels failed:", e?.message);
    }
  }

  // builder query untuk satu halaman
  function buildQuery(afterDoc = null) {
    const colRef = collection(db, SCORES_COLLECTION);
    const clauses = [];
    if (levelFilter !== "ALL") clauses.push(where("level", "==", levelFilter));
    // Urut terbaru dulu
    let qBase = query(colRef, ...clauses, orderBy("updatedAt", "desc"), limit(pageSize));
    if (afterDoc) qBase = query(colRef, ...clauses, orderBy("updatedAt", "desc"), startAfter(afterDoc), limit(pageSize));
    return qBase;
  }

  // ambil satu halaman (replace items), update anchor & hasNext
  async function fetchPage(targetPageIndex) {
    setLoading(true);
    setErrMsg("");
    try {
      const afterDoc = targetPageIndex === 0 ? null : anchors[targetPageIndex - 1] || null;
      const qBase = buildQuery(afterDoc);
      const snap = await getDocs(qBase);
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }));

      setItems(list);
      setPageIndex(targetPageIndex);
      setHasNext(list.length === pageSize);

      // simpan anchor halaman ini
      if (list.length > 0) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        setAnchors((prev) => {
          const clone = [...prev];
          clone[targetPageIndex] = lastDoc;
          return clone;
        });
      } else {
        // kosong → potong anchor ke depan
        setAnchors((prev) => prev.slice(0, targetPageIndex));
      }

      // union level dari halaman ini (kalau prefetch gagal, tetap stabil)
      const union = new Set(levels);
      list.forEach((r) => r.level && union.add(r.level));
      setLevels(Array.from(union));
    } catch (e) {
      console.error(e);
      setErrMsg("Gagal memuat data. Jika pakai filter level, buat index: level (Asc), updatedAt (Desc).");
      setItems([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  // mount
  useEffect(() => {
    prefetchLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset pagination saat filter/size berubah → kembali ke halaman 1
  useEffect(() => {
    setAnchors([]);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, pageSize]);

  // tombol pager
  function onNext() {
    if (!hasNext || loading) return;
    fetchPage(pageIndex + 1);
  }
  function onPrev() {
    if (pageIndex === 0 || loading) return;
    fetchPage(pageIndex - 1);
  }

  // pencarian lokal di halaman aktif (tidak ke Firestore)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const nisn = String(r.nisn || "").toLowerCase();
      const name = String(r.name || "").toLowerCase();
      return nisn.includes(q) || name.includes(q);
    });
  }, [items, search]);

  // ===== Export XLS (tanpa library) =====
  function exportXLS() {
    const cols = [
      "NISN",
      "Nama",
      "Level",
      "Skor",
      "Kesalahan Besar",
      "Kesalahan Kecil",
      "Jumlah Hafalan (ayat)",
      "Penguji",
      "Diupdate",
    ];
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const rows = filtered
      .map((r) => {
        const tds = [
          `<td style="mso-number-format:'\\@'">${esc(r.nisn || "")}</td>`,
          `<td>${esc(r.name || "")}</td>`,
          `<td>${esc(r.level || "")}</td>`,
          `<td>${esc(r.score ?? "")}</td>`,
          `<td>${esc(r.bigErrors ?? 0)}</td>`,
          `<td>${esc(r.smallErrors ?? 0)}</td>`,
          `<td>${esc(r.memorizedCount ?? 0)}</td>`,
          `<td>${esc(r.examinerName || "")}</td>`,
          `<td>${esc(fmtDate(r.updatedAt))}</td>`,
        ];
        return `<tr>${tds.join("")}</tr>`;
      })
      .join("");
    const headerRow = `<tr>${cols
      .map((c) => `<th style="background:#f1f5f9;text-align:left">${esc(c)}</th>`)
      .join("")}</tr>`;
    const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head>
<body>
  <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">
    ${headerRow}
    ${rows}
  </table>
</body>
</html>`.trim();
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `hasil-tahfidz-${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white"> 
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Hasil Ujian Al Qur&apos;an</h1>
          <div className="text-xs text-slate-600">
            Halaman: <b>{pageIndex + 1}</b> • Baris: <b>{filtered.length}</b> / {pageSize}
          </div>
        </div>
        
        {errMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errMsg}
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                {levels.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                {pageOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}/halaman
                  </option>
                ))}
              </select>

              <button
                onClick={() => fetchPage(0)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                Refresh
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NISN / Nama…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Aksi</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={exportXLS} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                Export ke XLS (tampilan saat ini)
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">File .xls berisi baris sesuai filter & pencarian aktif.</p>
          </div>
        </div>

        {/* Tabel Hasil */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">NISN</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Level</th>
                <th className="px-3 py-2 text-left">Skor</th>
                <th className="px-3 py-2 text-left">Kesalahan Besar</th>
                <th className="px-3 py-2 text-left">Kesalahan Kecil</th>
                <th className="px-3 py-2 text-left">Jumlah Hafalan (Juz)</th>
                <th className="px-3 py-2 text-left">Penguji</th>
                <th className="px-3 py-2 text-left">Diupdate</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-6">
                    <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id || r.nisn} className="border-t">
                    <td className="px-3 py-2 font-mono text-slate-900">{r.nisn}</td>
                    <td className="px-3 py-2 text-slate-900">{r.name}</td>
                    <td className="px-3 py-2 text-slate-800">{r.level || "-"}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{r.score ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-800">x {r.bigErrors ?? 0}</td>
                    <td className="px-3 py-2 text-slate-800">x {r.smallErrors ?? 0}</td>
                    <td className="px-3 py-2 text-slate-800">{r.memorizedCount ?? 0}</td>
                    <td className="px-3 py-2 text-slate-800">{r.examinerName || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-600" colSpan={9}>
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Halaman <b>{pageIndex + 1}</b>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onPrev}
              disabled={pageIndex === 0 || loading}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
            >
              ⟵ Kembali
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext || loading}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
            >
              Berikutnya ⟶
            </button>
          </div>
        </div>

        
      </main>
    </div>
  );
}
