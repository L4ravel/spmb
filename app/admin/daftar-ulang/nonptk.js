// nonptk.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where,
} from "firebase/firestore";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

/* ================= Helpers ================= */
function normalizeStatus(pLike) {
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
async function getTotalFeeByLabel(db, label, cacheRef) {
  if (!label) return 0;
  const key = String(label);
  if (cacheRef.current.has(key)) return cacheRef.current.get(key);

  let total = 0;
  try {
    const qref = query(collection(db, "re_registration_fees"), where("label", "==", label), limit(1));
    const snap = await getDocs(qref);
    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      const spp = Number(data?.spp ?? 0);
      let uangPangkal = 0;
      const up = data?.uangPangkal;
      if (typeof up === "number") uangPangkal = up;
      else if (up && typeof up === "object") {
        uangPangkal = Object.values(up).reduce((acc, v) => acc + (Number(v) || 0), 0);
      }
      total = (Number(spp) || 0) + (Number(uangPangkal) || 0);
    }
  } catch {
    total = 0;
  }
  cacheRef.current.set(key, total);
  return total;
}
async function getApprovedSumAndMeta(db, nisn) {
  try {
    const qref = query(
      collection(db, "users_app", nisn, "payments"),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const snap = await getDocs(qref);
    let sum = 0;
    let count = 0;
    let hasPending = false;
    let latestCreatedAt = 0;

    for (const d of snap.docs) {
      count += 1;
      const x = d.data() || {};
      const st = normalizeStatus(x);
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

/* ================= Component ================= */
export function NonPTKPanel({ db, jenjangFilter, pageSize = 10, onRowSelect }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // paging
  const [cursorDoc, setCursorDoc] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // filter status bayar (UI tetap)
  const [payFilter, setPayFilter] = useState("ALL"); // ALL | LUNAS | BELUM
  // pencarian (client-side enhanced)
  const [q, setQ] = useState("");

  // ringkasan toggle
  const [summaryMode, setSummaryMode] = useState("PENDAPATAN"); // PENDAPATAN | TUNGGAKAN | ORANG

  // ====== GLOBAL TOTALS (SELURUH DATA LULUS) ======
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

  /* ========== Query kandidat dari users_app (finalDecision == "LULUS") ========== */
  const fetchUsersLulusChunk = useCallback(
    async (startCursor, want = 50) => {
      const conds = [where("finalDecision", "==", "LULUS")];
      if (jenjangFilter) conds.push(where("registrationLevel", "==", jenjangFilter));

      let qref = query(collection(db, "users_app"), ...conds, orderBy("fullName"), limit(want + 1));
      if (startCursor) {
        qref = query(
          collection(db, "users_app"),
          ...conds,
          orderBy("fullName"),
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
    [db, jenjangFilter]
  );

  /* ====== Enrich untuk baris TABEL ====== */
  const enrichForTable = useCallback(
    async (userDocs) => {
      const res = [];

      const CONC = 10;
      const chunks = [];
      for (let i = 0; i < userDocs.length; i += CONC) chunks.push(userDocs.slice(i, i + CONC));

      for (const chunk of chunks) {
        const works = chunk.map(async (uDoc) => {
          const nisn = uDoc.id;
          const u = uDoc.data() || {};
          const level = u?.registrationLevel || "-";

          // exclude anak PTK APPROVED
          try {
            const ptkDoc = await getDoc(doc(db, "users_app", nisn, "ptk_confirmation", "current"));
            if (ptkDoc.exists()) {
              const st = ptkDoc.data()?.status;
              if (normalizeStatus({ status: st }) === "approved") return null;
            }
          } catch {
            // ignore
          }

          const totalFee = await getTotalFeeByLabel(db, level, feeCacheRef);
          const { sumApproved, totalDocs, hasPending, latestCreatedAt } = await getApprovedSumAndMeta(db, nisn);
          const tunggakan = Math.max((Number(totalFee) || 0) - (Number(sumApproved) || 0), 0);
          const isLunas = (Number(totalFee) || 0) > 0 && tunggakan === 0;

          return {
            nisn,
            name: u?.fullName || u?.nama || u?.name || "-",
            registrationLevel: level,
            keterangan: isLunas ? "LUNAS" : "TIDAK LUNAS",
            tunggakan,
            totalTagihan: Number(totalFee) || 0,
            sumApproved,
            totalBukti: totalDocs,
            hasPendingProof: !!hasPending,
            latestCreatedAt,
          };
        });
        const out = await Promise.all(works);
        for (const r of out) if (r) res.push(r);
      }

      // sort konsisten
      res.sort((a, b) => {
        if (a.hasPendingProof !== b.hasPendingProof) return Number(b.hasPendingProof) - Number(a.hasPendingProof);
        if (a.latestCreatedAt !== b.latestCreatedAt) return (b.latestCreatedAt || 0) - (a.latestCreatedAt || 0);
        return (a.name || "").localeCompare(b.name || "", "id");
      });

      // filter LUNAS/BELUM untuk tabel (hanya tampilan)
      let out = res;
      if (payFilter === "LUNAS") out = out.filter((r) => r.keterangan === "LUNAS");
      if (payFilter === "BELUM") out = out.filter((r) => r.keterangan !== "LUNAS");
      return out;
    },
    [db, payFilter]
  );

  /* ====== Pengambilan data tabel (fill-until-page) + SEARCH-AWARE ====== */
  const fetchTablePage = useCallback(
    async (mode = "first") => {
      setLoading(true);
      try {
        let localCursor = mode === "next" ? cursorDoc : null;
        let collected = [];
        let safety = 0;
        let reachedEnd = false;

        // saring helper untuk q
        const s = q.trim().toLowerCase();
        const matchQ = (r) => {
          if (!s) return true; // tanpa q, semua valid
          return (
            r.nisn?.toString().toLowerCase().includes(s) ||
            (r.name || "").toLowerCase().includes(s) ||
            (r.registrationLevel || "").toLowerCase().includes(s)
          );
        };

        // loop ambil chunk sampai baris valid (matchQ) >= pageSize atau data habis
        while (collected.length < pageSize && safety < 100) {
          safety += 1;
          const { docs, nextCur, hasMore } = await fetchUsersLulusChunk(localCursor, pageSize);
          if (!docs.length) {
            reachedEnd = true;
            break;
          }
          const enriched = await enrichForTable(docs);
          const filtered = s ? enriched.filter(matchQ) : enriched;

          // gabung dan dedupe by NISN
          for (const r of filtered) {
            if (!collected.some((x) => x.nisn === r.nisn)) collected.push(r);
            if (collected.length >= pageSize) break;
          }

          localCursor = nextCur;
          if (!hasMore) {
            reachedEnd = true;
            break;
          }
        }

        setRows(collected.slice(0, pageSize));
        setPageIndex((p) => (mode === "first" ? 0 : p + 1));
        setCursorDoc(localCursor);
        setHasNext(!reachedEnd);
      } finally {
        setLoading(false);
      }
    },
    [cursorDoc, pageSize, fetchUsersLulusChunk, enrichForTable, q]
  );

  /* ====== GLOBAL TOTALS (seluruh data LULUS) ====== */
  const computeGlobalTotals = useCallback(
    async () => {
      setGlobalLoading(true);
      setGlobalTotals((s) => ({ ...s, done: false, scanned: 0 }));

      const conds = [where("finalDecision", "==", "LULUS")];
      if (jenjangFilter) conds.push(where("registrationLevel", "==", jenjangFilter));

      let next = null;
      const PAGE = 100;
      let totalTunggakan = 0;
      let totalPendapatan = 0;
      let totalTagihan = 0;
      let countLunas = 0;
      let countNunggak = 0;
      let scanned = 0;

      const CONC = 20;
      try {
        while (true) {
          let qref = query(collection(db, "users_app"), ...conds, orderBy("fullName"), limit(PAGE));
          if (next) qref = query(collection(db, "users_app"), ...conds, orderBy("fullName"), startAfter(next), limit(PAGE));

          const snap = await getDocs(qref);
          if (snap.empty) break;

          const docs = snap.docs;
          const chunks = [];
          for (let i = 0; i < docs.length; i += CONC) chunks.push(docs.slice(i, i + CONC));

          for (const chunk of chunks) {
            const works = chunk.map(async (uDoc) => {
              const nisn = uDoc.id;
              const u = uDoc.data() || {};
              const level = u?.registrationLevel || "-";

              // exclude PTK APPROVED
              try {
                const ptkDoc = await getDoc(doc(db, "users_app", nisn, "ptk_confirmation", "current"));
                if (ptkDoc.exists()) {
                  const st = ptkDoc.data()?.status;
                  if (normalizeStatus({ status: st }) === "approved") return null;
                }
              } catch {}

              const tagihan = await getTotalFeeByLabel(db, level, feeCacheRef);
              const { sumApproved } = await getApprovedSumAndMeta(db, nisn);
              const tunggakan = Math.max((Number(tagihan) || 0) - (Number(sumApproved) || 0), 0);
              const lunas = (Number(tagihan) || 0) > 0 && tunggakan === 0;

              return {
                tagihan: Number(tagihan) || 0,
                pendapatan: Number(sumApproved) || 0,
                tunggakan,
                lunas,
              };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, jenjangFilter, payFilter, q]); // ← q ditambahkan

  useEffect(() => {
    computeGlobalTotals();
  }, [computeGlobalTotals]);

  /* ====== Pencarian ditampilkan (sudah relevan dari fetch) ====== */
  const displayedRows = rows;

  /* ====== Ringkasan: GLOBAL TOTALS ====== */
  const summaryNode = useMemo(() => {
    if (summaryMode === "PENDAPATAN") {
      return `Total Pendapatan: ${fmtIDR(globalTotals.totalPendapatan)}${
        globalLoading ? " · menghitung…" : ""
      }`;
    }
    if (summaryMode === "TUNGGAKAN") {
      return `Total Tunggakan: ${fmtIDR(globalTotals.totalTunggakan)}${
        globalLoading ? " · menghitung…" : ""
      }`;
    }
    return (
      <>
        Orang —{" "}
        <span className="text-emerald-700 font-semibold">Lunas: {globalTotals.countLunas}</span>{" "}
        •{" "}
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

  /* ================== UI (Hanya tambah kolom Nomor di kiri) ================== */
  const baseIndex = pageIndex * pageSize;

  return (
    <>
      {/* Filter + Search + Ringkasan */}
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

        {/* Ringkasan toggle */}
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
              <th className="px-4 py-2 font-semibold w-12">No.</th>
              <th className="px-4 py-2 font-semibold">NISN</th>
              <th className="px-4 py-2 font-semibold">Nama</th>
              <th className="px-4 py-2 font-semibold">Jenjang</th>
              <th className="px-4 py-2 font-semibold">Tunggakan</th>
              <th className="px-4 py-2 font-semibold">Bukti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6">
                  <div className="inline-flex items-center gap-2 text-slate-800">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data…
                  </div>
                </td>
              </tr>
            ) : displayedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-800">Tidak ada data.</td>
              </tr>
            ) : (
              displayedRows.map((r, idx) => {
                const isLunas = r.keterangan === "LUNAS";
                const nomor = baseIndex + idx + 1;
                return (
                  <tr
                    key={`${r.nisn}-${idx}`}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => onRowSelect?.(r)}
                  >
                    <td className="px-4 py-2 text-slate-900 text-right tabular-nums">{nomor}</td>
                    <td className="px-4 py-2 font-bold text-slate-900">{r.nisn}</td>
                    <td className="px-4 py-2 text-slate-900">{r.name}</td>
                    <td className="px-4 py-2 text-slate-900">{r.registrationLevel}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          isLunas
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border-amber-300 text-amber-800"
                        }`}
                        title={!isLunas ? `Tunggakan: ${fmtIDR(r.tunggakan)}` : "Sudah lunas"}
                      >
                        {isLunas ? "LUNAS" : `${fmtIDR(r.tunggakan)}`}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={[
                          "text-xs font-semibold",
                          r.hasPendingProof ? "text-amber-800" : "text-slate-700",
                        ].join(" ")}
                        title={r.hasPendingProof ? "Ada bukti menunggu konfirmasi" : "Tidak ada bukti pending"}
                      >
                        {r.totalBukti ?? 0} bukti
                      </span>
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
    </>
  );
}
