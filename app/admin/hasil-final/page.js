"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";

/* ========= Konstanta ========= */
const USERS_COLLECTION = "users_app";
const TAHFIDZ_COLL     = "tahfidz_scores";
const INTERVIEW_COLL   = "interview_scores";
const PAGE_SIZE        = 50;
const EXPORT_BATCH     = 500;

// Terima beberapa varian huruf untuk "verified"
const VERIFIED_VARIANTS = ["verified", "Verified", "VERIFIED"];

/* ========= Util ========= */
const getIdOr = (u) => u?.username || u?.nisn || u?.id || "";
const getName = (u) =>
  u?.fullName || u?.fullname || u?.displayName || u?.name || "Tanpa Nama";
const getLevel = (u) => u?.registrationLevel || "-";
const sortLevels = (arr) => ["ALL", ...arr.filter(x => x !== "ALL").sort((a,b)=>String(a).localeCompare(String(b)))];

// === Rata-rata ketat: (akademik + tahfidz + wawancara) / 3; kosong dihitung 0 ===
function strictAvg(a, b, c) {
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const sum = toNum(a) + toNum(b) + toNum(c);
  return Math.round((sum / 3) * 10) / 10; // 1 desimal
}

const RecBadge = ({ rec }) => {
  const R = String(rec || "").toUpperCase();
  const cls =
    R === "LULUS"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : R === "TIDAK_LULUS"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-slate-50 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {R || "-"}
    </span>
  );
};

