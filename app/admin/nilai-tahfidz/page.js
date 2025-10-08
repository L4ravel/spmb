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
  doc,
  setDoc,
  serverTimestamp,
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
const USERS_COLLECTION = "users_app";
const SCORES_COLLECTION = "tahfidz_scores";

/* ========= Util ========= */
function getNisn(u) {
  return u.username || u.nisn || u.id || "";
}
function getName(u) {
  return u.fullName || u.fullname || u.displayName || u.name || "Tanpa Nama";
}

export default function PageNilaiTahfid() {
  const graderId = "ustadz001";

  // kontrol global
  const [pageSize, setPageSize] = useState(50);
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [deductBig, setDeductBig] = useState(5);
  const [deductSmall, setDeductSmall] = useState(2);
  const [examinerName, setExaminerName] = useState("");

  // data & paging
  const [items, setItems] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [anchors, setAnchors] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState(["ALL"]);
  const [errMsg, setErrMsg] = useState("");

  // state skor lokal per siswa
  const [rowsState, setRowsState] = useState({});
  const [saving, setSaving] = useState({});

  const pageOptions = useMemo(() => [10, 25, 50], []);

  /* ===== Persist nama penguji ===== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem("tahfidz_examiner_name");
    if (v) setExaminerName(v);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("tahfidz_examiner_name", examinerName || "");
  }, [examinerName]);

  /* ===== Prefetch semua jenjang (sekali) ===== */
  async function loadLevels() {
    try {
      const colRef = collection(db, USERS_COLLECTION);
      let qLevels = query(
        colRef,
        where("role", "==", "siswa"),
        where("registrationPaymentStatus", "==", "verified"),
        orderBy("registrationLevel", "asc"),
        limit(200)
      );
      let last = null;
      const lvlSet = new Set(["ALL"]);
      while (true) {
        const snap = await getDocs(qLevels);
        if (snap.empty) break;
        snap.forEach((d) => {
          const lv = (d.data() || {}).registrationLevel;
          if (lv) lvlSet.add(lv);
        });
        if (snap.size < 200) break;
        last = snap.docs[snap.docs.length - 1];
        qLevels = query(
          colRef,
          where("role", "==", "siswa"),
          where("registrationPaymentStatus", "==", "verified"),
          orderBy("registrationLevel", "asc"),
          startAfter(last),
          limit(200)
        );
      }
      setLevels(Array.from(lvlSet));
    } catch (e) {
      console.warn("loadLevels failed:", e?.message);
    }
  }

  // Query builder untuk halaman tertentu
  function buildQuery(afterDoc = null) {
    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [
      where("role", "==", "siswa"),
      where("registrationPaymentStatus", "==", "verified")
    ];
    if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));
    let qBase = query(colRef, ...clauses, orderBy("username", "asc"), limit(pageSize));
    if (afterDoc) qBase = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(afterDoc), limit(pageSize));
    return qBase;
  }

  // Fetch satu halaman
  async function fetchPage(targetPageIndex) {
    setLoading(true);
    setErrMsg("");
    try {
      const afterDoc = targetPageIndex === 0 ? null : anchors[targetPageIndex - 1] || null;
      const qBase = buildQuery(afterDoc);
      const snap = await getDocs(qBase);

      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }));

      // seed state baris (skor default 100)
      setRowsState((prev) => {
        const next = { ...prev };
        list.forEach((u) => {
          const nisn = getNisn(u);
          if (!next[nisn]) next[nisn] = { score: 100, bigErrors: 0, smallErrors: 0, memorizedCount: 0, recommendation: "" };
        });
        return next;
      });

      setItems(list);
      setPageIndex(targetPageIndex);
      setHasNext(list.length === pageSize);

      if (list.length > 0) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        setAnchors((prev) => {
          const clone = [...prev];
          clone[targetPageIndex] = lastDoc;
          return clone;
        });
      } else {
        setAnchors((prev) => prev.slice(0, targetPageIndex));
      }

      const union = new Set(levels);
      list.forEach((u) => u.registrationLevel && union.add(u.registrationLevel));
      setLevels(Array.from(union));
    } catch (e) {
      console.error(e);
      setErrMsg(
        "Gagal memuat data siswa. Pastikan rules & index: (role, registrationPaymentStatus, username) serta (role, registrationPaymentStatus, registrationLevel, username)."
      );
      setItems([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAnchors([]);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, pageSize]);

  function onNext() {
    if (!hasNext) return;
    fetchPage(pageIndex + 1);
  }
  function onPrev() {
    if (pageIndex === 0) return;
    fetchPage(pageIndex - 1);
  }

  function incErr(nisn, type) {
    setRowsState((prev) => {
      const row = prev[nisn] || { score: 100, bigErrors: 0, smallErrors: 0, memorizedCount: 0, recommendation: "" };
      const delta = type === "big" ? Number(deductBig || 0) : Number(deductSmall || 0);
      const nextScore = Math.max(0, Number(row.score || 0) - delta);
      return {
        ...prev,
        [nisn]: {
          ...row,
          score: nextScore,
          bigErrors: row.bigErrors + (type === "big" ? 1 : 0),
          smallErrors: row.smallErrors + (type === "small" ? 1 : 0),
        },
      };
    });
  }

  function setField(nisn, key, val) {
    setRowsState((prev) => {
      const row = prev[nisn] || { score: 100, bigErrors: 0, smallErrors: 0, memorizedCount: 0, recommendation: "" };
      return { ...prev, [nisn]: { ...row, [key]: val } };
    });
  }

  async function saveRow(u) {
    const nisn = getNisn(u);
    try {
      if (!examinerName.trim()) {
        alert("Isi nama penguji terlebih dahulu.");
        return;
      }
      const s = rowsState[nisn] || { score: 100, bigErrors: 0, smallErrors: 0, memorizedCount: 0, recommendation: "" };

      if (!s.recommendation) {
        alert("Pilih rekomendasi (Lulus/Tidak Lulus) terlebih dahulu.");
        return;
      }

      setSaving((sv) => ({ ...sv, [nisn]: "saving" }));
      const ref = doc(db, SCORES_COLLECTION, String(nisn));
      await setDoc(
        ref,
        {
          nisn,
          name: getName(u),
          level: u.registrationLevel || "-",
          score: Number(s.score || 0),
          bigErrors: Number(s.bigErrors || 0),
          smallErrors: Number(s.smallErrors || 0),
          memorizedCount: Number(s.memorizedCount || 0),
          recommendation: s.recommendation,
          examinerName: examinerName.trim(),
          gradedBy: graderId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaving((s0) => ({ ...s0, [nisn]: "saved" }));
      setTimeout(() => setSaving((s1) => ({ ...s1, [nisn]: "" })), 1200);
    } catch (e) {
      console.error(e);
      setSaving((s0) => ({ ...s0, [nisn]: "error" }));
      setTimeout(() => setSaving((s1) => ({ ...s1, [nisn]: "" })), 1500);
      alert("Gagal menyimpan nilai.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const nisn = String(getNisn(u)).toLowerCase();
      const nm = String(getName(u)).toLowerCase();
      return nisn.includes(q) || nm.includes(q);
    });
  }, [items, search]);

  return (
    <div className="min-h-screen flex flex-col bg-white">     

      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        {/* Header + meta */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Penilaian Al-Qur&apos;an</h1>
          <div className="text-xs sm:text-sm text-slate-600">
            Halaman: <b>{pageIndex + 1}</b> • Baris: <b>{filtered.length}</b> / {pageSize}
          </div>
        </div>

        {errMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errMsg}
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {/* Filter & Search */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
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
                title="Muat ulang halaman pertama"
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

          {/* Konfigurasi Pengurangan Poin */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-sm font-semibold text-slate-900">Konfigurasi Pengurangan Poin</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-700">Kesalahan Besar (−)</span>
                <input
                  type="number"
                  min={0}
                  value={deductBig}
                  onChange={(e) => setDeductBig(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-700">Kesalahan Kecil (−)</span>
                <input
                  type="number"
                  min={0}
                  value={deductSmall}
                  onChange={(e) => setDeductSmall(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                />
              </label>
            </div>
            
          </div>

          {/* Identitas Penguji */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-sm font-semibold text-slate-900">Identitas Penguji</div>
            <label className="mt-3 block text-sm">
              <span className="text-slate-700">Nama Penguji</span>
              <input
                value={examinerName}
                onChange={(e) => setExaminerName(e.target.value)}
                placeholder="cth: Ust. Ahmad / Ustd. Fatimah"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </label>
         
          </div>
        </div>

        {/* ======= View: Mobile Cards (<md) ======= */}
        <div className="mt-4 space-y-3 md:hidden">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-6 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-3 h-20 w-full animate-pulse rounded bg-slate-100" />
            </div>
          )}
          {!loading &&
            filtered.map((u, idx) => {
              const nisn = getNisn(u);
              const nm = getName(u);
              const state =
                rowsState[nisn] || { score: 100, bigErrors: 0, smallErrors: 0, memorizedCount: 0, recommendation: "" };
              const absoluteNo = pageIndex * pageSize + (idx + 1);
              const savingState = saving[nisn] || "";

              return (
                <div
                  key={nisn || u.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">No {absoluteNo}</div>
                      <div className="mt-0.5 font-semibold text-slate-900">{nm}</div>
                      <div className="font-mono text-sm text-slate-800">{nisn}</div>
                      <div className="text-xs text-slate-600">Level: {u.registrationLevel || "-"}</div>
                    </div>
                    <button
                      onClick={() => saveRow(u)}
                      className="shrink-0 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      {savingState === "saving"
                        ? "Menyimpan…"
                        : savingState === "saved"
                        ? "Tersimpan ✓"
                        : savingState === "error"
                        ? "Gagal!"
                        : "Simpan"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      <span className="block text-slate-700">Skor</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={state.score}
                        onChange={(e) => setField(nisn, "score", Number(e.target.value || 0))}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                      />
                    </label>

                    <label className="text-xs">
                      <span className="block text-slate-700">Hafalan (Juz)</span>
                      <input
                        type="number"
                        min={0}
                        value={state.memorizedCount}
                        onChange={(e) => setField(nisn, "memorizedCount", Number(e.target.value || 0))}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        placeholder="contoh: 20"
                      />
                    </label>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => incErr(nisn, "big")}
                      aria-label={`Kurangi ${deductBig} poin (kesalahan besar)`}
                      className="inline-flex h-9 items-center justify-center rounded bg-rose-600 px-3 text-base font-semibold text-white active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      title={`Kurangi ${deductBig} poin`}
                    >
                      −{deductBig}
                    </button>

                    <button
                      onClick={() => incErr(nisn, "small")}
                      aria-label={`Kurangi ${deductSmall} poin (kesalahan kecil)`}
                      className="inline-flex h-9 items-center justify-center rounded bg-amber-500 px-3 text-base font-semibold text-white active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      title={`Kurangi ${deductSmall} poin`}
                    >
                      −{deductSmall}
                    </button>
                  </div>

                  <label className="mt-3 block text-xs">
                    <span className="text-slate-700">Rekomendasi</span>
                    <select
                      value={state.recommendation}
                      onChange={(e) => setField(nisn, "recommendation", e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                    >
                      <option value="">Pilih...</option>
                      <option value="LULUS">Lulus</option>
                      <option value="TIDAK_LULUS">Tidak Lulus</option>
                    </select>
                  </label>
                </div>
              );
            })}
          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-600">
              Tidak ada data siswa.
            </div>
          )}
        </div>

        {/* ======= View: Desktop Table (md+) ======= */}
        <div className="mt-4 hidden md:block">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left w-12">No</th>
                <th className="px-3 py-2 text-left w-28">NISN</th>
                <th className="px-3 py-2 text-left ">Nama</th>
                <th className="px-3 py-2 text-left">Level</th>
                <th className="px-3 py-2 text-left w-28">Skor</th>
                <th className="px-3 py-2 text-left w-28">Jumlah Hafalan (Juz)</th>
                <th className="px-3 py-2 text-left w-28">Kesalahan Besar</th>
                <th className="px-3 py-2 text-left w-28">Kesalahan Kecil</th>
                <th className="px-3 py-2 text-left w-28">Rekomendasi</th>
                <th className="px-3 py-2 text-left w-28">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6">
                      <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((u, idx) => {
                    const nisn = getNisn(u);
                    const nm = getName(u);
                    const state =
                      rowsState[nisn] || { score: 100, bigErrors: 0, smallErrors: 0, memorizedCount: 0, recommendation: "" };
                    const absoluteNo = pageIndex * pageSize + (idx + 1);
                    const savingState = saving[nisn] || "";

                    return (
                      <tr key={nisn || u.id} className="border-t">
                        <td className="px-3 py-2 text-slate-800">{absoluteNo}</td>
                        <td className="px-3 py-2 font-mono text-slate-900">{nisn}</td>
                        <td className="px-3 py-2 text-slate-900">{nm}</td>
                        <td className="px-3 py-2 text-slate-800 w-40">{u.registrationLevel || "-"}</td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={state.score}
                            onChange={(e) => setField(nisn, "score", Number(e.target.value || 0))}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-slate-900"
                          />
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={state.memorizedCount}
                            onChange={(e) => setField(nisn, "memorizedCount", Number(e.target.value || 0))}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-slate-900"
                            placeholder="contoh: 20"
                          />
                        </td>

                        <td className="px-3 py-2 text-left">
                          <button
                            onClick={() => incErr(nisn, "big")}
                            aria-label={`Kurangi ${deductBig} poin (kesalahan besar)`}
                            className="inline-flex h-7 min-w-[60px] items-center justify-center rounded
                                    bg-rose-600 px-6 text-xl font-semibold text-white shadow-sm
                                    active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-400"
                            title={`Kurangi ${deductBig} poin`}
                          >
                            −{deductBig}
                          </button>
                        </td>

                        <td className="px-3 py-2 text-left">
                          <button
                            onClick={() => incErr(nisn, "small")}
                            aria-label={`Kurangi ${deductSmall} poin (kesalahan kecil)`}
                            className="inline-flex h-7 min-w-[60px] items-center justify-center rounded
                                    bg-amber-500 px-6 text-xl font-semibold text-white shadow-sm
                                    active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            title={`Kurangi ${deductSmall} poin`}
                          >
                            −{deductSmall}
                          </button>
                        </td>

                        <td className="px-3 py-2">
                          <select
                            value={state.recommendation}
                            onChange={(e) => setField(nisn, "recommendation", e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-slate-900"
                          >
                            <option value="">Pilih...</option>
                            <option value="LULUS">Lulus</option>
                            <option value="TIDAK_LULUS">Tidak Lulus</option>
                          </select>
                        </td>

                        <td className="px-3 py-2">
                          <button
                            onClick={() => saveRow(u)}
                            className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
                          >
                            {savingState === "saving"
                              ? "Menyimpan…"
                              : savingState === "saved"
                              ? "Tersimpan ✓"
                              : savingState === "error"
                              ? "Gagal!"
                              : "Simpan"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-600" colSpan={10}>
                      Tidak ada data siswa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pager */}
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
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