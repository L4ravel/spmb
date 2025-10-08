"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";

/* ========= Koleksi & Konstanta ========= */
const USERS_COLLECTION = "users_app";          // basis data siswa
const TAHFIDZ_COLL     = "tahfidz_scores";     // skor Al Qur&apos;an
const INTERVIEW_COLL   = "interview_scores";   // skor wawancara
const PAGE_SIZE        = 50;

/* ========= Util ========= */
const getNisn  = (u) => u?.username || u?.nisn || u?.id || "";
const getName  = (u) => u?.fullName || u?.fullname || u?.displayName || u?.name || "Tanpa Nama";
const getLevel = (u) => u?.registrationLevel || "-";
const sortLevels = (arr) => ["ALL", ...arr.filter(x => x !== "ALL").sort((a,b)=>String(a).localeCompare(String(b)))];

/** Badge rekomendasi */
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

/* ========= Komponen ========= */
export default function HasilFinalPage() {
  /* ------ Filter ------ */
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | LENGKAP
  const [sortMode, setSortMode]       = useState("RANKING"); // RANKING | NISN
  const [levels, setLevels]           = useState(["ALL"]);

  /* ------ Data & Paging ------ */
  const [rows, setRows]           = useState([]); // {no, nisn, name, level, akademik, tahfidz, tahfidzExaminer, tahfidzRecommendation, wawancara, total, rank, complete}
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [anchors, setAnchors]     = useState([]);
  const [hasNext, setHasNext]     = useState(false);

  /* ------ Modal Detail ------ */
  const [open, setOpen]     = useState(false);
  const [detail, setDetail] = useState(null);

  /* ------ Download Excel ------ */
  const [downloading, setDownloading] = useState(false);

  /* ===== Prefetch level (gabung dari users + scores) ===== */
  useEffect(() => {
    (async () => {
      const setLv = new Set(["ALL"]);
      try {
        // users_app
        {
          const colRef = collection(db, USERS_COLLECTION);
          let qLv = query(colRef, where("role", "==", "siswa"), limit(200));
          while (true) {
            const snap = await getDocs(qLv);
            if (snap.empty) break;
            snap.forEach((d) => d.data()?.registrationLevel && setLv.add(d.data().registrationLevel));
            if (snap.size < 200) break;
            const last = snap.docs[snap.docs.length - 1];
            qLv = query(colRef, where("role", "==", "siswa"), startAfter(last), limit(200));
          }
        }
        // interview_scores (level)
        {
          const colRef = collection(db, INTERVIEW_COLL);
          let qLv = query(colRef, orderBy("level", "asc"), limit(200));
          while (true) {
            const snap = await getDocs(qLv);
            if (snap.empty) break;
            snap.forEach((d) => d.data()?.level && setLv.add(d.data().level));
            if (snap.size < 200) break;
            const last = snap.docs[snap.docs.length - 1];
            qLv = query(colRef, orderBy("level", "asc"), startAfter(last), limit(200));
          }
        }
        // tahfidz_scores (level jika ada)
        {
          const colRef = collection(db, TAHFIDZ_COLL);
          let qLv = query(colRef, orderBy("level", "asc"), limit(200));
          try {
            while (true) {
              const snap = await getDocs(qLv);
              if (snap.empty) break;
              snap.forEach((d) => d.data()?.level && setLv.add(d.data().level));
              if (snap.size < 200) break;
              const last = snap.docs[snap.docs.length - 1];
              qLv = query(colRef, orderBy("level", "asc"), startAfter(last), limit(200));
            }
          } catch { /* kalau index belum ada, lewati */ }
        }
      } finally {
        setLevels(sortLevels(Array.from(setLv)));
      }
    })();
  }, [db]);

  /* ===== Query builder users (basis data siswa) ===== */
  function buildUsersQuery(afterDoc = null) {
    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [where("role", "==", "siswa")];
    if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));
    let qBase = query(colRef, ...clauses, orderBy("username", "asc"), limit(PAGE_SIZE));
    if (afterDoc) qBase = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(afterDoc), limit(PAGE_SIZE));
    return qBase;
  }

  /* ===== Ambil 1 halaman + merge nilai ===== */
  async function fetchPage(targetIndex) {
    setLoading(true); setErrMsg("");
    try {
      const afterDoc = targetIndex === 0 ? null : anchors[targetIndex - 1] || null;
      const qBase = buildUsersQuery(afterDoc);
      const snap = await getDocs(qBase);

      const users = [];
      snap.forEach((d) => users.push({ id: d.id, ...(d.data() || {}) }));
      setHasNext(users.length === PAGE_SIZE);
      if (users.length > 0) {
        const last = snap.docs[snap.docs.length - 1];
        setAnchors((prev) => {
          const c = [...prev]; c[targetIndex] = last; return c;
        });
      }

      // Prefetch skor tahfidz & wawancara sesuai nisn
      const merged = await Promise.all(
        users.map(async (u, i) => {
          const nisn = getNisn(u);
          const [tahfDoc, ivDoc] = await Promise.all([
            getDoc(doc(db, TAHFIDZ_COLL, String(nisn))),
            getDoc(doc(db, INTERVIEW_COLL, String(nisn))),
          ]);

          // Nilai Akademik
          let akademik = null;
          if (typeof u.examScorePercent === "number") akademik = u.examScorePercent;
          else if (typeof u.examScoreBenar === "number" && typeof u.examScoreTotal === "number") {
            const b = Number(u.examScoreBenar || 0), t = Number(u.examScoreTotal || 0);
            akademik = t ? Math.round((b / t) * 1000) / 10 : null;
          }

          // Tahfidz
          const tahfidzData          = tahfDoc.exists() ? tahfDoc.data() : null;
          const tahfidz              = tahfidzData?.score ?? null;
          const tahfidzExaminer      = tahfidzData?.examinerName || tahfidzData?.penguji || null;
          const tahfidzRecommendation = tahfidzData?.recommendation || null; // <-- ambil rekomendasi

          // Wawancara
          const wawData         = ivDoc.exists() ? ivDoc.data() : null;
          const wawancara       = wawData?.total100 ?? null;
          const wawancaraExaminer = wawData?.examinerName || null;

          const total    = (akademik ?? 0) + (tahfidz ?? 0) + (wawancara ?? 0);
          const complete = akademik != null && tahfidz != null && wawancara != null;

          return {
            no: pageIndex * PAGE_SIZE + (i + 1),
            nisn,
            name: getName(u),
            level: getLevel(u),
            akademik,
            tahfidz,
            tahfidzExaminer,
            tahfidzRecommendation,
            wawancara,
            wawancaraExaminer,
            total,
            complete,
          };
        })
      );

      // Filter "LENGKAP"
      const filtered = statusFilter === "LENGKAP" ? merged.filter(r => r.complete) : merged;

      // Urut
      let sorted = filtered.slice();
      if (sortMode === "RANKING") {
        sorted.sort((a,b) =>
          (b.total - a.total) ||
          ((b.wawancara ?? -1) - (a.wawancara ?? -1)) ||
          ((b.tahfidz ?? -1) - (a.tahfidz ?? -1)) ||
          ((b.akademik ?? -1) - (a.akademik ?? -1)) ||
          String(a.nisn).localeCompare(String(b.nisn))
        );
      } else {
        sorted.sort((a,b)=> String(a.nisn).localeCompare(String(b.nisn)));
      }

      // Peringkat (dalam halaman aktif)
      const withRank = sorted.map((r, idx) => ({ ...r, rank: sortMode === "RANKING" ? idx + 1 : "-" }));

      setRows(withRank);

      // Union levels
      if (withRank.length) {
        const union = new Set(levels);
        withRank.forEach((r) => r.level && union.add(r.level));
        setLevels(sortLevels(Array.from(union)));
      }

      setPageIndex(targetIndex);
    } catch (e) {
      console.error(e);
      setErrMsg("Gagal memuat hasil final. Pastikan index (role↑, username↑) tersedia.");
      setRows([]); setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  // load & reload saat filter berubah
  useEffect(() => {
    setAnchors([]); fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, statusFilter, sortMode]);

  const onPrev = () => { if (pageIndex > 0 && !loading) fetchPage(pageIndex - 1); };
  const onNext = () => { if (hasNext && !loading) fetchPage(pageIndex + 1); };
  const openDetail = (r) => { setDetail(r); setOpen(true); };

  /* ===== DOWNLOAD EXCEL (ikutkan rekomendasi tahfidz) ===== */
  const handleDownloadExcel = async () => {
  setDownloading(true);
  try {
    // import SEKALI
    const xlsx = await import("xlsx");

    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [where("role", "==", "siswa")];
    if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));
    const qAll = query(colRef, ...clauses, orderBy("username", "asc"));
    const snapAll = await getDocs(qAll);

    const allUsers = [];
    snapAll.forEach((d) => allUsers.push({ id: d.id, ...(d.data() || {}) }));

    const allData = await Promise.all(
      allUsers.map(async (u) => {
        const nisn = u?.username || u?.nisn || u?.id || "";
        const [tahfDoc, ivDoc] = await Promise.all([
          getDoc(doc(db, "tahfidz_scores", String(nisn))),
          getDoc(doc(db, "interview_scores", String(nisn))),
        ]);

        let akademik = null;
        if (typeof u.examScorePercent === "number") akademik = u.examScorePercent;
        else if (typeof u.examScoreBenar === "number" && typeof u.examScoreTotal === "number") {
          const b = Number(u.examScoreBenar || 0), t = Number(u.examScoreTotal || 0);
          akademik = t ? Math.round((b / t) * 1000) / 10 : null;
        }

        const tData = tahfDoc.exists() ? tahfDoc.data() : null;
        const tahfidz = tData?.score ?? null;
        const tahfidzExaminer = tData?.examinerName || tData?.penguji || null;
        const tahfidzRecommendation = tData?.recommendation || null;

        const wData = ivDoc.exists() ? ivDoc.data() : null;
        const wawancara = wData?.total100 ?? null;
        const wawancaraExaminer = wData?.examinerName || null;

        const total = (akademik ?? 0) + (tahfidz ?? 0) + (wawancara ?? 0);
        const complete = akademik != null && tahfidz != null && wawancara != null;

        return {
          nisn,
          name: u?.fullName || u?.fullname || u?.displayName || u?.name || "Tanpa Nama",
          level: u?.registrationLevel || "-",
          akademik,
          tahfidz,
          tahfidzExaminer,
          tahfidzRecommendation,
          wawancara,
          wawancaraExaminer,
          total,
          complete,
        };
      })
    );

    // filter & urut (tetap sama)
    let filtered = statusFilter === "LENGKAP" ? allData.filter(r => r.complete) : allData;
    if (sortMode === "RANKING") {
      filtered.sort((a,b) =>
        (b.total - a.total) ||
        ((b.wawancara ?? -1) - (a.wawancara ?? -1)) ||
        ((b.tahfidz ?? -1) - (a.tahfidz ?? -1)) ||
        ((b.akademik ?? -1) - (a.akademik ?? -1)) ||
        String(a.nisn).localeCompare(String(b.nisn))
      );
    } else {
      filtered.sort((a,b)=> String(a.nisn).localeCompare(String(b.nisn)));
    }
    const withRank = filtered.map((r, idx) => ({ ...r, rank: sortMode === "RANKING" ? idx + 1 : "-" }));

    // sheet
    const excelData = withRank.map((r, idx) => ({
      "No": idx + 1,
      "NISN": r.nisn,
      "Nama": r.name,
      "Jenjang": r.level,
      "Akademik": r.akademik ?? "-",
      "Al Qur&apos;an": r.tahfidz ?? "-",
      "Rekomendasi Tahfidz": r.tahfidzRecommendation ?? "-",
      "Penguji Al Qur&apos;an": r.tahfidzExaminer ?? "-",
      "Wawancara": r.wawancara ?? "-",
      "Penguji Wawancara": r.wawancaraExaminer ?? "-",
      "Total": r.total?.toFixed?.(1) ?? r.total,
      "Peringkat": r.rank,
      "Status": r.complete ? "Lengkap" : "Belum Lengkap",
    }));

    const ws = xlsx.utils.json_to_sheet(excelData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Hasil Final");
    ws["!cols"] = [{wch:5},{wch:15},{wch:28},{wch:10},{wch:10},{wch:12},{wch:20},{wch:20},{wch:10},{wch:20},{wch:10},{wch:12}];

    const ts = new Date().toISOString().split("T")[0];
    const levelSuffix = levelFilter !== "ALL" ? `_${levelFilter}` : "";
    const statusSuffix = statusFilter === "LENGKAP" ? "_Lengkap" : "";
    xlsx.writeFile(wb, `Hasil_Final${levelSuffix}${statusSuffix}_${ts}.xlsx`);
  } catch (error) {
    console.error("Error downloading Excel:", error);
    alert("Gagal mengunduh file Excel. Silakan coba lagi.");
  } finally {
    setDownloading(false);
  }
};

  return (
    <div className="min-h-screen flex flex-col bg-white">  
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Hasil Final</h1>
          <div className="text-xs text-slate-600">
            Halaman <b>{pageIndex + 1}</b> • Baris: <b>{rows.length}</b> / {PAGE_SIZE}
          </div>
        </div>
        <p className="text-sm text-slate-700">
          Nilai akhir = <b>Akademik (/100) + Al Qur&apos;an (/100) + Wawancara (/100)</b> (maks 300).          
        </p>

        {errMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errMsg}</div>
        )}

        {/* Toolbar */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Jenjang */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Filter jenjang"
              >
                {levels.map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Filter kelengkapan"
              >
                <option value="ALL">Semua Status</option>
                <option value="LENGKAP">Sudah lengkap (3 nilai)</option>
              </select>

              {/* Urut */}
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Urutkan"
              >
                <option value="RANKING">Ranking (Total tertinggi)</option>
                <option value="NISN">Urut NISN</option>
              </select>

              <button
                onClick={() => fetchPage(0)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Download Excel */}
          <div className="flex items-center justify-end">
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Download semua data ke Excel"
            >
              {downloading ? "Mengunduh..." : "📥 Download Excel"}
            </button>
          </div>
        </div>

        {/* ===== MOBILE: Cards ===== */}
        <div className="mt-4 space-y-3 md:hidden">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-6 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-3 h-20 w-full animate-pulse rounded bg-slate-100" />
            </div>
          )}
          {!loading && rows.map((r) => (
            <div key={`${r.nisn}-${r.no}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">No {r.no} • Jenjang <b>{r.level}</b></div>
                  <div className="mt-0.5 font-semibold text-slate-900">{r.name}</div>
                  <div className="font-mono text-sm text-slate-800">{r.nisn}</div>
                </div>
                <button
                  onClick={() => openDetail(r)}
                  className="shrink-0 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Detail
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-black">
                <div>Akademik: <b>{r.akademik ?? "-"}</b></div>
                <div>Al Qur&apos;an: <b>{r.tahfidz ?? "-"}</b></div>
                <div>Wawancara: <b>{r.wawancara ?? "-"}</b></div>
                <div>Total: <b>{r.total?.toFixed?.(1) ?? r.total}</b></div>
                <div className="col-span-2">
                  Rekomendasi Tahfidz: <RecBadge rec={r.tahfidzRecommendation} />
                </div>
              </div>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-600">
              Tidak ada data.
            </div>
          )}
        </div>

        {/* ===== DESKTOP: Table ===== */}
        <div className="mt-4 hidden md:block">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[1150px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-2 py-2 text-left w-14">No</th>
                  <th className="px-2 py-2 text-left">NISN</th>
                  <th className="px-2 py-2 text-left">Nama</th>
                  <th className="px-2 py-2 text-left">Jenjang</th>
                  <th className="px-2 py-2 text-left">Akademik</th>
                  <th className="px-2 py-2 text-left">Al Qur&apos;an</th>
                  <th className="px-2 py-2 text-left">Rekomendasi Tahfidz</th>
                  <th className="px-2 py-2 text-left">Wawancara</th>
                  <th className="px-2 py-2 text-left">Total</th>
                  <th className="px-2 py-2 text-left">Peringkat</th>
                  <th className="px-2 py-2 text-left">Tombol</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={11} className="px-3 py-6"><div className="h-8 w-full animate-pulse rounded bg-slate-100" /></td></tr>
                )}

                {!loading && rows.map((r) => (
                  <tr key={`${r.nisn}-${r.no}`} className="border-t  text-black">
                    <td className="px-2 py-2">{r.no}</td>
                    <td className="px-2 py-2 font-mono">{r.nisn}</td>
                    <td className="px-2 py-2">{r.name}</td>
                    <td className="px-2 py-2">{r.level}</td>
                    <td className="px-2 py-2">{r.akademik != null ? r.akademik : "-"}</td>
                    <td className="px-2 py-2">{r.tahfidz  != null ? r.tahfidz  : "-"}</td>
                    <td className="px-2 py-2"><RecBadge rec={r.tahfidzRecommendation} /></td>
                    <td className="px-2 py-2">{r.wawancara!= null ? r.wawancara: "-"}</td>
                    <td className="px-2 py-2 font-semibold">{r.total?.toFixed?.(1) ?? r.total}</td>
                    <td className="px-2 py-2">{r.rank}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => openDetail(r)}
                        className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && rows.length === 0 && (
                  <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-600">Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pager */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-600">Halaman <b>{pageIndex + 1}</b></div>
          <div className="flex gap-2">
            <button
              onClick={onPrev}
              disabled={pageIndex===0 || loading}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
            >
              ⟵ Sebelumnya
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

      {/* Modal Detail */}
      {open && detail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4">
            <div className="mt-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {detail.name} – {detail.nisn}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                >
                  Tutup
                </button>
              </div>

              <div className="px-5 py-4 text-sm text-black">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-slate-500">Jenjang:</span> <b>{detail.level}</b></div>
                  <div><span className="text-slate-500">Peringkat:</span> <b>{detail.rank}</b></div>
                </div>

                <div className="mt-3 space-y-3">
                  {/* 1) Al Qur&apos;an */}
                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900 mb-1">Al Qur&apos;an</div>
                    <div>Nilai: <b>{detail.tahfidz ?? "-"}</b></div>
                    <div className="mt-1">Rekomendasi: <RecBadge rec={detail.tahfidzRecommendation} /></div>
                    <div className="text-slate-600 mt-1">Penguji: <b>{detail.tahfidzExaminer ?? "-"}</b></div>
                  </section>

                  {/* 2) Akademik */}
                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900 mb-1">Akademik</div>
                    <div>Nilai: <b>{detail.akademik ?? "-"}</b></div>
                  </section>

                  {/* 3) Wawancara */}
                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900 mb-1">Wawancara</div>
                    <div>Nilai: <b>{detail.wawancara ?? "-"}</b></div>
                    <div className="text-slate-600 mt-1">Penanya: <b>{detail.wawancaraExaminer ?? "-"}</b></div>
                  </section>

                  {/* Total */}
                  <section className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900 mb-1">Total</div>
                    <div className="text-slate-700">
                      <b>{detail.total?.toFixed?.(1) ?? detail.total}</b> / 300
                    </div>
                  </section>
                </div>
              </div>

              <div className="border-t px-5 py-4 text-right">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white"
                >
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
