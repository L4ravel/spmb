"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Maximize2, X, ChevronDown, ChevronUp } from "lucide-react";
import { fmtIDR, fetchStatistikDaful } from "../data";

// formatter ringkas: Rp 13,9 jt / Rp 1,5 M
function fmtIDRShort(n = 0) {
  const v = Number(n) || 0;
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  if (v >= 1_000) return `Rp ${Math.round(v / 1_000)} rb`;
  return fmtIDR(v);
}
const pct = (num = 0, den = 0) => {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  if (d <= 0) return 0;
  return (n / d) * 100;
};

// ⬇️ filter data per tanggal berdasar sinceDays; anchor = tanggal terakhir di data
function filterBySinceDays(rows = [], sinceDays = 3650) {
  if (!rows?.length || !Number.isFinite(sinceDays)) return rows || [];
  if (sinceDays >= 3650) return rows; // Full
  const last = rows[rows.length - 1];
  const lastDate = new Date(last?.date || Date.now());
  const cut = new Date(lastDate);
  cut.setDate(cut.getDate() - (sinceDays - 1)); // inklusif N hari terakhir
  return rows.filter((r) => {
    const dt = new Date(r?.date || 0);
    return dt >= cut && dt <= lastDate;
  });
}

/**
 * props:
 *  - db: Firestore client (wajib untuk Per Jenjang)
 *  - data: Array<{ date:'YYYY-MM-DD', amount:number }>  // mini chart Per Tanggal
 */
