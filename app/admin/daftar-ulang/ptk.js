"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

/* ================= Helpers ================= */
function normalizePaymentStatus(pLike) {
  try {
    const raw =
      (pLike?.status ??
        pLike?.paymentStatus ??
        pLike?.reviewStatus ??
        (pLike?.verified ? "VERIFIED" : "") ??
        (pLike?.approved ? "APPROVED" : "") ??
        "") + "";
    const s = raw.trim().toUpperCase();
    if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s)) return "approved";
    if (["REJECTED", "DENIED", "DECLINED"].includes(s)) return "rejected";
    return "pending";
  } catch {
    return "pending";
  }
}

function fmtIDR(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

/** Cache biaya per label jenjang */
async function getFeeBreakdownByLabel(db, label, cacheRef) {
  if (!label) return { spp: 0, uangPangkalTotal: 0, total: 0 };
  const key = `breakdown:${String(label)}`;
  if (cacheRef.current.has(key)) return cacheRef.current.get(key);

  let spp = 0;
  let uangPangkalTotal = 0;
  try {
    const qref = query(collection(db, "re_registration_fees"), where("label", "==", label), limit(1));
    const snap = await getDocs(qref);
    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      spp = Number(data?.spp ?? 0);
      const up = data?.uangPangkal;
      if (typeof up === "number") uangPangkalTotal = Number(up) || 0;
      else if (up && typeof up === "object") {
        uangPangkalTotal = Object.values(up).reduce((acc, v) => acc + (Number(v) || 0), 0);
      }
    }
  } catch {
    spp = 0;
    uangPangkalTotal = 0;
  }
  const total = (Number(spp) || 0) + (Number(uangPangkalTotal) || 0);
  const out = { spp, uangPangkalTotal, total };
  cacheRef.current.set(key, out);
  return out;
}

/** Diskon khusus PTK */
async function getPTKDiscount(db, nisn) {
  try {
    const dref = doc(db, "users_app", nisn, "re_registration", "ptk_discount");
    const dsnap = await getDoc(dref);
    if (!dsnap.exists()) return { amount: 0, sourceKey: "", type: "", note: "" };
    const x = dsnap.data() || {};
    return {
      amount: Number(x.amount ?? 0) || 0,
      sourceKey: (x.sourceKey || "").toString(),
      type: (x.type || "").toString(),
      note: (x.note || "").toString(),
    };
  } catch {
    return { amount: 0, sourceKey: "", type: "", note: "" };
  }
}

/** Sum approved + meta bukti */
async function getApprovedSumAndMeta(db, nisn) {
  try {
    const qref = query(collection(db, "users_app", nisn, "payments"), orderBy("createdAt", "desc"), limit(500));
    const snap = await getDocs(qref);
    let sum = 0;
    let count = 0;
    let hasPending = false;
    let latestCreatedAt = 0;
    for (const d of snap.docs) {
      count += 1;
      const x = d.data() || {};
      const st = normalizePaymentStatus(x);
      if (st === "approved") {
        const amt = Number(x.amount ?? x.nominal ?? x.jumlah ?? 0);
        if (Number.isFinite(amt)) sum += amt;
      } else if (st === "pending") {
        hasPending = true;
      }
      const ts = x?.createdAt?.toMillis?.() ?? x?.createdAt ?? 0;
      if (ts > latestCreatedAt) latestCreatedAt = ts;
    }
    return { sumApproved: sum, totalDocs: count, hasPending, latestCreatedAt };
  } catch {
    return { sumApproved: 0, totalDocs: 0, hasPending: false, latestCreatedAt: 0 };
  }
}

/* Hitung jumlah saudara dari dok konfirmasi */
function getSiblingCountFromConfirmDoc(x) {
  if (Array.isArray(x?.siblings)) {
    return x.siblings.filter((s) => (s?.name || s?.jenjang || s?.class)).length;
  }
  if ((x?.siblingName || x?.siblingJenjang || x?.siblingClass)) return 1;
  const sc = Number(x?.siblingsCount);
  if (Number.isFinite(sc) && sc > 0) return sc;
  return 0;
}

