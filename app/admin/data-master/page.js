"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ================= Utils ================= */
const PAGE_SIZE = 20;
const READ_CAP = 5;

const isEmpty = (v) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !v?.seconds && Object.keys(v || {}).length === 0);

const toMs = (v) =>
  typeof v?.toMillis === "function"
    ? v.toMillis()
    : Number.isFinite(new Date(String(v)).getTime())
    ? new Date(String(v)).getTime()
    : 0;

const fmtDate = (v) =>
  toMs(v)
    ? new Date(toMs(v)).toLocaleString("id-ID", { hour12: false })
    : "-";

const pickWhatsApp = (doc) => {
  const cands = [doc?.hpSiswa, doc?.ayahHP, doc?.ibuHP, doc?.waliHP].map((x) =>
    typeof x === "string" ? x.trim() : ""
  );
  return cands.find((x) => x) || "-";
};

const getAyahNama = (doc) => (doc?.ayahNama ? String(doc.ayahNama) : "-");

const displayNisn = (r) => {
  const nisn = String(r?.nisn ?? "").trim();
  return nisn || "-";
};

// === NEW: parser label penghasilan → angka rupiah (pakai titik tengah rentang) ===
function parseIncomeLabel(v) {
  const s = String(v ?? "").toLowerCase().replaceAll(",", ".").replaceAll(/\s+/g, " ");
  if (!s) return 0;
  // match "a - b juta" (spasi opsional)
  const m = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*juta/);
  if (m) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return ((a + b) / 2) * 1_000_000;
  }
  // match "10 juta" atau "3.5 juta"
  const n = s.match(/(\d+(?:\.\d+)?)\s*juta/);
  if (n) {
    const x = parseFloat(n[1]);
    if (Number.isFinite(x)) return x * 1_000_000;
  }
  // fallback: jika angka polos
  const only = s.match(/^\d+(?:\.\d+)?$/);
  if (only) return parseFloat(only[0]) * (s.includes("juta") ? 1_000_000 : 1);

  return 0;
}

// === NEW: total penghasilan gabungan ayah+ibu (dari collection ppdb) ===
const sumIncome = (r) => parseIncomeLabel(r?.ayahIncome) + parseIncomeLabel(r?.ibuIncome);

/** Status Orang Tua */
const parentStatus = (r) => {
  const a = String(r?.ayahStatus || "").toLowerCase().trim();
  const i = String(r?.ibuStatus || "").toLowerCase().trim();
  const ayahM = a === "meninggal";
  const ibuM = i === "meninggal";
  if (ayahM && ibuM) return "MENINGGAL_KEDUANYA";
  if (ayahM) return "MENINGGAL_AYAH";
  if (ibuM) return "MENINGGAL_IBU";
  return "HIDUP_KEDUANYA";
};

function buildFilesForNisn(doc) {
  const nisn = String(doc?.nisn || doc?._id || "").trim();
  const validSeg = nisn ? `/ppdb/${nisn}/` : null;
  const out = [];

  if (doc?.filesMeta && typeof doc.filesMeta === "object") {
    for (const [name, meta] of Object.entries(doc.filesMeta)) {
      const url = String(meta?.url || "");
      if (!url) continue;
      if (validSeg && !url.includes(validSeg)) continue;
      out.push({
        key: name.toUpperCase(),
        url,
        contentType: meta?.contentType || "",
        size: meta?.size || null,
      });
    }
  }

  if (out.length === 0 && doc?.files && typeof doc.files === "object") {
    for (const [name, urlRaw] of Object.entries(doc.files)) {
      const url = String(urlRaw || "");
      if (!url) continue;
      if (validSeg && !url.includes(validSeg)) continue;
      out.push({ key: name.toUpperCase(), url, contentType: "", size: null });
    }
  }

  const pref = ["KK", "IJAZAH", "AKTA", "FOTO", "KIP"];
  out.sort((a, b) => {
    const ia = pref.indexOf(a.key);
    const ib = pref.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.key.localeCompare(b.key);
  });

  return out;
}

/* ================= Helpers: users_app statuses ================= */
const isPaidLike = (s) => s === true || (typeof s === "string" && ["verified","paid","settled","confirm","confirmed","success"].some(k => s.toLowerCase().includes(k)));

