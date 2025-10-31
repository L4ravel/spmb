// app/admin/statistik-daftar-ulang/page.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Info, Loader2, Maximize2, X, RotateCw } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, orderBy, limit as fbLimit, query,
} from "firebase/firestore";
import { listUsersWithPaymentPage } from "../data-daftar-ulang/data/firestore";

/* ========= Helpers ========= */
const up = (v) => (v ?? "").toString().trim().toUpperCase();
const normPTK = (v) => {
  const s = up(v);
  if (["APPROVED","VERIFIED","ACCEPTED","CONFIRMED"].includes(s)) return "APPROVED";
  if (["REJECTED","DENIED","DECLINED"].includes(s)) return "REJECTED";
  return s || "PENDING";
};
const fmtIDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function pickDocKeys(r) {
  const cands = [r?.id, r?.docId, r?.username, r?.uid, r?.userId, r?.NIS, r?.NISN, r?.nisn]
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean);
  return Array.from(new Set(cands));
}

async function prefetchMetaForKeys(keys, cache) {
  const unique = Array.from(new Set(keys)).filter(Boolean);
  const missing = unique.filter((k) => !cache.has(k));
  if (missing.length === 0) return cache;

  await Promise.all(
    missing.map(async (k) => {
      let fd = "";
      let ptkApproved = false;
      try {
        const [userDoc, ptkDoc] = await Promise.all([
          getDoc(doc(db, "users_app", k)),
          getDoc(doc(db, "users_app", k, "ptk_confirmation", "current")),
        ]);
        if (userDoc.exists()) fd = up(userDoc.data()?.finalDecision);
        if (ptkDoc.exists())  ptkApproved = normPTK(ptkDoc.data()?.status) === "APPROVED";
      } catch {}
      cache.set(k, { fd, ptkApproved });
    })
  );

  const needFd = missing.filter((k) => !cache.get(k)?.fd);
  const CONCURRENCY = 6;
  for (let i = 0; i < needFd.length; i += CONCURRENCY) {
    const slice = needFd.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (k) => {
        try {
          const qref = query(
            collection(db, "users_app", k, "finalDecision"),
            orderBy("finalDecidedAt", "desc"),
            fbLimit(1)
          );
          const snap = await getDocs(qref);
          if (!snap.empty) {
            const fd = up(snap.docs[0].data()?.finalDecision);
            const prev = cache.get(k) || { fd: "", ptkApproved: false };
            cache.set(k, { ...prev, fd });
          }
        } catch {}
      })
    );
  }
  return cache;
}

async function enrichBatch(rows, cache) {
  const allKeys = rows.flatMap((r) => pickDocKeys(r));
  await prefetchMetaForKeys(allKeys, cache);
  return rows.map((r) => {
    const keys = pickDocKeys(r);
    let fd = up(r?.finalDecision);
    let ptkApproved = false;
    for (const k of keys) {
      const m = cache.get(k);
      if (!m) continue;
      if (!fd && m.fd) fd = m.fd;
      if (m.ptkApproved) ptkApproved = true;
      if (fd && ptkApproved) break;
    }
    return { ...r, __finalDecision: fd, __ptkApproved: !!ptkApproved };
  });
}

const isRowPTK     = (r) => !!r.__ptkApproved;
const isRowNonPTK  = (r) => !r.__ptkApproved && up(r.__finalDecision) === "LULUS";
const isRowValid   = (r) => isRowPTK(r) || isRowNonPTK(r);
const isLunas      = (r) => Number(r?.tunggakan || 0) <= 0 && Number(r?.kewajibanTotal || 0) > 0;

