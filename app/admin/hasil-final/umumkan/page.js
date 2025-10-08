"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  setDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

/* ========= Koleksi & Konstanta ========= */
const USERS_COLLECTION   = "users_app";        // data siswa
const TAHFIDZ_COLL       = "tahfidz_scores";   // skor Al Qur&apos;an
const INTERVIEW_COLL     = "interview_scores"; // skor wawancara
const PAGE_SIZE          = 50;

/* ========= Util ========= */
const getNisn  = (u) => u?.username || u?.nisn || u?.id || "";
const getName  = (u) => u?.fullName || u?.fullname || u?.displayName || u?.name || "Tanpa Nama";
const getLevel = (u) => u?.registrationLevel || "-";
const sortLevels = (arr) => ["ALL", ...arr.filter(x => x !== "ALL").sort((a,b)=>String(a).localeCompare(String(b)))];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Badge mini */
const Pill = ({ text, tone="slate" }) => {
  const tones = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red:   "bg-rose-50 text-rose-700 ring-rose-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    violet:"bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone] || tones.slate}`}>
      {text}
    </span>
  );
};

function escapeXml(v) {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Header kolom yang dipakai di tampilan
const XLS_HEADERS = [
  "No","NISN","Nama","Jenjang",
  "Akademik","AlQuran","Wawancara","Total","Rank",
  "Keputusan","Penguji_AlQuran","Penguji_Wawancara"
];

/**
 * Build SpreadsheetML (Excel 2003 XML) — aman untuk .xls tanpa warning.
 * Kita set semua cell sebagai String (text) agar leading zero NISN tidak hilang.
 * Jika ingin angka tetap numeric, bisa set Type="Number" per kolom (opsional).
 */
function rowsToXlsXml(rows, sheetName = "Hasil") {
  // Header baris
  const headerRow =
    `<Row>` +
    XLS_HEADERS.map(h =>
      `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
    ).join("") +
    `</Row>`;

  // Data baris
  const bodyRows = rows.map(r => {
    // urutan sesuai header
    const vals = [
      r.rank ?? r.no,
      r.nisn,            // ← biarkan string agar "00" tetap
      r.name,
      r.level,
      r.akademik ?? "",
      r.tahfidz ?? "",
      r.wawancara ?? "",
      (r.total ?? ""),   // kalau mau 1 desimal: (typeof r.total==="number"? r.total.toFixed(1): (r.total??""))
      r.rank ?? "",
      (r.finalDecision ?? ""),
      (r.tahfidzExaminer ?? ""),
      (r.wawancaraExaminer ?? "")
    ];

    // Semua sebagai String (text) → leading zero aman & tidak ada auto-format Excel
    const cells = vals.map((v, i) => {
      // khusus NISN (kolom index 1) tambahkan style text eksplisit (sText)
      const style = i === 1 ? ` ss:StyleID="sText"` : "";
      return `<Cell${style}><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`;
    }).join("");

    return `<Row>${cells}</Row>`;
  }).join("");

  // XML Spreadsheet 2003 lengkap dengan Styles (header & text)
  const xml =