const isPassedLike = (s) => String(s || "").toLowerCase() === "lulus";

async function fetchUsersAppStatusMap(ids) {
  const map = new Map();
  const col = collection(db, "users_app");
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const snap = await getDocs(query(col, where("__name__", "in", chunk)));
    snap.forEach((d) => {
      const data = d.data() || {};
      const paid =
        data?.verifiedPayment === true ||                 // ⬅ ikut hitung seperti Rekap
        isPaidLike(data?.registrationPaymentStatus) ||    // ⬅ tetap
        isPaidLike(data?.reRegistrationPaymentStatus);    // ⬅ ikut hitung seperti Rekap

      map.set(d.id, {
        _paid: !!paid,
        _passed: isPassedLike(data?.finalDecision),
        _regLevel: data?.registrationLevel || null,
      });
    });
    // isi default untuk id yang tidak ditemukan di users_app
    chunk.forEach((id) => {
      if (!map.has(id)) map.set(id, { _paid: false, _passed: false, _regLevel: null });
    });
  }
  return map;
}


/* ================= Page ================= */
export default function DataMasterPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filters
  const [filterLevel, setFilterLevel] = useState("ALL");
  // === NEW: opsi income sesuai gambar ===
  const [filterIncome, setFilterIncome] = useState("ALL"); // "0-1","1-2","2-3","3-5","5-10",">=10"
  const [filterParents, setFilterParents] = useState("ALL");
  const [levels, setLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("OFF");
  const [search, setSearch] = useState("");

  const [pageIndex, setPageIndex] = useState(0);
  const cursorStack = useRef([]);
  const [hasNext, setHasNext] = useState(false);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [exporting, setExporting] = useState(false);

  async function loadRegistrationLevels() {
    setLevelsLoading(true);
    try {
      const col = collection(db, "users_app");
      const snap = await getDocs(query(col, limit(500)));
      const uniq = new Set();
      snap.forEach((d) => {
        const v = (d.data()?.registrationLevel || "").trim();
        if (v) uniq.add(v);
      });
      setLevels(Array.from(uniq).sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" })));
    } catch (e) {
      console.error("loadRegistrationLevels()", e);
      setLevels([]);
    } finally {
      setLevelsLoading(false);
    }
  }

  useEffect(() => {
    loadRegistrationLevels();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    void fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLevel, filterIncome, filterParents, filterStatus]);

  async function fetchPage(targetIndex, reset = false) {
    try {
      setLoading(true);
      setErr("");

      if (reset) {
        setRows([]);
        setPageIndex(0);
        cursorStack.current = [];
      }

      const baseClauses = [orderBy("createdAt", "desc")];
      if (!reset && targetIndex > 0 && cursorStack.current[targetIndex - 1]) {
        baseClauses.push(startAfter(cursorStack.current[targetIndex - 1]));
      }

      const col = collection(db, "ppdb");
      const collected = [];
      let lastDoc = null;
      let reads = 0;
      let done = false;

      while (!done && reads < READ_CAP) {
        const snap = await getDocs(query(col, ...baseClauses, limit(PAGE_SIZE)));
        reads += 1;

        let batch = snap.docs.map((d) => ({ _id: d.id, ...(d.data() || {}) }));
        lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;

        if (filterStatus !== "OFF" || filterLevel !== "ALL") {
          const ids = batch.map((b) => String(b._id));
          const statusMap = await fetchUsersAppStatusMap(ids);
          batch = batch.map((b) => {
            const st = statusMap.get(String(b._id)) || { _paid: false, _passed: false };
            return { ...b, ...st };
          });
        }

        const filtered = batch.filter(applyClientFilters);
        collected.push(...filtered);

        if (collected.length >= PAGE_SIZE || snap.docs.length < PAGE_SIZE) {
          done = true;
          setHasNext(snap.docs.length === PAGE_SIZE);
        } else {
          baseClauses.pop();
          baseClauses.push(startAfter(snap.docs[snap.docs.length - 1]));
        }
      }

      const pageItems = collected.slice(0, PAGE_SIZE);
      setRows(pageItems);
      setPageIndex(targetIndex);

      if (lastDoc) cursorStack.current[targetIndex] = lastDoc;
      setHasNext(Boolean(lastDoc));
    } catch (e) {
      console.error(e);
      setErr("Gagal memuat data.");
      setRows([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  const handleNext = () => fetchPage(pageIndex + 1, false);
  const handlePrev = () => {
    if (pageIndex === 0) return;
    void fetchPage(pageIndex - 1, true);
  };

  // === NEW: aturan filter income gabungan (dalam rupiah) ===
  function matchIncomeBracket(total) {
    if (filterIncome === "ALL") return true;
    switch (filterIncome) {
      case "0-1":
        return total >= 0 && total < 1_000_000;
      case "1-2":
        return total >= 1_000_000 && total < 2_000_000;
      case "2-3":
        return total >= 2_000_000 && total < 3_000_000;
      case "3-5":
        return total >= 3_000_000 && total < 5_000_000;
      case "5-10":
        return total >= 5_000_000 && total < 10_000_000;
      case ">=10":
        return total >= 10_000_000;
      default:
        return true;
    }
  }

  function applyClientFilters(r) {
    if (filterLevel !== "ALL") {
      const lvl = String(r._regLevel || r.registrationLevel || "").toUpperCase();
      if (lvl !== String(filterLevel).toUpperCase()) return false;
    }

    if (filterParents !== "ALL" && parentStatus(r) !== filterParents) return false;

    // === NEW: pakai jumlah ayahIncome + ibuIncome dari collection ppdb ===
    const totalIncome = sumIncome(r);
    if (!matchIncomeBracket(totalIncome)) return false;

    if (filterStatus === "UNPAID" && r._paid === true) return false;
    if (filterStatus === "PAID" && r._paid !== true) return false;
    if (filterStatus === "PASSED" && r._passed !== true) return false;

    return true;
  }

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const nisn = String(r.nisn || r._id || "").toLowerCase();
      const nama = String(r.nama || r.name || "").toLowerCase();
      return nisn.includes(q) || nama.includes(q);
    });
  }, [rows, search]);

  const openDetail = (r) => {
    setSelected(r);
    setOpen(true);
  };

  /* ============ Export .XLS (tetap sama) ============ */
  async function fetchAllDocsPpdb() {
    const col = collection(db, "ppdb");
    const all = [];
    let last = null;
    while (true) {
      const clauses = [orderBy("createdAt", "desc"), limit(500)];
      if (last) clauses.push(startAfter(last));
      const snap = await getDocs(query(col, ...clauses));
      if (snap.empty) break;
      snap.forEach((d) => all.push({ _id: d.id, ...(d.data() || {}) }));
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < 500) break;
    }
    return all;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function isZeroLeadingNumericString(v) {
    const s = String(v ?? "");
    return /^0\d+$/g.test(s);
  }

  function normalizeCell(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
      if (v?.seconds) return new Date(toMs(v)).toISOString();
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }

  async function exportAllToXls() {
    try {
      setExporting(true);

      const all = await fetchAllDocsPpdb();
      if (all.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
      }

      const skipKeys = new Set(["files", "filesMeta"]);
      const headersSet = new Set(["_id"]);
      for (const r of all) {
        for (const k of Object.keys(r)) {
          if (k.startsWith("_")) continue;
          if (skipKeys.has(k)) continue;
          headersSet.add(k);
        }
      }
      const headers = Array.from(headersSet);

      let html = `
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="UTF-8" />
</head>
<body>
<table border="1">
  <thead>
    <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
  </thead>
  <tbody>
`;

      for (const r of all) {
        html += "    <tr>";
        for (const h of headers) {
          const raw = h in r ? r[h] : (h === "_id" ? r._id : "");
          const val = normalizeCell(raw);
          const needsText = isZeroLeadingNumericString(val) || h.toLowerCase() === "nisn" || h === "_id";
          const tdStyle = needsText ? " style=\"mso-number-format:'\\@';\"" : "";
          html += `<td${tdStyle}>${escapeHtml(val)}</td>`;
        }
        html += "</tr>\n";
      }

      html += `  </tbody>
</table>
</body>
</html>`.trim();

      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `ppdb-export-${ts}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("exportAllToXls()", e);
      alert("Gagal membuat file .xls. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  /* ====== UI ====== */
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">DATA LENGKAP SPMB</h1>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {/* Jenjang */}
            <label className="block text-black">
              <span className="text-xs font-semibold text-slate-700">Jenjang</span>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">Semua</option>
                {levelsLoading && <option disabled>Memuat jenjang…</option>}
                {!levelsLoading &&
                  levels.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
              </select>
            </label>

            {/* === NEW: Penghasilan Ortu (gabungan ayah+ibu) sesuai kategori gambar === */}
            <label className="block text-black">
              <span className="text-xs font-semibold text-slate-700">
                Penghasilan Ortu (total)
              </span>
              <select
                value={filterIncome}
                onChange={(e) => setFilterIncome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                title="Gabungan ayahIncome + ibuIncome"
              >
                <option value="ALL">Semua</option>
                <option value="0-1">0 - 1 juta</option>
                <option value="1-2">1 - 2 juta</option>
                <option value="2-3">2 - 3 juta</option>
                <option value="3-5">3 - 5 juta</option>
                <option value="5-10">5 - 10 juta</option>
                <option value=">=10">10 juta</option>
              </select>
            </label>

            {/* Status Orang Tua */}
            <label className="block text-black">
              <span className="text-xs font-semibold text-slate-700">Status Orang Tua</span>
              <select
                value={filterParents}
                onChange={(e) => setFilterParents(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">Semua</option>
                <option value="HIDUP_KEDUANYA">Hidup keduanya</option>
                <option value="MENINGGAL_AYAH">Meninggal ayah</option>
                <option value="MENINGGAL_IBU">Meninggal ibu</option>
                <option value="MENINGGAL_KEDUANYA">Meninggal keduanya</option>
              </select>
            </label>

            {/* Search */}
            <label className="block lg:col-span-2 text-black">
              <span className="text-xs font-semibold text-slate-700">Cari Nama / NISN</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                placeholder="mis. 001 / Udin"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
          </div>

          {/* Status segment */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 mr-1">Status:</span>
            {[
              { v: "OFF", label: "Semua" },
              { v: "UNPAID", label: "Belum bayar" },
              { v: "PAID", label: "Sudah bayar" },
              { v: "PASSED", label: "Lulus" },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFilterStatus(opt.v)}
                className={
                  "rounded-full px-3 py-1 text-xs border " +
                  (filterStatus === opt.v
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50")
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Pager + Export */}
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-slate-600">
              Halaman <b>{pageIndex + 1}</b> • Baris: <b>{view.length}</b> / {PAGE_SIZE}
              {err ? <span className="ml-2 text-rose-600">{err}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={pageIndex === 0 || loading}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
              >
                ← Kembali
              </button>
              <button
                onClick={handleNext}
                disabled={!hasNext || loading}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
              >
                Berikutnya →
              </button>

              <button
                onClick={exportAllToXls}
                disabled={exporting}
                className="rounded bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                title="Download semua data PPDB sebagai .xls"
              >
                {exporting ? "Menyiapkan…" : "Download .XLS (semua)"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="mt-4 -mx-4 sm:mx-0 space-y-3 md:hidden">
          {loading ? (
            <div className="h-16 animate-pulse rounded-none border-y border-slate-200 bg-slate-100" />
          ) : view.length === 0 ? (
            <div className="rounded-none border-y border-slate-200 bg-white p-6 text-center text-slate-600">
              Tidak ada data.
            </div>
          ) : (
            view.map((r, idx) => (
              <div key={r._id || idx} className="rounded-none border-y border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-500">No {idx + 1}</div>
                    <div className="mt-0.5 font-semibold">{r.nama || "-"}</div>
                    <div className="font-mono text-sm">{displayNisn(r)}</div>
                    <div className="text-xs text-slate-600">{r._regLevel || r.jenjang || "-"}</div>
                  </div>
                  <button
                    onClick={() => openDetail(r)}
                    className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Detail
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500">Ayah</div>
                  <div className="text-right">{getAyahNama(r)}</div>
                  <div className="text-slate-500">WhatsApp</div>
                  <div className="text-right">{pickWhatsApp(r)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white hidden md:block">
          <table className="min-w-[960px] w-full text-sm text-slate-900">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-14 px-3 py-2 text-left">No</th>
                <th className="px-3 py-2 text-left">NISN</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Jenjang</th>
                <th className="px-3 py-2 text-left">Nama Ayah</th>
                <th className="px-3 py-2 text-left">No WhatsApp</th>
                <th className="w-28 px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6">
                    <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ) : view.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-600">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                view.map((r, i) => (
                  <tr key={r._id || i} className={i % 2 ? "bg-slate-50/40" : "bg-white"}>
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-mono">{displayNisn(r)}</td>
                    <td className="px-3 py-2">{r.nama || "-"}</td>
                    <td className="px-3 py-2">{r._regLevel || r.jenjang || "-"}</td>
                    <td className="px-3 py-2">{getAyahNama(r)}</td>
                    <td className="px-3 py-2">{pickWhatsApp(r)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => openDetail(r)}
                        className="rounded bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Detail */}
      {open && selected && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-0 flex items-start justify-center overflow-y-auto p-2 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-0 sm:mt-10 w-full max-w-none sm:max-w-6xl rounded-none sm:rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text.base md:text-lg font-semibold">
                    Detail Peserta — {selected.nama || "-"} ({displayNisn(selected)})
                  </h3>
                  <p className="text-xs text-slate-600">
                    Dibuat: {fmtDate(selected.createdAt)} • Diubah: {fmtDate(selected.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                >
                  Tutup
                </button>
              </div>

              <div className="px-5 py-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(selected).map(([k, v]) => {
                    if (k.startsWith("_")) return null;
                    if (k === "files" || k === "filesMeta") return null;
                    const val =
                      typeof v === "object" && v?.seconds
                        ? fmtDate(v)
                        : typeof v === "object"
                        ? JSON.stringify(v)
                        : String(isEmpty(v) ? "-" : v);
                    return (
                      <div key={k} className="rounded border border-slate-200 p-3">
                        <div className="text-xs font-semibold text-slate-600">{k}</div>
                        <div className="mt-1 text-sm text-slate-900 break-words">{val}</div>
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const files = buildFilesForNisn(selected);
                  if (files.length === 0) return null;
                  return (
                    <div className="mt-5">
                      <div className="text-sm font-semibold">Berkas Terunggah</div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {files.map((f) => {
                          const isImg =
                            /^image\//i.test(f.contentType) ||
                            /\.(png|jpe?g|webp|gif)$/i.test(f.url);
                          const isPdf =
                            /^application\/pdf$/i.test(f.contentType) ||
                            /\.pdf($|\?)/i.test(f.url);

                          return (
                            <div
                              key={`${f.key}-${f.url}`}
                              className="rounded-lg border border-slate-200 p-3 bg-white"
                            >
                              <div className="text-xs uppercase tracking-wide text-slate-500">
                                {f.key}
                              </div>

                              <div className="mt-2">
                                {isImg ? (
                                  <a href={f.url} target="_blank" rel="noreferrer" title={`Buka ${f.key}`}>
                                    <img
                                      src={f.url}
                                      alt={f.key}
                                      className="max-h-40 w-auto rounded border border-slate-200 object-contain"
                                      loading="lazy"
                                    />
                                  </a>
                                ) : isPdf ? (
                                  <a href={f.url} target="_blank" rel="noreferrer" title={`Buka ${f.key}`}>
                                    <embed
                                      src={f.url}
                                      type="application/pdf"
                                      className="h-40 w-full rounded border border-slate-200"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-violet-700 hover:underline break-words inline-block"
                                    title={`Buka ${f.key}`}
                                  >
                                    {f.url}
                                  </a>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                {f.contentType ? <span>{f.contentType}</span> : null}
                                {f.size ? <span>• {(Number(f.size) / 1024).toFixed(0)} KB</span> : null}
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50"
                                >
                                  Buka
                                </a>
                                <button
                                  onClick={() => navigator.clipboard?.writeText(f.url)}
                                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50"
                                >
                                  Salin URL
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
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