export default function TrendMini({ db, data = [] }) {
  const [isFull, setIsFull] = useState(false);
  const [range, setRange] = useState("30d");      // '1d' | '7d' | '30d' | 'full'
  const [view, setView]   = useState("tanggal");  // 'tanggal' | 'jenjang'

  // dataset Per Jenjang: 'nonptk' | 'ptk' | 'total'
  const [dsType, setDsType] = useState("nonptk");
  const nextDsType = useCallback(() => {
    setDsType((s) => (s === "nonptk" ? "ptk" : s === "ptk" ? "total" : "nonptk"));
  }, []);

  // ringkasan di luar bar
  const [showSummary, setShowSummary] = useState(false);

  // tabel detail + persen
  const [showTable, setShowTable] = useState(false);
  const toggleTable = useCallback(() => setShowTable((s) => !s), []);

  const openFull  = useCallback(() => setIsFull(true), []);
  const closeFull = useCallback(() => setIsFull(false), []);

  useEffect(() => {
    if (!isFull) return;
    const onKey = (e) => e.key === "Escape" && closeFull();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFull, closeFull]);

  const sinceDays = useMemo(() => {
    if (range === "1d") return 1;
    if (range === "7d") return 7;
    if (range === "30d") return 30;
    return 3650; // Full
  }, [range]);

  // ================== MINI: Per Tanggal (harian) + RANGE FILTER ==================
  const dataRanged = useMemo(() => filterBySinceDays(data, sinceDays), [data, sinceDays]);
  const amounts = useMemo(() => dataRanged.map((d) => Number(d.amount || 0)), [dataRanged]);
  const maxBar = useMemo(() => Math.max(1, ...amounts), [amounts]);
  const grandTotal = useMemo(() => amounts.reduce((a, b) => a + (b || 0), 0), [amounts]);

  const BarsTanggal = ({ h = "h-28", w = "w-6", gap = "gap-1", topPad = 16 }) => (
    <div className={`flex items-end ${gap} overflow-visible relative`} style={{ paddingTop: topPad }}>
      {dataRanged.map((d, i) => {
        const amt = amounts[i]; // nilai harian
        const hp = Math.round((amt / maxBar) * 100);
        const minPx = amt > 0 ? 2 : 0;
        return (
          <div key={d.date ?? i} className={`flex flex-col items-center ${w} overflow-visible`}>
            <div
              className={`relative w-full ${h} flex items-end overflow-visible`}
              title={`${d.date ?? ""} • Harian: ${fmtIDR(amt)}`}
            >
              {amt > 0 && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-semibold text-slate-900 whitespace-nowrap select-none pointer-events-none"
                  style={{ bottom: `calc(${hp}% + ${minPx}px + 6px)` }}
                >
                  {fmtIDRShort(amt)}
                </span>
              )}
              <div
                className="w-full rounded-t-md bg-emerald-500/80 shadow-sm"
                style={{ height: `calc(${hp}% + ${minPx}px)`, maxHeight: "100%" }}
                aria-label={`Harian ${fmtIDR(amt)}`}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-600 whitespace-nowrap">
              {(d.date ?? "").slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ================== FULL: Per Jenjang (3 batang per jenjang – tampilan tetap) ==================
  const [jenjangTotal, setJenjangTotal] = useState([]);
  const [jenjangNonPTK, setJenjangNonPTK] = useState([]);
  const [jenjangPTK, setJenjangPTK] = useState([]);
  const [loadingJenjang, setLoadingJenjang] = useState(false);
  const [errJenjang, setErrJenjang] = useState("");

  useEffect(() => {
    let abort = false;
    async function run() {
      if (!isFull || view !== "jenjang" || !db) return;
      try {
        setLoadingJenjang(true);
        setErrJenjang("");
        const res = await fetchStatistikDaful(db, { sinceDays });
        if (abort) return;
        setJenjangTotal(res?.byJenjang || []);
        setJenjangNonPTK(res?.byJenjangNonPTK || []);
        setJenjangPTK(res?.byJenjangPTK || []);
      } catch (e) {
        if (!abort) setErrJenjang(e?.message || "Gagal memuat data per jenjang.");
      } finally {
        if (!abort) setLoadingJenjang(false);
      }
    }
    run();
    return () => { abort = true; };
  }, [db, isFull, view, sinceDays]);

  // Pilih sumber rows aktif berdasar dsType; jika kosong → fallback ke total
  const activeRows = useMemo(() => {
    const dropTotalRow = (arr) => (arr || []).filter((r) => (r?.jenjang ?? "").toUpperCase() !== "TOTAL");
    if (dsType === "nonptk" && jenjangNonPTK.length) return dropTotalRow(jenjangNonPTK);
    if (dsType === "ptk" && jenjangPTK.length) return dropTotalRow(jenjangPTK);
    return dropTotalRow(jenjangTotal);
  }, [dsType, jenjangTotal, jenjangNonPTK, jenjangPTK]);

  // Agregasi ringkasan per label (Non-PTK / PTK / Total)
  const sumRows = useCallback((rows = []) => {
    let pendapatan = 0, tunggakan = 0;
    for (const r of rows) {
      const name = (r?.jenjang || "").toUpperCase();
      if (name === "TOTAL") continue;
      pendapatan += Number(r?.pendapatan || 0);
      tunggakan += Number(r?.tunggakan || 0);
    }
    return { pendapatan, tunggakan, potensi: pendapatan + tunggakan };
  }, []);
  const summaryNonPTK = useMemo(() => (jenjangNonPTK.length ? sumRows(jenjangNonPTK) : null), [jenjangNonPTK, sumRows]);
  const summaryPTK    = useMemo(() => (jenjangPTK.length    ? sumRows(jenjangPTK)    : null), [jenjangPTK, sumRows]);
  const summaryTotal  = useMemo(() => sumRows(jenjangTotal), [jenjangTotal, sumRows]);

  // Bentuk grup 3 bar (Tunggakan, Diterima, Potensi) — HANYA nominal
  const groups = useMemo(() => {
    return (activeRows || []).map((r) => {
      const pend = Number(r?.pendapatan || 0);
      const tung = Number(r?.tunggakan || 0);
      const potensiMoney = pend + tung;
      return {
        name: r?.jenjang || "?",
        values: [
          { k: "tunggakan",  label: "Tunggakan", valMoney: tung,                 color: "bg-amber-500",   text: "text-amber-900" },
          { k: "pendapatan", label: "Diterima",  valMoney: pend,                 color: "bg-emerald-500", text: "text-emerald-900" },
          { k: "potensi",    label: "Potensi",   valMoney: potensiMoney,         color: "bg-violet-500",  text: "text-violet-900" },
        ],
      };
    }).filter((g) => g.values.some((v) => v.valMoney > 0));
  }, [activeRows]);

  // Skala tinggi bar
  const maxVal = useMemo(() => {
    let m = 1;
    for (const g of groups) for (const v of g.values) {
      const val = v.valMoney;
      if (val > m) m = val;
    }
    return m;
  }, [groups]);

  // Kalkulasi total untuk dataset aktif (untuk tabel persen TOTAL)
  const totals = useMemo(() => {
    let tunggakan = 0, pendapatan = 0, potensi = 0;
    for (const g of groups) {
      const tung = g.values.find((v) => v.k === "tunggakan")?.valMoney || 0;
      const pend = g.values.find((v) => v.k === "pendapatan")?.valMoney || 0;
      const pot  = g.values.find((v) => v.k === "potensi")?.valMoney || 0;
      tunggakan += tung;
      pendapatan += pend;
      potensi += pot;
    }
    return { tunggakan, pendapatan, potensi };
  }, [groups]);

  const BarsJenjangGrouped = ({
    hPx = 450,
    barW = "w-8 md:w-10",
    gapGroup = "gap-12 md:gap-16",
    gapBar = "gap-2.5 md:gap-3",
  }) => (
    <>
      {/* === PANEL RINGKASAN (di luar bar; bisa disembunyikan/ditampilkan) === */}
      <div className="mx-auto mb-4 w-full max-w-5xl">
        <button
          type="button"
          onClick={() => setShowSummary((s) => !s)}
          className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
          title="Tampilkan/sembunyikan ringkasan Non-PTK, PTK, dan Total"
        >
          <span>Ringkasan Non-PTK, PTK &amp; Total</span>
          {showSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showSummary && (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-2 font-bold">Label</th>
                  <th className="px-4 py-2 font-bold">Total Tunggakan</th>
                  <th className="px-4 py-2 font-bold">Total Pendapatan</th>
                  <th className="px-4 py-2 font-bold">Potensi</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-2 font-semibold text-slate-800">Non-PTK</td>
                  <td className="px-4 py-2">{summaryNonPTK ? fmtIDR(summaryNonPTK.tunggakan)  : "—"}</td>
                  <td className="px-4 py-2">{summaryNonPTK ? fmtIDR(summaryNonPTK.pendapatan) : "—"}</td>
                  <td className="px-4 py-2">{summaryNonPTK ? fmtIDR(summaryNonPTK.potensi)    : "—"}</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-2 font-semibold text-slate-800">PTK</td>
                  <td className="px-4 py-2">{summaryPTK ? fmtIDR(summaryPTK.tunggakan)  : "—"}</td>
                  <td className="px-4 py-2">{summaryPTK ? fmtIDR(summaryPTK.pendapatan) : "—"}</td>
                  <td className="px-4 py-2">{summaryPTK ? fmtIDR(summaryPTK.potensi)    : "—"}</td>
                </tr>
                <tr className="border-t border-slate-200 bg-emerald-50/40">
                  <td className="px-4 py-2 font-bold text-slate-900">Total (Keduanya)</td>
                  <td className="px-4 py-2 font-semibold">{fmtIDR(summaryTotal.tunggakan)}</td>
                  <td className="px-4 py-2 font-semibold">{fmtIDR(summaryTotal.pendapatan)}</td>
                  <td className="px-4 py-2 font-bold text-emerald-700">{fmtIDR(summaryTotal.potensi)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tombol toggle tabel detail */}
      <div className="mb-4 text-center">
        <button
          type="button"
          onClick={toggleTable}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
        >
          <span className="text-sm font-semibold text-slate-700">
            {showTable ? "Sembunyikan" : "Tampilkan"} Tabel Detail
          </span>
          <span className="text-slate-600">{showTable ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* === TABEL DETAIL DENGAN PERSENTASE === */}
      {showTable && (
        <div className="mb-6 overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-300">
                <thead className="bg-gradient-to-r from-slate-700 to-slate-600">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-bold text-white">Jenjang</th>
                    <th className="px-3 py-3.5 text-right text-sm font-bold text-white">Tunggakan</th>
                    <th className="px-3 py-3.5 text-right text-sm font-bold text-white">Diterima</th>
                    <th className="px-3 py-3.5 text-right text-sm font-bold text-white">Potensi</th>
                    <th className="px-3 py-3.5 text-right text-sm font-bold text-white">% Diterima</th>
                    <th className="px-3 py-3.5 text-right text-sm font-bold text-white">% Nunggak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {groups.map((g, idx) => {
                    const tung = g.values.find((v) => v.k === "tunggakan")?.valMoney || 0;
                    const pend = g.values.find((v) => v.k === "pendapatan")?.valMoney || 0;
                    const pot  = g.values.find((v) => v.k === "potensi")?.valMoney || 0;
                    const pPend = pct(pend, pot);
                    const pTung = pct(tung, pot);

                    return (
                      <tr key={g.name} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-semibold text-slate-900">
                          {g.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-amber-700 font-medium">
                          {fmtIDR(tung)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-emerald-700 font-medium">
                          {fmtIDR(pend)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-violet-700 font-medium">
                          {fmtIDR(pot)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold">
                            {pPend.toFixed(1)}%
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-amber-700 font-semibold">
                            {pTung.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Row Total */}
                  <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-t-2 border-slate-300">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-slate-900">
                      TOTAL
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-amber-800">
                      {fmtIDR(totals.tunggakan)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-emerald-800">
                      {fmtIDR(totals.pendapatan)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-violet-800">
                      {fmtIDR(totals.potensi)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-extrabold text-emerald-800">
                      {pct(totals.pendapatan, totals.potensi).toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-extrabold text-amber-800">
                      {pct(totals.tunggakan, totals.potensi).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Info dataset */}
            <div className="mt-3 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Dataset Aktif:</span>{" "}
                {dsType === "nonptk" ? "Non-PTK" : dsType === "ptk" ? "PTK" : "Total (PTK + Non-PTK)"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Klik batang grafik untuk mengganti dataset dan melihat breakdown data yang berbeda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mx-auto mb-6 px-6 py-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-6 rounded-full bg-amber-500 shadow-sm" />
            <span className="font-semibold text-slate-700">Tunggakan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-6 rounded-full bg-emerald-500 shadow-sm" />
            <span className="font-semibold text-slate-700">Diterima</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-6 rounded-full bg-violet-500 shadow-sm" />
            <span className="font-semibold text-slate-700">Potensi</span>
          </div>
          <div className="h-6 w-px bg-slate-300" />
          <div className="px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-700">
              Dataset: {dsType === "nonptk" ? "Non-PTK" : dsType === "ptk" ? "PTK" : "Total"}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-fit min-w-full overflow-x-auto overflow-y-visible pb-6" style={{ paddingTop: 60 }}>
        <div className={`mx-auto flex items-end justify-center gap-12 md:gap-16 relative`} style={{ height: 450 }}>
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col items-center relative">
              <div className={`flex items-end gap-2.5 md:gap-3`} style={{ height: 450 - 40 }}>
                {g.values.map((v) => {
                  const raw = v.valMoney;
                  if (raw <= 0) return null;
                  const hp = Math.max(2, Math.round((raw / maxVal) * 100));
                  const label = fmtIDRShort(raw);
                  const barHeightPx = ((450 - 40) * hp) / 100;

                  return (
                    <div key={`${g.name}-${v.k}`} className={`relative w-8 md:w-10`} style={{ height: 450 - 40 }}>
                      {/* Label nominal selalu di atas bar */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                        style={{ bottom: `${barHeightPx + 4}px` }}
                      >
                        <div className={`px-2 py-1 rounded-md bg-white shadow-md border-2 ${v.text} border-current/20 whitespace-nowrap`}>
                          <span className="text-[10px] md:text-xs font-bold leading-none">{label}</span>
                        </div>
                      </div>

                      {/* Bar (klik = ganti dataset Non-PTK → PTK → Total) */}
                      <button
                        type="button"
                        onClick={nextDsType}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer group focus:outline-none transition-all duration-200 w-full"
                        style={{ height: `${hp}%`, minHeight: '8px' }}
                        title={`${g.name} • ${v.label} • ${fmtIDR(raw)}\nKlik batang untuk ganti dataset (Non-PTK → PTK → Total)`}
                      >
                        <div
                          className={`w-full h-full ${v.color} rounded-t-lg shadow-lg transition-all duration-200 group-hover:shadow-xl group-hover:brightness-110`}
                          aria-label={`${g.name} • ${v.label} • ${label}`}
                        />
                        <div
                          className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${v.color} rounded-t-lg opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-200 w-full h-full`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Label jenjang (tetap) */}
              <div className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-200 shadow-sm">
                <span className="text-xs md:text-sm font-bold text-slate-800 whitespace-nowrap">
                  {g.name}
                </span>
              </div>
            </div>
          ))}
          {!groups.length && (
            <div className="text-base text-slate-500 py-8">Tidak ada data untuk ditampilkan.</div>
          )}
        </div>
      </div>

      {/* Footer tips */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-blue-600">💡</span>
          <span className="text-xs md:text-sm text-blue-800 font-medium">
            Klik batang untuk mengganti dataset: <b>Non-PTK</b> → <b>PTK</b> → <b>Total</b>
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* MINI VIEW */}
      <div className="w-full overflow-x-auto py-2 relative">
        {!!dataRanged.length ? (
          <>
            <button
              type="button"
              onClick={openFull}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openFull()}
              className="absolute right-0 top-0 z-10 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
              title="Perbesar ke layar penuh"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full Layar
            </button>
            {/* Bar harian (terfilter sesuai range) */}
            <BarsTanggal h="h-28" w="w-6" gap="gap-1" topPad={16} />
            <div className="mt-2 text-[12px] text-slate-600">Total {fmtIDR(grandTotal)}</div>
          </>
        ) : (
          <div className="text-sm text-slate-600">Tidak ada data.</div>
        )}
      </div>

      {/* FULLSCREEN */}
      {isFull && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closeFull}>
          <div
            className="absolute inset-4 md:inset-10 rounded-2xl bg-white shadow-2xl border border-slate-200 p-4 md:p-6 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-gradient-to-b from-violet-600 to-violet-400 rounded-full" />
                <h2 className="text-base md:text-lg font-bold text-slate-900">Tren Pendapatan</h2>
              </div>
              <div className="ml-auto" />
              <button
                type="button"
                onClick={closeFull}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                title="Tutup (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  { k: "1d", t: "1 hari" },
                  { k: "7d", t: "7 hari" },
                  { k: "30d", t: "30 hari" },
                  { k: "full", t: "Full" },
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() => setRange(o.k)}
                    className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                      range === o.k 
                        ? "bg-violet-600 text-white shadow-sm" 
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  { k: "tanggal", t: "Per Tanggal" },
                  { k: "jenjang", t: "Per Jenjang" },
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() => setView(o.k)}
                    className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                      view === o.k 
                        ? "bg-violet-600 text-white shadow-sm" 
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>

            {/* Area grafik */}
            <div className="w-full">
              {view === "tanggal" ? (
                <div className="overflow-x-auto">
                  <BarsTanggal h="h-[55vh]" w="w-8 md:w-10" gap="gap-2" topPad={24} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {loadingJenjang && <div className="text-sm text-slate-600">Memuat data per jenjang…</div>}
                  {errJenjang &&   <div className="text-sm text-rose-600">{errJenjang}</div>}
                  {!loadingJenjang && !errJenjang && <BarsJenjangGrouped />}
                  {!db && <div className="text-xs text-amber-700 mt-2">DB belum dipassing ke TrendMini.</div>}
                </div>
              )}
            </div>

            {/* Footer total */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200">
                <span className="text-sm font-semibold text-slate-700">Total Periode:</span>
                <span className="text-base font-bold text-emerald-700">{fmtIDR(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