`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Inkaria Export</Author>
  <LastAuthor>Inkaria Export</LastAuthor>
  <Created>${new Date().toISOString()}</Created>
  <Company>Inkaria</Company>
  <Version>16.00</Version>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Arial" ss:Size="10"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <!-- sText memaksa tampilan sebagai teks (Format "@") -->
  <Style ss:ID="sText">
    <NumberFormat ss:Format="@"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table ss:DefaultColumnWidth="80" ss:DefaultRowHeight="16">
   ${headerRow}
   ${bodyRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
  return xml;
}

// Trigger download .xls (SpreadsheetML)
function downloadXls(filename, xmlString) {
  const blob = new Blob([xmlString], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

export default function HasilFinalPage() {
  /* ------ Filter ------ */
  const [levelFilter, setLevelFilter]       = useState("ALL");
  const [statusFilter, setStatusFilter]     = useState("ALL"); // ALL | LENGKAP
  const [decisionFilter, setDecisionFilter] = useState("ALL"); // ALL | LULUS | TIDAK | BELUM
  const [sortMode, setSortMode]             = useState("RANKING"); // RANKING | NISN
  // nilai threshold
  const [minAka, setMinAka]     = useState(0);
  const [minTah, setMinTah]     = useState(0);
  const [minWaw, setMinWaw]     = useState(0);
  const [minTotal, setMinTotal] = useState(0);

  const [levels, setLevels] = useState(["ALL"]);

  /* ------ Data & Paging ------ */
  const [rows, setRows]           = useState([]); // tampil (setelah filter & ranking per halaman)
  const [allRows, setAllRows]     = useState([]); // mentah per halaman
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [anchors, setAnchors]     = useState([]);
  const [hasNext, setHasNext]     = useState(false);

  /* ------ Seleksi (bulk) ------ */
  const [selected, setSelected]   = useState(new Set()); // set of nisn
  const allChecked = selected.size > 0 && rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && selected.size < rows.length;
  const masterRef = useRef(null);
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  /* ------ Export state ------ */
  const [exportingView, setExportingView] = useState(false);
  const [exportingAll, setExportingAll]   = useState(false);

  /* ===== Prefetch level (gabungan users/scores) ===== */
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
        // interview_scores
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
        // tahfidz_scores (optional)
        {
          const colRef = collection(db, TAHFIDZ_COLL);
          try {
            let qLv = query(colRef, orderBy("level", "asc"), limit(200));
            while (true) {
              const snap = await getDocs(qLv);
              if (snap.empty) break;
              snap.forEach((d) => d.data()?.level && setLv.add(d.data().level));
              if (snap.size < 200) break;
              const last = snap.docs[snap.docs.length - 1];
              qLv = query(colRef, orderBy("level", "asc"), startAfter(last), limit(200));
            }
          } catch { /* lewati jika belum ada index */ }
        }
      } finally {
        setLevels(sortLevels(Array.from(setLv)));
      }
    })();
  }, []);

  /* ===== Query users (verified only) ===== */
  function buildUsersQuery(afterDoc = null) {
    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [
      where("role", "==", "siswa"),
      where("registrationPaymentStatus", "==", "verified"),
    ];
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

      const merged = await Promise.all(users.map((u, i) => mergeScores(u, targetIndex * PAGE_SIZE + (i + 1))));
      setAllRows(merged);
      setPageIndex(targetIndex);
      setSelected(new Set());  // reset seleksi saat ganti halaman
    } catch (e) {
      console.error(e);
      setErrMsg("Gagal memuat hasil. Pastikan index (role↑, username↑) tersedia.");
      setAllRows([]); setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  async function mergeScores(u, noIndex) {
    const nisn = getNisn(u);
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

    // Wawancara
    const wData = ivDoc.exists() ? ivDoc.data() : null;
    const wawancara = wData?.total100 ?? null;
    const wawancaraExaminer = wData?.examinerName || null;

    const total = (akademik ?? 0) + (tahfidz ?? 0) + (wawancara ?? 0);
    const decision = String(u?.finalDecision || "").toUpperCase();

    return {
      no: noIndex,
      nisn: nisn,
      name: getName(u),
      level: getLevel(u),
      akademik,
      tahfidz,
      tahfidzExaminer,
      wawancara,
      wawancaraExaminer,
      total,
      complete: akademik != null && tahfidz != null && wawancara != null,
      finalDecision: decision || null,
    };
  }

  // load & reload saat filter jenjang berubah
  useEffect(() => {
    setAnchors([]); fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter]);

  // terapkan semua filter & sorting ke allRows
  useEffect(() => {
    let filtered = [...allRows];

    // filter kelengkapan
    if (statusFilter === "LENGKAP") filtered = filtered.filter(r => r.complete);

    // filter keputusan
    if (decisionFilter === "LULUS") filtered = filtered.filter(r => r.finalDecision === "LULUS");
    if (decisionFilter === "TIDAK") filtered = filtered.filter(r => r.finalDecision === "TIDAK_LULUS");
    if (decisionFilter === "BELUM") filtered = filtered.filter(r => !r.finalDecision);

    // filter nilai
    const a = clamp(Number(minAka || 0), 0, 100);
    const t = clamp(Number(minTah || 0), 0, 100);
    const w = clamp(Number(minWaw || 0), 0, 100);
    const tot = clamp(Number(minTotal || 0), 0, 300);

    filtered = filtered.filter(r => {
      const passA = a === 0 ? true : (r.akademik  != null && r.akademik  >= a);
      const passT = t === 0 ? true : (r.tahfidz   != null && r.tahfidz   >= t);
      const passW = w === 0 ? true : (r.wawancara != null && r.wawancara >= w);
      const passTot = (r.total >= tot);
      return passA && passT && passW && passTot;
    });

    // urut
    if (sortMode === "RANKING") {
      filtered.sort((x,y) =>
        (y.total - x.total) ||
        ((y.wawancara ?? -1) - (x.wawancara ?? -1)) ||
        ((y.tahfidz  ?? -1) - (x.tahfidz  ?? -1)) ||
        ((y.akademik ?? -1) - (x.akademik ?? -1)) ||
        String(x.nisn).localeCompare(String(y.nisn))
      );
      filtered = filtered.map((r, i) => ({ ...r, rank: i + 1 }));
    } else {
      filtered.sort((x,y)=> String(x.nisn).localeCompare(String(y.nisn)));
      filtered = filtered.map((r) => ({ ...r, rank: "-" }));
    }

    setRows(filtered);
    // sinkronkan seleksi
    setSelected(prev => {
      const next = new Set();
      const vis = new Set(filtered.map(r => String(r.nisn)));
      prev.forEach(n => { if (vis.has(String(n))) next.add(n); });
      return next;
    });
  }, [allRows, statusFilter, decisionFilter, sortMode, minAka, minTah, minWaw, minTotal]);

  const onPrev = () => { if (pageIndex > 0 && !loading) fetchPage(pageIndex - 1); };
  const onNext = () => { if (!loading && hasNext) fetchPage(pageIndex + 1); };

  /* ====== ACTION: set keputusan LULUS / TIDAK / CLEAR (single) ====== */
  async function setDecision(nisn, decision /* "LULUS" | "TIDAK_LULUS" | null */) {
    try {
      const by = (typeof window !== "undefined" && (localStorage.getItem("admin_username") || localStorage.getItem("username"))) || "admin";
      await setDoc(
        doc(db, USERS_COLLECTION, String(nisn)),
        { finalDecision: decision || null, finalDecidedAt: serverTimestamp(), finalDecidedBy: by },
        { merge: true }
      );
      setAllRows((prev) => prev.map((r) => (r.nisn === nisn ? { ...r, finalDecision: decision || null } : r)));
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan keputusan.");
    }
  }

  /* ====== BULK ====== */
  function toggleSelect(nisn) {
    setSelected(prev => {
      const next = new Set(prev);
      const key = String(nisn);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleSelectAllVisible(on) {
    if (on) setSelected(new Set(rows.map(r => String(r.nisn))));
    else setSelected(new Set());
  }
  async function applyDecisionToSelected(decision) {
    const targets = Array.from(selected);
    if (targets.length === 0) return;
    try {
      const by = (typeof window !== "undefined" && (localStorage.getItem("admin_username") || localStorage.getItem("username"))) || "admin";
      const batch = writeBatch(db);
      targets.forEach(nisn => {
        batch.set(
          doc(db, USERS_COLLECTION, String(nisn)),
          { finalDecision: decision, finalDecidedAt: serverTimestamp(), finalDecidedBy: by },
          { merge: true }
        );
      });
      await batch.commit();
      setAllRows(prev => prev.map(r => (targets.includes(String(r.nisn)) ? { ...r, finalDecision: decision } : r)));
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan keputusan massal.");
    }
  }
  async function applyDecisionToAllVisible(decision) {
    const targets = rows.map(r => String(r.nisn));
    if (targets.length === 0) return;
    try {
      const by = (typeof window !== "undefined" && (localStorage.getItem("admin_username") || localStorage.getItem("username"))) || "admin";
      const batch = writeBatch(db);
      targets.forEach(nisn => {
        batch.set(
          doc(db, USERS_COLLECTION, String(nisn)),
          { finalDecision: decision, finalDecidedAt: serverTimestamp(), finalDecidedBy: by },
          { merge: true }
        );
      });
      await batch.commit();
      setAllRows(prev => prev.map(r => (targets.includes(String(r.nisn)) ? { ...r, finalDecision: decision } : r)));
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan keputusan massal.");
    }
  }

  /* ====== EXPORT ====== */

  // Ambil rows yang sedang tampil (sudah terfilter & terurut) -> CSV download
function handleExportView() {
  try {
    setExportingView(true);
    if (rows.length === 0) {
      alert("Tidak ada data pada tampilan saat ini.");
      return;
    }
    // pakai data yang SEDANG TAMPIL (rows), bukan 'filtered'
    const xml = rowsToXlsXml(rows, `Tampilan_Page_${pageIndex + 1}`);
    const filename = `hasil_final_${levelFilter.toLowerCase()}_page${pageIndex + 1}.xls`;
    downloadXls(filename, xml);
  } finally {
    setExportingView(false);
  }
}


  // Ambil semua data (verified, sesuai levelFilter) dari Firestore, terapkan filter nilai/keputusan & urut, lalu export
  async function handleExportAll() {
    setExportingAll(true);
    try {
      const collected = [];
      let after = null;

      while (true) {
        const colRef = collection(db, USERS_COLLECTION);
        const clauses = [
          where("role", "==", "siswa"),
          where("registrationPaymentStatus", "==", "verified"),
        ];
        if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));

        let qBase = query(colRef, ...clauses, orderBy("username", "asc"), limit(PAGE_SIZE));
        if (after) qBase = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(after), limit(PAGE_SIZE));

        const snap = await getDocs(qBase);
        if (snap.empty) break;

        const users = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        // merge skor paralel
        const merged = await Promise.all(users.map((u, i) => mergeScores(u, collected.length + i + 1)));
        collected.push(...merged);

        if (snap.size < PAGE_SIZE) break;
        after = snap.docs[snap.docs.length - 1];
      }

      // Terapkan filter yang sama seperti tampilan
      const a = clamp(Number(minAka || 0), 0, 100);
      const t = clamp(Number(minTah || 0), 0, 100);
      const w = clamp(Number(minWaw || 0), 0, 100);
      const tot = clamp(Number(minTotal || 0), 0, 300);

      let filtered = collected;

      if (statusFilter === "LENGKAP") filtered = filtered.filter(r => r.complete);
      if (decisionFilter === "LULUS") filtered = filtered.filter(r => r.finalDecision === "LULUS");
      if (decisionFilter === "TIDAK") filtered = filtered.filter(r => r.finalDecision === "TIDAK_LULUS");
      if (decisionFilter === "BELUM") filtered = filtered.filter(r => !r.finalDecision);

      filtered = filtered.filter(r => {
        const passA = a === 0 ? true : (r.akademik  != null && r.akademik  >= a);
        const passT = t === 0 ? true : (r.tahfidz   != null && r.tahfidz   >= t);
        const passW = w === 0 ? true : (r.wawancara != null && r.wawancara >= w);
        const passTot = (r.total >= tot);
        return passA && passT && passW && passTot;
      });

      if (sortMode === "RANKING") {
        filtered.sort((x,y) =>
          (y.total - x.total) ||
          ((y.wawancara ?? -1) - (x.wawancara ?? -1)) ||
          ((y.tahfidz  ?? -1) - (x.tahfidz  ?? -1)) ||
          ((y.akademik ?? -1) - (x.akademik ?? -1)) ||
          String(x.nisn).localeCompare(String(y.nisn))
        );
        filtered = filtered.map((r, i) => ({ ...r, rank: i + 1 }));
      } else {
        filtered.sort((x,y)=> String(x.nisn).localeCompare(String(y.nisn)));
        filtered = filtered.map((r) => ({ ...r, rank: "-" }));
      }

      if (filtered.length === 0) {
        alert("Tidak ada data sesuai filter untuk diexport.");
        return;
      }

const xml = rowsToXlsXml(filtered, "Semua_Data");
const filename = `hasil_final_${levelFilter.toLowerCase()}_ALL.xls`;
downloadXls(filename, xml);
    } catch (e) {
      console.error(e);
      alert("Gagal export. Coba kurangi filter atau cek koneksi.");
    } finally {
      setExportingAll(false);
    }
  }

  /* ====== RENDER ====== */

  // card list (mobile)
  const MobileList = useMemo(() => {
    if (loading) {
      return (
        <div className="md:hidden mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
        </div>
      );
    }
    if (!rows.length) {
      return (
        <div className="md:hidden mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
          Tidak ada data.
        </div>
      );
    }
    return (
      <ul className="md:hidden mt-4 space-y-3">
        {rows.map((r) => (
          <li key={`m-${r.nisn}-${r.no}`} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">No {r.no} • Rank {r.rank ?? "-"}</div>
                <div className="mt-0.5 font-semibold text-slate-900">{r.name}</div>
                <div className="font-mono text-sm text-slate-700">{r.nisn}</div>
                <div className="mt-1"><Pill text={r.level} tone="violet" /></div>
              </div>
              <div className="shrink-0">
                <input
                  type="checkbox"
                  checked={selected.has(String(r.nisn))}
                  onChange={() => toggleSelect(r.nisn)}
                  aria-label={`Pilih ${r.nisn}`}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[11px] text-slate-500">Akademik</div>
                <div className="mt-0.5 font-semibold text-right">
                  {r.akademik != null ? r.akademik : <Pill text="belum" tone="amber" />}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[11px] text-slate-500">Al-Qur’an</div>
                <div className="mt-0.5 font-semibold text-right">
                  {r.tahfidz != null ? r.tahfidz : <Pill text="belum" tone="amber" />}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[11px] text-slate-500">Wawancara</div>
                <div className="mt-0.5 font-semibold text-right">
                  {r.wawancara != null ? r.wawancara : <Pill text="belum" tone="amber" />}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm">Total: <span className="font-bold">{r.total?.toFixed?.(1) ?? r.total}</span></div>
              <Pill
                text={r.finalDecision === "LULUS" ? "Lulus" : r.finalDecision === "TIDAK_LULUS" ? "Tidak Lulus" : "Belum dipilih"}
                tone={r.finalDecision === "LULUS" ? "green" : r.finalDecision === "TIDAK_LULUS" ? "red" : "amber"}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setDecision(r.nisn, "LULUS")}
                className={`rounded border px-3 py-1.5 text-xs ${
                  r.finalDecision === "LULUS" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-800"
                }`}
              >
                ✔ Lulus
              </button>
              <button
                onClick={() => setDecision(r.nisn, "TIDAK_LULUS")}
                className={`rounded border px-3 py-1.5 text-xs ${
                  r.finalDecision === "TIDAK_LULUS" ? "border-rose-600 bg-rose-600 text-white" : "border-slate-300 text-slate-800"
                }`}
              >
                ✖ Tidak
              </button>
              <button
                onClick={() => setDecision(r.nisn, null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
              >
                ⟲ Clear
              </button>
            </div>

            {(r.tahfidzExaminer || r.wawancaraExaminer) && (
              <div className="mt-3 rounded-lg border border-slate-200 p-2 text-xs text-slate-600">
                {r.tahfidzExaminer && <div>Penguji Al-Qur’an: <b className="text-slate-800">{r.tahfidzExaminer}</b></div>}
                {r.wawancaraExaminer && <div>Penguji Wawancara: <b className="text-slate-800">{r.wawancaraExaminer}</b></div>}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }, [rows, selected, loading]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Hasil Final</h1>
            <p className="text-sm text-slate-700">
              Semua peserta <b>verified</b> tampil meski belum ada nilai. Gunakan filter nilai & keputusan. Bisa contreng massal. Ekspor ke Excel tersedia.
            </p>
          </div>
          <div className="text-xs text-slate-600">
            Halaman <b>{pageIndex + 1}</b> • Tampil: <b>{rows.length}</b> / {PAGE_SIZE}
          </div>
        </div>

        {errMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errMsg}
          </div>
        )}

        {/* Toolbar utama */}
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

              {/* Kelengkapan */}
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

              {/* Keputusan */}
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Filter Keputusan Akhir"
              >
                <option value="ALL">Semua Keputusan</option>
                <option value="LULUS">Lulus</option>
                <option value="TIDAK">Tidak Lulus</option>
                <option value="BELUM">Belum Dipilih</option>
              </select>

              <button
                onClick={() => fetchPage(0)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                Refresh
              </button>

              {/* EXPORT */}
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  onClick={handleExportView}
                  disabled={exportingView || rows.length === 0}
                  className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 disabled:opacity-50"
                  title="Unduh baris yang sedang tampil (setelah filter & sort)"
                >
                  {exportingView ? "Menyiapkan..." : "Download Excel (Tampilan)"}
                </button>
                <button
                  onClick={handleExportAll}
                  disabled={exportingAll}
                  className="rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  title="Ambil semua data sesuai jenjang & filter lalu unduh"
                >
                  {exportingAll ? "Mengumpulkan data..." : "Download Excel (Semua)"}
                </button>
              </div>
            </div>

            {/* BARIS AKSI MASSAL */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800">
                <input
                  ref={masterRef}
                  type="checkbox"
                  aria-label="Pilih semua tampilan"
                  checked={allChecked}
                  onChange={(e)=>toggleSelectAllVisible(e.target.checked)}
                />
                Pilih Semua (tampil)
              </label>
              <button
                onClick={() => toggleSelectAllVisible(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                title="Kosongkan pilihan"
              >
                Hapus Pilihan
              </button>

              <span className="text-xs text-slate-500">Terpilih: <b>{selected.size}</b></span>

              <button
                onClick={() => applyDecisionToSelected("LULUS")}
                disabled={selected.size === 0}
                className="rounded border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                title="Set Lulus untuk yang dipilih"
              >
                ✔ Lulus (dipilih)
              </button>
              <button
                onClick={() => applyDecisionToSelected("TIDAK_LULUS")}
                disabled={selected.size === 0}
                className="rounded border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                title="Set Tidak Lulus untuk yang dipilih"
              >
                ✖ Tidak (dipilih)
              </button>

              <span className="mx-1 text-slate-300">|</span>

              <button
                onClick={() => applyDecisionToAllVisible("LULUS")}
                disabled={rows.length === 0}
                className="rounded border border-emerald-600 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-50"
                title="Set Lulus untuk semua yang tampil"
              >
                ✔ Lulus (tampilan)
              </button>
              <button
                onClick={() => applyDecisionToAllVisible("TIDAK_LULUS")}
                disabled={rows.length === 0}
                className="rounded border border-rose-600 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50"
                title="Set Tidak Lulus untuk semua yang tampil"
              >
                ✖ Tidak (tampilan)
              </button>
            </div>
          </div>

          {/* Filter nilai per tes */}
          <div className="rounded-xl border border-violet-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">Filter Nilai (Min)</div>
            <div className="grid grid-cols-2 gap-2 text-sm text-black">
              <label className="flex items-center gap-2">
                <span className="w-24 text-slate-600">Akademik</span>
                <input
                  type="number" min={0} max={100} step={1}
                  value={minAka}
                  onChange={(e)=>setMinAka(clamp(Number(e.target.value||0),0,100))}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24 text-slate-600">Al-Qur’an</span>
                <input
                  type="number" min={0} max={100} step={1}
                  value={minTah}
                  onChange={(e)=>setMinTah(clamp(Number(e.target.value||0),0,100))}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24 text-slate-600">Wawancara</span>
                <input
                  type="number" min={0} max={100} step={1}
                  value={minWaw}
                  onChange={(e)=>setMinWaw(clamp(Number(e.target.value||0),0,100))}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24 text-slate-600">Total</span>
                <input
                  type="number" min={0} max={300} step={1}
                  value={minTotal}
                  onChange={(e)=>setMinTotal(clamp(Number(e.target.value||0),0,300))}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={()=>{setMinAka(0);setMinTah(0);setMinWaw(0);setMinTotal(0);}}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800">
                Reset Nilai
              </button>
              <button onClick={()=>{setMinAka(60);setMinTah(60);setMinWaw(60);setMinTotal(180);}}
                className="rounded border border-violet-300 px-3 py-1.5 text-xs text-violet-700">
                Cepat ≥60 tiap tes
              </button>
              <button onClick={()=>{setMinAka(70);setMinTah(70);setMinWaw(70);setMinTotal(210);}}
                className="rounded border border-violet-300 px-3 py-1.5 text-xs text-violet-700">
                Cepat ≥70 tiap tes
              </button>
            </div>
          </div>
        </div>

        {/* ===== TABEL (md+) & KARTU (mobile) ===== */}
        {/* Mobile cards */}
        {MobileList}

        {/* Desktop table */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white hidden md:block">
          <table className="table-fixed w-full text-sm text-black">
            <thead className="sticky top-0 z-[1]">
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-2 py-2 text-left w-10">
                  <input
                    ref={masterRef}
                    type="checkbox"
                    aria-label="Pilih semua tampilan"
                    checked={allChecked}
                    onChange={(e)=>toggleSelectAllVisible(e.target.checked)}
                  />
                </th>
                <th className="px-2 py-2 text-left w-14">No</th>
                <th className="px-2 py-2 text-left w-32">NISN</th>
                <th className="px-2 py-2 text-left">Nama</th>
                <th className="px-2 py-2 text-left w-32">Jenjang</th>
                <th className="px-2 py-2 text-right w-28">Akademik</th>
                <th className="px-2 py-2 text-right w-28">Al-Qur’an</th>
                <th className="px-2 py-2 text-right w-28">Wawancara</th>
                <th className="px-2 py-2 text-right w-28">Total</th>
                <th className="px-2 py-2 text-center w-20">Rank</th>
                <th className="px-2 py-2 text-left w-[220px]">Keputusan</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:break-words">
              {loading && (
                <tr><td colSpan={11} className="px-3 py-6">
                  <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                </td></tr>
              )}

              {!loading && rows.length > 0 && rows.map((r) => (
                <tr key={`${r.nisn}-${r.no}`} className="border-t">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(String(r.nisn))}
                      onChange={() => toggleSelect(r.nisn)}
                      aria-label={`Pilih ${r.nisn}`}
                    />
                  </td>
                  <td className="px-2 py-2">{r.no}</td>
                  <td className="px-2 py-2 font-mono">{r.nisn}</td>
                  <td className="px-2 py-2">{r.name}</td>
                  <td className="px-2 py-2">{r.level}</td>
                  <td className="px-2 py-2 text-right">{r.akademik  != null ? r.akademik  : <Pill text="belum" tone="amber" />}</td>
                  <td className="px-2 py-2 text-right">{r.tahfidz   != null ? r.tahfidz   : <Pill text="belum" tone="amber" />}</td>
                  <td className="px-2 py-2 text-right">{r.wawancara != null ? r.wawancara : <Pill text="belum" tone="amber" />}</td>
                  <td className="px-2 py-2 text-right font-semibold">{r.total?.toFixed?.(1) ?? r.total}</td>
                  <td className="px-2 py-2 text-center">{r.rank}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill
                        text={r.finalDecision === "LULUS" ? "Lulus" : r.finalDecision === "TIDAK_LULUS" ? "Tidak Lulus" : "Belum dipilih"}
                        tone={r.finalDecision === "LULUS" ? "green" : r.finalDecision === "TIDAK_LULUS" ? "red" : "amber"}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDecision(r.nisn, "LULUS")}
                          className={`rounded border px-2 py-1 text-xs ${
                            r.finalDecision === "LULUS"
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 text-slate-800"
                          }`}
                          title="Tandai Lulus"
                        >
                          ✔ Lulus
                        </button>
                        <button
                          onClick={() => setDecision(r.nisn, "TIDAK_LULUS")}
                          className={`rounded border px-2 py-1 text-xs ${
                            r.finalDecision === "TIDAK_LULUS"
                              ? "border-rose-600 bg-rose-600 text-white"
                              : "border-slate-300 text-slate-800"
                          }`}
                          title="Tandai Tidak Lulus"
                        >
                          ✖ Tidak
                        </button>
                        <button
                          onClick={() => setDecision(r.nisn, null)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
                          title="Kosongkan keputusan"
                        >
                          ⟲ Clear
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-600">Tidak ada data.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">Halaman <b>{pageIndex + 1}</b></div>
          <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