/* Normalisasi list saudara untuk modal */
function extractSiblingsList(x) {
  if (Array.isArray(x?.siblings) && x.siblings.length) {
    const list = x.siblings
      .map((s) => ({
        name: (s?.name || "").trim(),
        jenjang: String(s?.jenjang || ""),
        class: String(s?.class || ""),
      }))
      .filter((s) => s.name || s.jenjang || s.class);
    if (list.length) return list;
  }
  if (x?.siblingName || x?.siblingJenjang || x?.siblingClass) {
    return [
      {
        name: (x.siblingName || "").trim(),
        jenjang: String(x.siblingJenjang || ""),
        class: String(x.siblingClass || ""),
      },
    ];
  }
  const n = Number(x?.siblingsCount);
  if (Number.isFinite(n) && n > 0) {
    return Array.from({ length: n }, (_, i) => ({
      name: "",
      jenjang: "",
      class: "",
      _placeholder: true,
      _idx: i + 1,
    }));
  }
  return [];
}

/* ================= Component ================= */
export function PTKPanel({ db, jenjangFilter, pageSize = 10, onRowSelect }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // paging
  const [cursorDoc, setCursorDoc] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // search & filter tampil
  const [q, setQ] = useState("");
  const [payFilter, setPayFilter] = useState("ALL"); // ALL | LUNAS | BELUM

  // ringkasan
  const [summaryMode, setSummaryMode] = useState("PENDAPATAN"); // PENDAPATAN | TUNGGAKAN | ORANG

  // totals global
  const [globalTotals, setGlobalTotals] = useState({
    totalTunggakan: 0,
    totalPendapatan: 0,
    totalTagihan: 0,
    countLunas: 0,
    countNunggak: 0,
    scanned: 0,
    done: false,
  });
  const [globalLoading, setGlobalLoading] = useState(false);

  const feeCacheRef = useRef(new Map());

  /* ========== Ambil chunk dok ptk_confirmation (sumber TETAP) ========== */
  const fetchPTKChunk = useCallback(
    async (startCursor, want = 50) => {
      let qref = query(
        collectionGroup(db, "ptk_confirmation"),
        where("status", "in", ["PENDING", "APPROVED"]),
        orderBy("updatedAt", "desc"),
        limit(want + 1)
      );
      if (startCursor) {
        qref = query(
          collectionGroup(db, "ptk_confirmation"),
          where("status", "in", ["PENDING", "APPROVED"]),
          orderBy("updatedAt", "desc"),
          startAfter(startCursor),
          limit(want + 1)
        );
      }
      const snap = await getDocs(qref);
      const docs = snap.docs || [];
      const slice = docs.slice(0, want);
      const nextCur = docs.length > want ? slice[slice.length - 1] : (docs[docs.length - 1] || null);
      const hasMore = docs.length > want;
      return { docs: slice, nextCur, hasMore };
    },
    [db]
  );

  /* ====== Enrich: jadikan baris siap tampil (dengan concurrency) ====== */
  const enrichPTKRows = useCallback(
    async (docs) => {
      const res = [];
      const CONC = 10;
      const chunks = [];
      for (let i = 0; i < docs.length; i += CONC) chunks.push(docs.slice(i, i + CONC));

      for (const chunk of chunks) {
        const works = chunk.map(async (snap) => {
          const x = snap.data() || {};
          const nisn = x.nisn || snap.ref.parent.parent?.id || "";
          const uDoc = nisn ? await getDoc(doc(db, "users_app", nisn)) : null;
          const u = uDoc?.exists() ? uDoc.data() : {};

          const level = u?.registrationLevel || "-";

          // 1) biaya dasar per label (cache)
          const { spp, uangPangkalTotal, total } = await getFeeBreakdownByLabel(db, level, feeCacheRef);

          // 2) diskon PTK
          const { amount: discAmt, sourceKey: discKey, note: discNote, type: discType } = await getPTKDiscount(db, nisn);

          // 3) total efektif setelah diskon
          let effectiveTotal = total;
          if (discAmt > 0) {
            if (String(discKey).toLowerCase() === "spp") {
              const sppAfter = Math.max((Number(spp) || 0) - discAmt, 0);
              effectiveTotal = sppAfter + (Number(uangPangkalTotal) || 0);
            } else {
              effectiveTotal = Math.max(total - discAmt, 0);
            }
          }

          // 4) sum approved + pending flag + last payment time
          const { sumApproved, totalDocs, hasPending, latestCreatedAt } = await getApprovedSumAndMeta(db, nisn);

          // 5) tunggakan & label bayar
          const tunggakan = Math.max((Number(effectiveTotal) || 0) - (Number(sumApproved) || 0), 0);
          const isLunas = (Number(effectiveTotal) || 0) > 0 && tunggakan === 0;

          // 6) jumlah saudara dari dok konfirmasi
          const siblingCount = getSiblingCountFromConfirmDoc(x);

          return {
            nisn,
            name: u?.fullName || u?.nama || u?.name || x.nama || "-",
            registrationLevel: level,
            status: String(x.status || "").toUpperCase() || "-",
            updatedAt: x.updatedAt || null,
            keterangan: isLunas ? "LUNAS" : "TIDAK LUNAS",
            tunggakan,
            totalBukti: totalDocs,
            hasPendingProof: !!hasPending,
            totalTagihan: Number(effectiveTotal) || 0,
            sumApproved,
            discountAmount: discAmt,
            discountKey: discKey,
            discountType: discType,
            discountNote: discNote,
            latestCreatedAt,
            _sibCount: siblingCount, // ← gunakan data saudara
            snap,                    // ← simpan snapshot untuk modal
          };
        });
        const out = await Promise.all(works);
        for (const r of out) if (r) res.push(r);
      }
      return res;
    },
    [db]
  );

  /* ====== Pengambilan tabel: FILL-UNTIL-PAGE ====== */
  const fetchTablePage = useCallback(
    async (mode = "first") => {
      setLoading(true);
      try {
        let localCursor = mode === "next" ? cursorDoc : null;
        let collected = [];
        let safety = 0;
        let reachedEnd = false;

        while (collected.length < pageSize && safety < 10) {
          safety += 1;
          const { docs, nextCur, hasMore } = await fetchPTKChunk(localCursor, pageSize);
          if (!docs.length) { reachedEnd = true; break; }
          let mapped = await enrichPTKRows(docs);

          if (jenjangFilter) mapped = mapped.filter((r) => r.registrationLevel === jenjangFilter);
          if (payFilter === "LUNAS") mapped = mapped.filter((r) => r.keterangan === "LUNAS");
          if (payFilter === "BELUM") mapped = mapped.filter((r) => r.keterangan !== "LUNAS");

          mapped.sort((a, b) => {
            if (a.hasPendingProof !== b.hasPendingProof) return Number(b.hasPendingProof) - Number(a.hasPendingProof);
            const ap = a.status === "PENDING" ? 1 : 0;
            const bp = b.status === "PENDING" ? 1 : 0;
            if (ap !== bp) return bp - ap;
            const aGroup = a._sibCount > 0 ? 1 : 0;
            const bGroup = b._sibCount > 0 ? 1 : 0;
            if (aGroup !== bGroup) return bGroup - aGroup;
            const aLvl = (a.registrationLevel || "").toString();
            const bLvl = (b.registrationLevel || "").toString();
            if (aLvl !== bLvl) return aLvl.localeCompare(bLvl);
            const ts = (t) => (t?.seconds ?? t?._seconds ?? (typeof t === "number" ? t : 0));
            return ts(b.updatedAt) - ts(a.updatedAt);
          });

          collected = collected.concat(mapped);
          localCursor = nextCur;
          if (!hasMore) { reachedEnd = true; break; }
        }

        setRows(collected.slice(0, pageSize));
        setPageIndex((p) => (mode === "first" ? 0 : p + 1));
        setCursorDoc(localCursor);
        setHasNext(!reachedEnd);
      } finally {
        setLoading(false);
      }
    },
    [cursorDoc, pageSize, fetchPTKChunk, enrichPTKRows, jenjangFilter, payFilter]
  );

  /* ====== GLOBAL TOTALS (tetap) ====== */
  const computeGlobalTotals = useCallback(
    async () => {
      setGlobalLoading(true);
      setGlobalTotals((s) => ({ ...s, done: false, scanned: 0 }));

      const PAGE = 100;
      const CONC = 20;

      let next = null;
      let scanned = 0;
      let totalTunggakan = 0;
      let totalPendapatan = 0;
      let totalTagihan = 0;
      let countLunas = 0;
      let countNunggak = 0;

      try {
        while (true) {
          let qref = query(
            collectionGroup(db, "ptk_confirmation"),
            where("status", "in", ["PENDING", "APPROVED"]),
            orderBy("updatedAt", "desc"),
            limit(PAGE)
          );
          if (next) {
            qref = query(
              collectionGroup(db, "ptk_confirmation"),
              where("status", "in", ["PENDING", "APPROVED"]),
              orderBy("updatedAt", "desc"),
              startAfter(next),
              limit(PAGE)
            );
          }

          const snap = await getDocs(qref);
          if (snap.empty) break;

          const docs = snap.docs;
          const chunks = [];
          for (let i = 0; i < docs.length; i += CONC) chunks.push(docs.slice(i, i + CONC));

          for (const chunk of chunks) {
            const works = chunk.map(async (snap) => {
              const x = snap.data() || {};
              const nisn = x.nisn || snap.ref.parent.parent?.id || "";
              const uDoc = nisn ? await getDoc(doc(db, "users_app", nisn)) : null;
              const u = uDoc?.exists() ? uDoc.data() : {};
              const level = u?.registrationLevel || "-";

              if (jenjangFilter && level !== jenjangFilter) return null;

              const { spp, uangPangkalTotal, total } = await getFeeBreakdownByLabel(db, level, feeCacheRef);
              const { amount: discAmt, sourceKey: discKey } = await getPTKDiscount(db, nisn);

              let effectiveTotal = total;
              if (discAmt > 0) {
                if (String(discKey).toLowerCase() === "spp") {
                  const sppAfter = Math.max((Number(spp) || 0) - discAmt, 0);
                  effectiveTotal = sppAfter + (Number(uangPangkalTotal) || 0);
                } else {
                  effectiveTotal = Math.max(total - discAmt, 0);
                }
              }

              const { sumApproved } = await getApprovedSumAndMeta(db, nisn);

              const tunggakan = Math.max((Number(effectiveTotal) || 0) - (Number(sumApproved) || 0), 0);
              const lunas = (Number(effectiveTotal) || 0) > 0 && tunggakan === 0;

              return { tagihan: Number(effectiveTotal) || 0, pendapatan: Number(sumApproved) || 0, tunggakan, lunas };
            });

            const out = await Promise.all(works);
            for (const r of out) {
              if (!r) continue;
              scanned += 1;
              totalTagihan += r.tagihan;
              totalPendapatan += r.pendapatan;
              totalTunggakan += r.tunggakan;
              if (r.lunas) countLunas += 1;
              else countNunggak += 1;
            }

            setGlobalTotals((s) => ({
              ...s,
              totalTunggakan,
              totalPendapatan,
              totalTagihan,
              countLunas,
              countNunggak,
              scanned,
              done: false,
            }));
          }

          next = docs[docs.length - 1];
          if (docs.length < PAGE) break;
        }

        setGlobalTotals({
          totalTunggakan,
          totalPendapatan,
          totalTagihan,
          countLunas,
          countNunggak,
          scanned,
          done: true,
        });
      } finally {
        setGlobalLoading(false);
      }
    },
    [db, jenjangFilter]
  );

  /* ====== Effects ====== */
  useEffect(() => {
    fetchTablePage("first");
  }, [pageSize, jenjangFilter, payFilter]); // eslint-disable-line

  useEffect(() => {
    computeGlobalTotals();
  }, [computeGlobalTotals]);

  /* ⬇️ Real-time UX tanpa socket: dengarkan event lokal dari panel aksi
     Panel approve/reject sebaiknya memanggil:
     window.dispatchEvent(new CustomEvent('ptk:status-changed', { detail: { nisn, status: 'APPROVED', updatedAt: Date.now() } }))
  */
  useEffect(() => {
    function onStatusChanged(e) {
      try {
        const { nisn, status, updatedAt } = e?.detail || {};
        if (!nisn || !status) return;
        setRows((prev) =>
          prev.map((r) =>
            r.nisn === String(nisn)
              ? {
                  ...r,
                  status: String(status).toUpperCase(),
                  updatedAt: updatedAt ?? r.updatedAt,
                }
              : r
          )
        );
      } catch {}
    }
    window.addEventListener("ptk:status-changed", onStatusChanged);
    return () => window.removeEventListener("ptk:status-changed", onStatusChanged);
  }, []);

  /* ====== Pencarian (client-side) untuk TABEL ====== */
  const displayedRows = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      return (
        r.nisn?.toString().toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s) ||
        (r.registrationLevel || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  /* ====== Ringkasan (pakai GLOBAL TOTALS) ====== */
  const summaryNode = useMemo(() => {
    if (summaryMode === "PENDAPATAN") {
      return `Total Pendapatan: ${fmtIDR(globalTotals.totalPendapatan)}${globalLoading ? " · menghitung…" : ""}`;
    }
    if (summaryMode === "TUNGGAKAN") {
      return `Total Tunggakan: ${fmtIDR(globalTotals.totalTunggakan)}${globalLoading ? " · menghitung…" : ""}`;
    }
    return (
      <>
        Orang —{" "}
        <span className="text-emerald-700 font-semibold">Lunas: {globalTotals.countLunas}</span> •{" "}
        <span className="text-amber-800 font-semibold">Nunggak: {globalTotals.countNunggak}</span>
        {globalLoading ? " · menghitung…" : ""}
      </>
    );
  }, [summaryMode, globalTotals, globalLoading]);

  const nextMode = useCallback((m) => {
    if (m === "PENDAPATAN") return "TUNGGAKAN";
    if (m === "TUNGGAKAN") return "ORANG";
    return "PENDAPATAN";
  }, []);

  /* ====== Modal Saudara ====== */
  const [sibOpen, setSibOpen] = useState(false);
  const [sibTitle, setSibTitle] = useState("");
  const [sibList, setSibList] = useState([]); // [{name, jenjang, class, _placeholder?}]

  const openSiblingModal = useCallback((row) => {
    try {
      const x = row?.snap?.data?.() || {};
      const list = extractSiblingsList(x);
      setSibTitle(`${row?.name || "-"} • ${row?.nisn || ""}`);
      setSibList(list);
      setSibOpen(true);
    } catch {
      setSibTitle(`${row?.name || "-"} • ${row?.nisn || ""}`);
      setSibList([]);
      setSibOpen(true);
    }
  }, []);

  /* ====== UI ====== */
  const baseIndex = pageIndex * pageSize;

  return (
    <>
      {/* Filter Lunas/Belum + Search + Summary */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
          {[
            { k: "ALL", label: "Semua" },
            { k: "LUNAS", label: "Lunas" },
            { k: "BELUM", label: "Belum" },
          ].map((it) => (
            <button
              key={it.k}
              type="button"
              onClick={() => setPayFilter(it.k)}
              className={[
                "px-3 py-1.5 text-xs font-semibold",
                payFilter === it.k ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
              ].join(" ")}
            >
              {it.label}
            </button>
          ))}
        </div>

        {/* Pencarian */}
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari NISN / Nama / Jenjang"
          className="ml-2 w-[220px] md:w-[280px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />

        {/* Ringkasan (klik untuk ganti mode) */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSummaryMode((m) => nextMode(m))}
            className={[
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold border transition",
              summaryMode === "PENDAPATAN"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : summaryMode === "TUNGGAKAN"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-sky-300 bg-sky-50 text-sky-900",
            ].join(" ")}
            title="Klik untuk mengubah ringkasan (Pendapatan → Tunggakan → Orang)"
          >
            {summaryNode}
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr className="text-left text-slate-900">
              {["No.", "NISN", "Nama", "Jenjang", "Saudara", "Status", "Tunggakan", "Bukti", "Catatan"].map((h) => (
                <th key={h} className="px-4 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6">
                  <div className="inline-flex items-center gap-2 text-slate-800">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data…
                  </div>
                </td>
              </tr>
            ) : displayedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-800">Tidak ada data.</td>
              </tr>
            ) : (
              displayedRows.map((r, idx) => {
                const isApproved = r.status === "APPROVED";
                const isPending = r.status === "PENDING";
                const nomor = baseIndex + idx + 1;
                const hasSibling = (r._sibCount || 0) > 0;
                return (
                  <tr
                    key={`${r.nisn}-${idx}`}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => onRowSelect?.(r)}
                  >
                    <td className="px-4 py-2 text-right tabular-nums text-slate-900">{nomor}</td>
                    <td className="px-4 py-2 font-bold text-slate-900">{r.nisn}</td>
                    <td className="px-4 py-2 text-slate-900">{r.name}</td>
                    <td className="px-4 py-2 text-slate-900">{r.registrationLevel}</td>

                    {/* Saudara */}
                    <td className="px-4 py-2">
                      {hasSibling ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openSiblingModal(r); }}
                          className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100"
                          title="Klik untuk melihat detail saudara"
                        >
                          Ada ({r._sibCount})
                        </button>
                      ) : (
                        <span className="text-xs text-slate-700">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          isApproved
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : isPending
                            ? "bg-amber-50 border-amber-300 text-amber-800"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}
                        title={r.discountAmount > 0 ? (r.discountNote || "Ketentuan PTK diterapkan") : undefined}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="px-4 py-2">
                      {r.tunggakan > 0 ? (
                        <span
                          className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"
                          title={`Tunggakan: ${fmtIDR(r.tunggakan)}`}
                        >
                          {fmtIDR(r.tunggakan)}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                          title="Sudah lunas"
                        >
                          LUNAS
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2">
                      <div
                        className={[
                          "inline-flex items-center gap-1.5",
                          r.hasPendingProof ? "text-amber-800" : "text-slate-700",
                        ].join(" ")}
                        title={r.hasPendingProof ? "Ada bukti menunggu konfirmasi" : "Tidak ada bukti pending"}
                      >
                        <span className="text-[12px] font-semibold">{r.totalBukti ?? 0} bukti</span>
                      </div>
                    </td>

                    <td className="px-4 py-2">
                      {hasSibling ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openSiblingModal(r); }}
                          className="inline-flex items-center text-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100"
                          title="Klik untuk melihat detail saudara"
                        >
                          PTK Bersaudara ({r._sibCount})
                        </button>
                      ) : (
                        <span className="text-xs text-slate-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setCursorDoc(null);
            setPageIndex(0);
            fetchTablePage("first");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          disabled={pageIndex === 0 || loading}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        <div className="text-xs text-slate-800">Page {pageIndex + 1}</div>

        <button
          type="button"
          onClick={() => fetchTablePage("next")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 text-black disabled:opacity-60"
          disabled={!hasNext || loading}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ====== Modal Detail Saudara ====== */}
      {sibOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSibOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Data Saudara</div>
                <div className="text-xs text-slate-600">{sibTitle}</div>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                {sibList.length === 0 ? (
                  <p className="text-sm text-slate-700">Tidak ada data saudara.</p>
                ) : (
                  <div className="space-y-3">
                    {sibList.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500 mb-1">Saudara #{idx + 1}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <div className="text-[11px] text-slate-500">Nama</div>
                            <div className="text-sm font-semibold text-slate-900">
                              {s.name || (s._placeholder ? "(belum diisi)" : "-")}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Jenjang</div>
                            <div className="text-sm font-semibold text-slate-900">
                              {s.jenjang || (s._placeholder ? "(belum diisi)" : "-")}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Kelas</div>
                            <div className="text-sm font-semibold text-slate-900">
                              {s.class ? `Kelas ${s.class}` : (s._placeholder ? "(belum diisi)" : "-")}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSibOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