/* ========= Page ========= */
export default function StatistikDaftarUlangPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [jenjang, setJenjang] = useState("all");
  const [dataset, setDataset] = useState("total"); // 'total' | 'nonptk' | 'ptk'
  const [allRows, setAllRows] = useState([]);
  const metaCacheRef = useRef(new Map());
  const [scanLimit] = useState(10000);
  const [pageFetchSize] = useState(200);
  const [trendFull, setTrendFull] = useState(false);

  // mode batang di Full Layar: pendapatan -> tunggakan -> potensi
  const [barMode, setBarMode] = useState("pendapatan");
  const cycleMode = () =>
    setBarMode((m) => (m === "pendapatan" ? "tunggakan" : m === "tunggakan" ? "potensi" : "pendapatan"));

  const reload = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const cache = metaCacheRef.current;
      let local = [];
      let cursor = null;
      let safety = 0;
      const SAFETY_LIMIT = 200;
      while (local.length < scanLimit && safety < SAFETY_LIMIT) {
        safety += 1;
        const res = await listUsersWithPaymentPage({ pageSize: pageFetchSize, cursor });
        const batch = res?.list || [];
        if (!batch.length) break;
        const enriched = await enrichBatch(batch, cache);
        local = local.concat(enriched);
        cursor = res?.lastDoc || null;
        if (!cursor) break;
      }
      setAllRows(local);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Gagal memuat statistik.");
    } finally {
      setLoading(false);
    }
  }, [pageFetchSize, scanLimit]);

  useEffect(() => { reload(); }, [reload]);

  const effectiveRows = useMemo(() => {
    const byJenjang = allRows.filter((r) => jenjang === "all" || r?.level === jenjang);
    if (dataset === "ptk")    return byJenjang.filter(isRowPTK);
    if (dataset === "nonptk") return byJenjang.filter(isRowNonPTK);
    return byJenjang.filter(isRowValid);
  }, [allRows, jenjang, dataset]);

  const agg = useMemo(() => {
    let countPTK = 0, countNonPTK = 0, countLunas = 0, countNunggak = 0;
    let totalTunggakan = 0, totalPendapatan = 0, totalTagihan = 0;
    for (const r of effectiveRows) {
      if (isRowPTK(r)) countPTK++; else countNonPTK++;
      const tunggakan = Number(r?.tunggakan || 0);
      const tagihan   = Number(r?.kewajibanTotal || 0);
      const pendapatan = Math.max(tagihan - tunggakan, 0);
      totalTagihan += tagihan;
      totalTunggakan += Math.max(tunggakan, 0);
      totalPendapatan += pendapatan;
      if (isLunas(r)) countLunas++; else countNunggak++;
    }
    return {
      countPTK, countNonPTK, countLunas, countNunggak,
      totalTagihan, totalPendapatan, totalTunggakan,
      potensi: totalPendapatan + totalTunggakan,
      totalRows: effectiveRows.length,
    };
  }, [effectiveRows]);

  const rekapJenjang = useMemo(() => {
    const map = new Map();
    for (const r of effectiveRows) {
      const j = r?.level || "UNKNOWN";
      const o = map.get(j) || {
        jenjang: j, pendapatan: 0, tunggakan: 0, potensi: 0,
        count: 0, lunas: 0, nunggak: 0,
      };
      const tunggakan = Number(r?.tunggakan || 0);
      const tagihan   = Number(r?.kewajibanTotal || 0);
      const pendapatan = Math.max(tagihan - tunggakan, 0);
      o.pendapatan += pendapatan;
      o.tunggakan  += Math.max(tunggakan, 0);
      o.potensi     = o.pendapatan + o.tunggakan;
      o.count      += 1;
      if (isLunas(r)) o.lunas += 1; else o.nunggak += 1;
      map.set(j, o);
    }
    return Array.from(map.values());
  }, [effectiveRows]);

  const trendByJenjang = useMemo(() => {
    const max = Math.max(1, ...rekapJenjang.map((r) => r.pendapatan));
    return rekapJenjang
      .map((r) => ({ jenjang: r.jenjang, pendapatan: r.pendapatan, ratio: r.pendapatan / max }))
      .sort((a,b) => b.pendapatan - a.pendapatan);
  }, [rekapJenjang]);

  const maxPotensi = useMemo(() => Math.max(1, ...rekapJenjang.map(r => r.potensi)), [rekapJenjang]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg md:text-xl font-bold text-slate-900">Statistik Daftar Ulang</h1>

        <div className="ml-auto" />

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { k: "nonptk", t: "Non-PTK" },
            { k: "ptk", t: "PTK" },
            { k: "total", t: "Total" },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setDataset(o.k)}
              className={`px-3 py-1.5 text-xs md:text-sm rounded-md font-medium transition-all ${
                dataset === o.k ? "bg-violet-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="text-slate-700">Jenjang</span>
          <select
            value={jenjang}
            onChange={(e) => setJenjang(e.target.value)}
            className="bg-white text-slate-900 text-sm focus:outline-none"
          >
            {["all", ...Array.from(new Set(allRows.map((r) => r?.level).filter(Boolean))).sort()]
              .map((j) => <option key={j} value={j}>{j === "all" ? "Semua" : j}</option>)}
          </select>
        </div>

        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </button>
      </div>

           {loading ? (
        <div className="inline-flex items-center gap-2 text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Menghitung statistik…
        </div>
      ) : err ? (
        <div className="text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">{err}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <Card tone="emerald" title={`Total Pendapatan (${dataset})`} value={fmtIDR(agg.totalPendapatan)} />
            <Card tone="amber"  title={`Total Tunggakan (${dataset})`}  value={fmtIDR(agg.totalTunggakan)} />
            <Card tone="violet" title={`Potensi (${dataset})`}         value={fmtIDR(agg.potensi)} />
            <Card tone="sky"     title="Total Data"        value={agg.totalRows} number />
            <Card tone="emerald" title="Lunas (Orang)"     value={agg.countLunas} number />
            <Card tone="amber"   title="Nunggak (Orang)"   value={agg.countNunggak} number />
          </div>

          {/* Tren kecil (tetap) */}
          <div className="rounded-2xl border border-slate-300 overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900 flex items-center">
              <span>Tren Pendapatan (per Jenjang)</span>
              <button
                type="button"
                onClick={() => setTrendFull(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Maximize2 className="h-4 w-4" />
                Full layar
              </button>
            </div>
            <div className="p-4 space-y-2">
              {trendByJenjang.length === 0 ? (
                <div className="text-sm text-slate-600">Belum ada data.</div>
              ) : (
                trendByJenjang.map((it) => (
                  <div key={it.jenjang} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-semibold text-slate-900">{it.jenjang}</div>
                    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-emerald-500/80"
                        style={{ width: `${Math.max(2, Math.round(it.ratio * 100))}%` }}
                        title={fmtIDR(it.pendapatan)}
                      />
                    </div>
                    <div className="w-[160px] text-right text-xs font-semibold text-slate-900 tabular-nums">
                      {fmtIDR(it.pendapatan)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* === MODAL FULLSCREEN: BAR CLUSTER DI TENGAH & KLIK GANTI MODE === */}
          {trendFull && (
            <div className="fixed inset-0 z-[100]">
              <div className="absolute inset-0 bg-black/60" onClick={() => setTrendFull(false)} />
              <div className="absolute inset-4 md:inset-10 rounded-2xl bg-white shadow-2xl border border-slate-300 overflow-hidden flex flex-col">
                {/* header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center">
                  <div className="text-sm md:text-base font-bold text-slate-900">Tren Pendapatan (per Jenjang) — Full Layar</div>
                  <div className="ml-4 text-xs md:text-sm text-slate-700 flex items-center gap-3">
                    <Legend />
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      Mode: <b className="text-slate-900 capitalize">{barMode}</b>
                    </span>
                    <button
                      onClick={cycleMode}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                      title="Ganti mode (Pendapatan → Tunggakan → Potensi)"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Ganti
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrendFull(false)}
                    className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    title="Tutup"
                  >
                    <X className="h-4 w-4" />
                    Tutup
                  </button>
                </div>

                {/* konten: area chart ditengah */}
                <div className="flex-1 px-4 md:px-6 py-2 flex flex-col">
                  <div className="text-xs text-slate-600 mb-2">
                    Klik salah satu batang untuk mengganti mode: <b>Pendapatan</b> → <b>Tunggakan</b> → <b>Potensi</b>.
                  </div>

                  {/* AREA CHART TERPUSAT DAN LEBIH MEPET */}
                  <div className="flex-1 flex items-end justify-center pb-8">
                    {rekapJenjang.length === 0 ? (
                      <div className="text-sm text-slate-600">Belum ada data.</div>
                    ) : (
                      <div className="flex flex-col items-center justify-end">
                        {/* Container bar yang mepet */}
                        <div className="inline-flex items-end justify-center gap-2 md:gap-3">
                          {rekapJenjang
                            .slice()
                            .sort((a, b) => b.potensi - a.potensi)
                            .map((r) => (
                              <JenjangSingleBar
                                key={r.jenjang}
                                r={r}
                                mode={barMode}
                                max={maxPotensi}
                                onClick={cycleMode}
                              />
                            ))}
                        </div>
                        {/* baseline global */}
                        <div className="mt-2 h-0.5 bg-slate-200 rounded" style={{ width: `${rekapJenjang.length * 75}px` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rekap tabel */}
          <div className="rounded-2xl border border-slate-300 overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900">
              Rekap per Jenjang
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-slate-300">
                    {["Jenjang","Pendapatan","Tunggakan","Potensi","Lunas","Nunggak","Total"].map((h, i) => (
                      <th
                        key={h}
                        className={[
                          "px-4 py-2",
                          "text-slate-900 text-xs md:text-sm font-bold uppercase tracking-wide",
                          i === 0 ? "text-left" : "text-right",
                        ].join(" ")}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rekapJenjang.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-slate-800 text-sm">Belum ada data.</td>
                    </tr>
                  ) : (
                    rekapJenjang.map((r, idx) => (
                      <tr
                        key={r.jenjang}
                        className={[
                          "border-b border-slate-200",
                          idx % 2 === 1 ? "bg-slate-50/70" : "bg-white",
                          "hover:bg-slate-100/80 transition-colors",
                        ].join(" ")}
                      >
                        <td className="px-4 py-2 text-left font-semibold text-slate-900">{r.jenjang}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums font-semibold">{fmtIDR(r.pendapatan)}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums">{fmtIDR(r.tunggakan)}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums">{fmtIDR(r.potensi)}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums">{r.lunas}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums">{r.nunggak}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums font-semibold">{r.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-slate-800">
            Komposisi dataset — PTK: <b>{agg.countPTK}</b> • Non-PTK: <b>{agg.countNonPTK}</b>
          </div>
        </>
      )}
    </div>
  );
}

/* ====== Komponen UI ====== */
function Card({ title, value, tone = "slate", number = false }) {
  const toneMap = {
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900",
    amber:   "from-amber-50 to-amber-100 border-amber-200 text-amber-900",
    violet:  "from-violet-50 to-violet-100 border-violet-200 text-violet-900",
    sky:     "from-sky-50 to-sky-100 border-sky-200 text-sky-900",
    slate:   "from-slate-50 to-slate-100 border-slate-200 text-slate-900",
  }[tone] || "from-slate-50 to-slate-100 border-slate-200 text-slate-900";

  return (
    <div className={`bg-gradient-to-br rounded-lg p-3 border ${toneMap}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
      <div className="text-2xl font-bold mt-1">{number ? value : value}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs md:text-sm text-slate-700">
      <span className="inline-flex items-center gap-2"><i className="h-3 w-6 rounded bg-emerald-500/90 inline-block" /> Pendapatan</span>
      <span className="inline-flex items-center gap-2"><i className="h-3 w-6 rounded bg-amber-500/90 inline-block" /> Tunggakan</span>
      <span className="inline-flex items-center gap-2"><i className="h-3 w-6 rounded bg-violet-500/90 inline-block" /> Potensi</span>
    </div>
  );
}

function JenjangSingleBar({ r, mode, max, onClick }) {
  const value =
    mode === "pendapatan" ? r.pendapatan :
    mode === "tunggakan"  ? r.tunggakan  :
    r.potensi;

  const color =
    mode === "pendapatan" ? "bg-emerald-500/90" :
    mode === "tunggakan"  ? "bg-amber-500/90"   :
    "bg-violet-500/90";

  const heightPct = Math.max(6, Math.round((value / Math.max(1, max)) * 100));

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-end min-w-[65px] md:min-w-[75px] focus:outline-none"
      title="Klik untuk ganti mode"
    >
      <div className="text-[11px] md:text-xs font-semibold text-slate-900 tabular-nums mb-1">{fmtIDR(value)}</div>
      {/* Tinggi track diperbesar agar batang lebih tinggi */}
      <div className="h-96 md:h-[28rem] w-9 md:w-11 rounded-t-md bg-slate-100 flex items-end">
        <div className={`${color} w-full rounded-t-md`} style={{ height: `${heightPct}%` }} />
      </div>
      <div className="mt-1 text-[10px] md:text-xs text-slate-700 text-center leading-tight">{r.jenjang}</div>
    </button>
  );
}