export default function HasilFinalPage() {
  /* ------ Filter ------ */
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | LENGKAP
  const [rankDirection, setRankDirection] = useState("DESC");
  const [levels, setLevels] = useState(["ALL"]);

  /* ------ Data & Paging ------ */
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [anchors, setAnchors]     = useState([]);
  const [hasNext, setHasNext]     = useState(false);

  /* ------ Modal ------ */
  const [open, setOpen]     = useState(false);
  const [detail, setDetail] = useState(null);

  /* ------ Download Excel ------ */
  const [downloading, setDownloading] = useState(false);

  /* ===== Ambil daftar jenjang ===== */
  useEffect(() => {
    (async () => {
      const setLv = new Set(["ALL"]);
      try {
        // users_app
        {
          const colRef = collection(db, USERS_COLLECTION);
          let qLv = query(colRef, orderBy(documentId()), limit(200));
          while (true) {
            const snap = await getDocs(qLv);
            if (snap.empty) break;
            snap.forEach((d) => d.data()?.registrationLevel && setLv.add(d.data().registrationLevel));
            if (snap.size < 200) break;
            const last = snap.docs[snap.docs.length - 1];
            qLv = query(colRef, orderBy(documentId()), startAfter(last), limit(200));
          }
        }
        // interview_scores
        {
          const colRef = collection(db, INTERVIEW_COLL);
          let qLv = query(colRef, orderBy(documentId()), limit(200));
          while (true) {
            const snap = await getDocs(qLv);
            if (snap.empty) break;
            snap.forEach((d) => d.data()?.level && setLv.add(d.data().level));
            if (snap.size < 200) break;
            const last = snap.docs[snap.docs.length - 1];
            qLv = query(colRef, orderBy(documentId()), startAfter(last), limit(200));
          }
        }
        // tahfidz_scores
        {
          const colRef = collection(db, TAHFIDZ_COLL);
          const snap = await getDocs(query(colRef, orderBy(documentId()), limit(200)));
          snap.forEach((d) => d.data()?.level && setLv.add(d.data().level));
        }
      } finally {
        setLevels(sortLevels(Array.from(setLv)));
      }
    })();
  }, []);

  /* ===== Query users (verified + optional level) ===== */
  function buildUsersQuery(afterDoc = null) {
    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [where("registrationPaymentStatus", "in", VERIFIED_VARIANTS)];
    if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));
    let qBase = query(colRef, ...clauses, orderBy(documentId()), limit(PAGE_SIZE));
    if (afterDoc) qBase = query(colRef, ...clauses, orderBy(documentId()), startAfter(afterDoc), limit(PAGE_SIZE));
    return qBase;
  }

  /* ===== Ambil 1 halaman + merge nilai + urut peringkat ===== */
  async function fetchPage(targetIndex) {
    setLoading(true); setErrMsg("");
    try {
      const afterDoc = targetIndex === 0 ? null : anchors[targetIndex - 1] || null;
      const snap = await getDocs(buildUsersQuery(afterDoc));

      const users = [];
      snap.forEach((d) => users.push({ id: d.id, ...(d.data() || {}) }));
      setHasNext(users.length === PAGE_SIZE);
      if (users.length > 0) {
        const last = snap.docs[snap.docs.length - 1];
        setAnchors((prev) => { const c = [...prev]; c[targetIndex] = last; return c; });
      }

      const merged = await Promise.all(
        users.map(async (u, i) => {
          const nisn = getIdOr(u) || u.id;
          const [tahfDoc, ivDoc] = await Promise.all([
            getDoc(doc(db, TAHFIDZ_COLL, String(nisn))),
            getDoc(doc(db, INTERVIEW_COLL, String(nisn))),
          ]);

          // Akademik
          let akademik = null;
          if (typeof u.examScorePercent === "number") akademik = u.examScorePercent;
          else if (typeof u.examScoreBenar === "number" && typeof u.examScoreTotal === "number") {
            const b = Number(u.examScoreBenar || 0), t = Number(u.examScoreTotal || 0);
            akademik = t ? Math.round((b / t) * 1000) / 10 : null;
          }

          // Tahfidz
          const tData = tahfDoc.exists() ? tahfDoc.data() : null;
          const tahfidz = tData?.score ?? null;
          const tahfidzExaminer = tData?.examinerName || tData?.penguji || null;
          const tahfidzRecommendation = tData?.recommendation || null;
          const memorizedCount = tData?.memorizedCount ?? null;

          // Wawancara
          const wData = ivDoc.exists() ? ivDoc.data() : null;
          const wawancara = wData?.total100 ?? null;
          const wawancaraExaminer = wData?.examinerName || null;

          // === total jadi rata-rata ketat (dibagi 3) ===
          const total = strictAvg(akademik, tahfidz, wawancara);
          const complete = akademik != null && tahfidz != null && wawancara != null;

          return {
            no: targetIndex * PAGE_SIZE + (i + 1),
            nisn,
            name: getName(u),
            level: getLevel(u),
            akademik,
            tahfidz,
            memorizedCount,
            tahfidzExaminer,
            tahfidzRecommendation,
            wawancara,
            wawancaraExaminer,
            total,
            complete,
          };
        })
      );

      // Filter “LENGKAP”
      const filtered = statusFilter === "LENGKAP" ? merged.filter((r) => r.complete) : merged;

      // Urut peringkat
      const sorted = filtered.sort((a, b) => {
        const diff =
          ((b.total ?? -1) - (a.total ?? -1)) ||
          ((b.wawancara ?? -1) - (a.wawancara ?? -1)) ||
          ((b.tahfidz ?? -1) - (a.tahfidz ?? -1)) ||
          ((b.akademik ?? -1) - (a.akademik ?? -1)) ||
          String(a.nisn).localeCompare(String(b.nisn));
        return rankDirection === "DESC" ? diff : -diff;
      });

      const totalCount = sorted.length;
      const ranked = sorted.map((r, idx) => ({
        ...r,
        rank: rankDirection === "DESC" ? (idx + 1) : (totalCount - idx),
      }));

      setRows(ranked);

      // Union levels
      if (ranked.length) {
        const union = new Set(levels);
        ranked.forEach((r) => r.level && union.add(r.level));
        setLevels(sortLevels(Array.from(union)));
      }

      setPageIndex(targetIndex);
    } catch (e) {
      console.error(e);
      setErrMsg(
        "Gagal memuat hasil final. Cek index komposit untuk (registrationPaymentStatus in [...]) + orderBy(documentId())."
      );
      setRows([]); setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAnchors([]); fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, statusFilter, rankDirection]);

  const onPrev = () => { if (pageIndex > 0 && !loading) fetchPage(pageIndex - 1); };
  const onNext = () => { if (hasNext && !loading) fetchPage(pageIndex + 1); };

  /* ===== Download Excel (pakai strictAvg juga) ===== */
  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const xlsx = await import("xlsx");

      // 1) Kumpulkan SEMUA user verified sesuai jenjang (ALL=semua)
      const users = [];
      const colRef = collection(db, USERS_COLLECTION);
      const baseClauses = [where("registrationPaymentStatus", "in", VERIFIED_VARIANTS)];
      if (levelFilter !== "ALL") baseClauses.push(where("registrationLevel", "==", levelFilter));

      let qRef = query(colRef, ...baseClauses, orderBy(documentId()), limit(EXPORT_BATCH));
      while (true) {
        const snap = await getDocs(qRef);
        if (snap.empty) break;
        snap.forEach((d) => users.push({ id: d.id, ...(d.data() || {}) }));
        if (snap.size < EXPORT_BATCH) break;
        const last = snap.docs[snap.docs.length - 1];
        qRef = query(colRef, ...baseClauses, orderBy(documentId()), startAfter(last), limit(EXPORT_BATCH));
      }

      // 2) Join nilai + Wali WA
      const allData = await Promise.all(
        users.map(async (u) => {
          const nisn = getIdOr(u) || u.id;
          const [tahfDoc, ivDoc, ppdbDoc] = await Promise.all([
            getDoc(doc(db, TAHFIDZ_COLL, String(nisn))),
            getDoc(doc(db, INTERVIEW_COLL, String(nisn))),
            getDoc(doc(db, "ppdb", String(nisn))),
          ]);

          let akademik = null;
          if (typeof u.examScorePercent === "number") akademik = u.examScorePercent;
          else if (typeof u.examScoreBenar === "number" && typeof u.examScoreTotal === "number") {
            const b = Number(u.examScoreBenar || 0), t = Number(u.examScoreTotal || 0);
            akademik = t ? Math.round((b / t) * 1000) / 10 : null;
          }

          const tData = tahfDoc.exists() ? tahfDoc.data() : null;
          const wData = ivDoc.exists() ? ivDoc.data() : null;
          const pData = ppdbDoc.exists() ? ppdbDoc.data() : null;

          const tahfidz = tData?.score ?? null;
          const memorizedCount = tData?.memorizedCount ?? null;
          const tahfidzExaminer = tData?.examinerName || tData?.penguji || null;
          const tahfidzRecommendation = tData?.recommendation || null;

          const wawancara = wData?.total100 ?? null;
          const wawancaraExaminer = wData?.examinerName || null;

          const waliWa = pData?.waliWa ?? "";

          // === total rata-rata ketat ===
          const total = strictAvg(akademik, tahfidz, wawancara);
          const complete = akademik != null && tahfidz != null && wawancara != null;

          return {
            nisn,
            name: getName(u),
            level: getLevel(u),
            akademik,
            tahfidz,
            memorizedCount,
            tahfidzExaminer,
            tahfidzRecommendation,
            wawancara,
            wawancaraExaminer,
            waliWa,
            total,
            complete,
          };
        })
      );

      // 3) Filter + urut peringkat
      let filtered = statusFilter === "LENGKAP" ? allData.filter((r) => r.complete) : allData;
      filtered.sort((a, b) => {
        const diff =
          ((b.total ?? -1) - (a.total ?? -1)) ||
          ((b.wawancara ?? -1) - (a.wawancara ?? -1)) ||
          ((b.tahfidz ?? -1) - (a.tahfidz ?? -1)) ||
          ((b.akademik ?? -1) - (a.akademik ?? -1)) ||
          String(a.nisn).localeCompare(String(b.nisn));
        return rankDirection === "DESC" ? diff : -diff;
      });

      const totalCount = filtered.length;
      const ranked = filtered.map((r, idx) => ({
        ...r,
        rank: rankDirection === "DESC" ? (idx + 1) : (totalCount - idx),
      }));

      // 4) Bentuk sheet
      const XLSX = xlsx;
      const rows = ranked.map((r, i) => ({
        "No": i + 1,
        "NISN": r.nisn,
        "Nama": r.name,
        "Jenjang": r.level,
        "Akademik": r.akademik ?? "-",
        "Al Qur'an": r.tahfidz ?? "-",
        "Jumlah Hafalan (Juz)": r.memorizedCount ?? "-",
        "Rekomendasi Tahfidz": r.tahfidzRecommendation ?? "-",
        "Penguji Al Qur'an": r.tahfidzExaminer ?? "-",
        "Wawancara": r.wawancara ?? "-",
        "Penguji Wawancara": r.wawancaraExaminer ?? "-",
        "Wali WA": r.waliWa || "-",
        "Total (Rata-rata)": r.total?.toFixed?.(1) ?? r.total,
        "Peringkat": r.rank,
        "Status": r.complete ? "Lengkap" : "Belum Lengkap",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hasil Final");
      ws["!cols"] = [
        {wch:5},{wch:16},{wch:28},{wch:10},{wch:10},{wch:12},{wch:20},{wch:22},{wch:14},{wch:14},{wch:16},{wch:18},{wch:14},{wch:14}
      ];

      const ts = new Date().toISOString().split("T")[0];
      const suffixLv = levelFilter !== "ALL" ? `_${levelFilter}` : "";
      const suffixSt = statusFilter === "LENGKAP" ? "_Lengkap" : "";
      const suffixDir = rankDirection === "DESC" ? "_TopToBottom" : "_BottomToTop";
      XLSX.writeFile(wb, `Hasil_Final_Verified${suffixLv}${suffixSt}${suffixDir}_${ts}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hasil Tes Akademik, Al-Qur&apos;an & Wawancara</h1>
          <div className="text-xs text-slate-600">
            Halaman <b>{pageIndex + 1}</b> • Baris: <b>{rows.length}</b> / {PAGE_SIZE}
          </div>
        </div>

        {errMsg && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-sm">{errMsg}</div>
        )}

        {/* Toolbar */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <select value={levelFilter} onChange={(e)=>setLevelFilter(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100">
                {levels.map((lv)=>(<option key={lv} value={lv}>{lv}</option>))}
              </select>

              <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100">
                <option value="ALL">Semua Status</option>
                <option value="LENGKAP">Sudah lengkap (3 nilai)</option>
              </select>

              <select value={rankDirection} onChange={(e)=>setRankDirection(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
                title="Arah peringkat">
                <option value="DESC">Peringkat: Tertinggi → Terendah</option>
                <option value="ASC">Peringkat: Terendah → Tertinggi</option>
              </select>

              <button onClick={()=>{ setAnchors([]); fetchPage(0); }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
                🔄 Refresh
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
            >
              {downloading ? "Mengunduh..." : "📥 Download Excel (Semua Data)"}
            </button>
          </div>
        </div>

        {/* Tabel */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100/70">
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="text-slate-600">
                <tr className="border-b border-slate-200">
                  {[
                    ["No","w-14 text-left"],
                    ["NISN","text-left"],
                    ["Nama","text-left"],
                    ["Jenjang","text-left"],
                    ["Akademik","text-right"],
                    ["Al Qur'an","text-right"],
                    ["Jumlah Hafalan (Juz)","text-right"],
                    ["Rekomendasi Tahfidz","text-left"],
                    ["Wawancara","text-right"],
                    ["Rata-rata","text-right"],
                    ["Peringkat","text-center"],
                    ["Aksi","text-left w-28"],
                  ].map(([label, extra])=>(
                    <th key={label}
                      className={`sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 px-4 py-3 font-semibold ${extra}`}>
                      <div className="flex items-center gap-1">
                        <span>{label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8">
                      <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                    </td>
                  </tr>
                )}

                {!loading && rows.length > 0 && rows.map((r) => (
                  <tr
                    key={`${r.nisn}-${r.no}`}
                    className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3">{r.no}</td>
                    <td className="px-4 py-3 font-mono">{r.nisn}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3">{r.level}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.akademik ?? "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.tahfidz ?? "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.memorizedCount ?? "-"}</td>
                    <td className="px-4 py-3"><RecBadge rec={r.tahfidzRecommendation} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.wawancara ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.total?.toFixed?.(1) ?? r.total}</td>
                    <td className="px-4 py-3 text-center">{r.rank}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={()=>{ setDetail(r); setOpen(true); }}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 shadow-sm shadow-emerald-200 transition-all"
                        title="Lihat detail nilai"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-6 py-10 text-center">
                      <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2" />
                        </svg>
                      </div>
                      <p className="text-slate-600">Tidak ada data.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pager */}
        <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-600">Halaman</span>
            <span className="font-bold text-slate-800">{pageIndex + 1}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onPrev}
              disabled={pageIndex === 0 || loading}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
            >
              ⟵ Sebelumnya
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext || loading}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-slate-300"
            >
              Berikutnya ⟶
            </button>
          </div>
        </div>
      </main>

      {/* Modal Detail */}
      {open && detail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)} />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4">
            <div className="mt-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h3 className="text-base font-semibold">
                  {detail.name} – {detail.nisn}
                </h3>
                <button onClick={()=>setOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
                  Tutup
                </button>
              </div>

              <div className="px-5 py-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-slate-500">Jenjang:</span> <b>{detail.level}</b></div>
                  <div><span className="text-slate-500">Peringkat:</span> <b>{detail.rank}</b></div>
                </div>

                <div className="mt-3 space-y-3 text-black">
                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold mb-1">Al Qur&apos;an</div>
                    <div>Nilai: <b>{detail.tahfidz ?? "-"}</b></div>
                    <div>Jumlah Hafalan (Juz): <b>{detail.memorizedCount ?? "-"}</b></div>
                    <div className="mt-1">Rekomendasi: <RecBadge rec={detail.tahfidzRecommendation} /></div>
                    <div className="text-slate-600 mt-1">Penguji: <b>{detail.tahfidzExaminer ?? "-"}</b></div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold mb-1">Akademik</div>
                    <div>Nilai: <b>{detail.akademik ?? "-"}</b></div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold mb-1">Wawancara</div>
                    <div>Nilai: <b>{detail.wawancara ?? "-"}</b></div>
                    <div className="text-slate-600 mt-1">Penanya: <b>{detail.wawancaraExaminer ?? "-"}</b></div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold mb-1">Rata-rata</div>
                    <div className="text-slate-700">
                      <b>{detail.total?.toFixed?.(1) ?? detail.total}</b> / 100
                    </div>
                  </section>
                </div>
              </div>

              <div className="border-t px-5 py-4 text-right">
                <button onClick={()=>setOpen(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 active:scale-95 shadow-sm shadow-slate-300">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
