// app/admin/geografi/page.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronRight, RefreshCw, Maximize2, X } from "lucide-react";
import { listUsersPage } from "./data/firestore";
import {
  useRegionDictionaries,
  useEnsureDistrictsForRows,
  provNameOf,
  regNameOf,
  distNameOf,
} from "./lib/regions";
import Filters from "./components/Filters";
import StatsCards from "./components/StatsCards";
import GeoTopTables from "./components/GeoTopTables";
import StudentsTable from "./components/StudentsTable";

export default function AdminGeografiPage() {
  // === Toggle tampilan: 'rekap' | 'murni' | 'grafik'
  const [mode, setMode] = useState("rekap");

  // === Grafik states
  const [chartTab, setChartTab] = useState("jenjang"); // 'jenjang'|'prov'|'reg'|'dist'|'addr'
  const [topN, setTopN] = useState(10);
  const [chartFull, setChartFull] = useState(false);

  // === Paging
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);

  // === Filters
  const [provinceCode, setProvinceCode] = useState("");
  const [regencyCode, setRegencyCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);

  // === Kamus wilayah (lazy districts)
  const region = useRegionDictionaries();
  useEnsureDistrictsForRows(rows, region);

  const reload = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const res = await listUsersPage({ pageSize, cursor: reset ? null : cursorRef.current });
      if (reset) setRows(res.list);
      else setRows((s) => [...s, ...res.list]);
      cursorRef.current = res.lastDoc || null;
      setHasMore(!!res.lastDoc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    reload(true);
  }, [reload]);

  // === Options dropdown
  const regOpts = useMemo(
    () => (provinceCode ? region.regByProv[provinceCode] || [] : []),
    [provinceCode, region.regByProv]
  );
  const distOpts = useMemo(
    () => (regencyCode ? region.distByReg[regencyCode] || [] : []),
    [regencyCode, region.distByReg]
  );

  // === Filter client-side
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (provinceCode && r.provinceCode !== provinceCode) return false;
      if (regencyCode && r.regencyCode !== regencyCode) return false;
      if (districtCode && r.districtCode !== districtCode) return false;
      if (qSearch) {
        const q = qSearch.toLowerCase();
        const hay = `${r.username} ${r.fullName} ${r.addressLine}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, provinceCode, regencyCode, districtCode, qSearch]);

  // === Agregasi statistik (dasar untuk Rekap & Grafik)
  const stats = useMemo(() => {
    const agg = {
      total: filtered.length,
      byLevel: new Map(),
      byProv: new Map(),
      byReg: new Map(),
      byDist: new Map(),
      byAddr: new Map(),
    };
    for (const r of filtered) {
      const lv = (r.level || "—").toString();
      agg.byLevel.set(lv, (agg.byLevel.get(lv) || 0) + 1);

      const p = r.provinceCode || "";
      const g = r.regencyCode || "";
      const d = r.districtCode || "";
      const al = (r.addressLine || "").trim();

      if (p) agg.byProv.set(p, (agg.byProv.get(p) || 0) + 1);
      if (g) agg.byReg.set(g, (agg.byReg.get(g) || 0) + 1);
      if (d) agg.byDist.set(d, (agg.byDist.get(d) || 0) + 1);

      if (al) {
        const key = al.replace(/\s+/g, " ").toLowerCase().slice(0, 80);
        agg.byAddr.set(key, (agg.byAddr.get(key) || 0) + 1);
      }
    }

    const topN = (map, n = 5) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

    const pct = (n) => (agg.total ? (n / agg.total) * 100 : 0);

    return {
      ...agg,
      topProv: topN(agg.byProv),
      topReg: topN(agg.byReg),
      topDist: topN(agg.byDist),
      topAddr: topN(agg.byAddr, 8),
      pct,
    };
  }, [filtered]);

  // === Helpers Grafik (membentuk dataset berdasarkan tab & topN)
  const chartData = useMemo(() => {
    const T = stats.total || 0;
    const percent = (n) => (T ? ((n / T) * 100).toFixed(1) : "0.0");

    const sortN = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

    if (chartTab === "jenjang") {
      const arr = [...(stats.byLevel || new Map()).entries()].sort((a, b) => b[1] - a[1]);
      return arr.map(([lv, n]) => ({ label: lv, value: n, percent: percent(n) }));
    }
    if (chartTab === "prov") {
      return sortN(stats.byProv || new Map(), topN).map(([code, n]) => ({
        label: region.provMap.get(code) || code,
        value: n,
        percent: percent(n),
      }));
    }
    if (chartTab === "reg") {
      return sortN(stats.byReg || new Map(), topN).map(([code, n]) => ({
        label: region.regMap.get(code) || code,
        value: n,
        percent: percent(n),
      }));
    }
    if (chartTab === "dist") {
      return sortN(stats.byDist || new Map(), topN).map(([code, n]) => ({
        label: region.distMap.get(code) || code,
        value: n,
        percent: percent(n),
      }));
    }
    // addr
    return [...(stats.byAddr || new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([addr, n]) => ({ label: addr, value: n, percent: percent(n) }));
  }, [stats, chartTab, topN, region.provMap, region.regMap, region.distMap]);

  const maxChartVal = useMemo(
    () => Math.max(1, ...chartData.map((d) => d.value || 0)),
    [chartData]
  );

  // === UI: Bar chart sederhana (horizontal)
  const ChartBars = ({ tall = false }) => (
    <div className="space-y-2">
      {chartData.length === 0 && (
        <div className="text-sm text-slate-600">Tidak ada data untuk ditampilkan.</div>
      )}
      {chartData.map((d, i) => {
        const wPct = `${Math.max(2, Math.round((d.value / maxChartVal) * 100))}%`;
        return (
          <div key={`${d.label}:${i}`} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4 md:col-span-3 text-[12px] md:text-sm text-slate-700 truncate" title={d.label}>
              {d.label}
            </div>
            <div className="col-span-6 md:col-span-7">
              <div className={`h-3 md:${tall ? "h-4" : "h-3"} bg-violet-100 rounded-full overflow-hidden`}>
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: wPct }}
                  title={`${d.label} — ${d.value} siswa (${d.percent}%)`}
                  aria-label={`${d.label}: ${d.value} siswa (${d.percent}%)`}
                />
              </div>
            </div>
            <div className="col-span-2 md:col-span-2 text-right font-semibold tabular-nums text-slate-800">
              {d.value} <span className="text-[11px] text-slate-500">({d.percent}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  // === Header
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-7 w-1 rounded bg-gradient-to-b from-violet-600 to-violet-400" />
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Geografi Siswa</h1>
      </div>
      <p className="text-sm text-slate-600">
        Lihat distribusi peserta menurut provinsi, kab/kota, kecamatan, alamat & jenjang. 
      </p>

      {/* Toggle Rekap / Data Murni / Grafik */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {[
          { k: "rekap", t: "Rekap" },
          { k: "murni", t: "Data Murni" },
          { k: "grafik", t: "Grafik" },
        ].map((o) => (
          <button
            key={o.k}
            onClick={() => setMode(o.k)}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
              mode === o.k
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Filters
          provMap={region.provMap}
          regOpts={regOpts}
          distOpts={distOpts}
          provinceCode={provinceCode}
          regencyCode={regencyCode}
          districtCode={districtCode}
          qSearch={qSearch}
          pageSize={pageSize}
          onProvChange={(v) => { setProvinceCode(v); setRegencyCode(""); setDistrictCode(""); }}
          onRegChange={(v) => { setRegencyCode(v); setDistrictCode(""); }}
          onDistrictChange={setDistrictCode}
          onSearch={setQSearch}
          onPageSize={setPageSize}
          loadedCount={rows.length}
        />

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => reload(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title="Muat ulang dari awal"
          >
            <RefreshCw className="h-4 w-4" />
            Muat ulang
          </button>
          <button
            type="button"
            onClick={() => reload(false)}
            disabled={!hasMore || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            Muat lagi
          </button>
        </div>
      </div>

      {/* === Mode: Rekap === */}
      {mode === "rekap" && (
        <>
          <StatsCards
            stats={stats}
            provMap={region.provMap}
            regMap={region.regMap}
            distMap={region.distMap}
          />
          <GeoTopTables
            stats={stats}
            provNameOf={(code) => provNameOf(region.provMap, code)}
            regNameOf={(code) => regNameOf(region.regMap, code)}
            distNameOf={(code) => distNameOf(region.distMap, code)}
          />
        </>
      )}

      {/* === Mode: Data Murni === */}
      {mode === "murni" && (
        <StudentsTable
          rows={filtered}
          provMap={region.provMap}
          regMap={region.regMap}
          distMap={region.distMap}
          loading={loading}
        />
      )}

      {/* === Mode: Grafik === */}
      {mode === "grafik" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          {/* Header grafik + controls */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-slate-900">Visual Geografi</h2>
            <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700">
              Total: {stats.total}
            </span>

            <div className="ml-auto" />

            {/* TopN selector (kecuali jenjang) */}
            {chartTab !== "jenjang" && (
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {[5, 10, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTopN(n)}
                    className={`px-2.5 py-1 text-sm rounded-md font-medium transition-all ${
                      topN === n ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    title={`Top ${n}`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            )}

            {/* Full screen */}
            <button
              type="button"
              onClick={() => setChartFull(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              title="Perbesar ke layar penuh"
            >
              <Maximize2 className="h-4 w-4" />
              Full Layar
            </button>
          </div>

          {/* Tabs Grafik */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { k: "jenjang", t: "Jenjang" },
              { k: "prov", t: "Provinsi" },
              { k: "reg", t: "Kab/Kota" },
              { k: "dist", t: "Kecamatan" },
              { k: "addr", t: "Alamat" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setChartTab(o.k)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                  chartTab === o.k
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>

          {/* Chart area */}
          <div className="space-y-3">
            <ChartBars />
            {/* Tabel ringkas */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-800">
                  <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                    <th>Label</th>
                    <th>Jumlah</th>
                    <th>% dari total</th>
                  </tr>
                </thead>
                <tbody className="text-slate-900">
                  {chartData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-600">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                  {chartData.map((d, i) => (
                    <tr key={`${d.label}:${i}`} className={i % 2 ? "bg-slate-50/50" : ""}>
                      <td className="px-3 py-2 truncate" title={d.label}>{d.label}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{d.value}</td>
                      <td className="px-3 py-2 text-slate-700">{d.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[12px] text-slate-500">
            * Grafik merepresentasikan data setelah filter aktif di atas.
          </div>
        </div>
      )}

  
      {/* === Fullscreen Modal Grafik === */}
      {chartFull && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setChartFull(false)}>
          <div
            className="absolute inset-4 md:inset-10 rounded-2xl bg-white shadow-2xl border border-slate-200 p-4 md:p-6 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-200">
              <div className="h-6 w-1 bg-gradient-to-b from-violet-600 to-violet-400 rounded-full" />
              <h2 className="text-base md:text-lg font-bold text-slate-900">Visual Geografi — Layar Penuh</h2>
              <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700">
                Total: {stats.total}
              </span>
              <div className="ml-auto" />
              <button
                type="button"
                onClick={() => setChartFull(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                title="Tutup (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Controls dalam modal */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  { k: "jenjang", t: "Jenjang" },
                  { k: "prov", t: "Provinsi" },
                  { k: "reg", t: "Kab/Kota" },
                  { k: "dist", t: "Kecamatan" },
                  { k: "addr", t: "Alamat" },
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() => setChartTab(o.k)}
                    className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                      chartTab === o.k
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>

              {chartTab !== "jenjang" && (
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                  {[5, 10, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTopN(n)}
                      className={`px-2.5 py-1 text-sm rounded-md font-medium transition-all ${
                        topN === n ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                      }`}
                      title={`Top ${n}`}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Area grafik tinggi */}
            <div className="space-y-4" style={{ minHeight: "60vh" }}>
              <ChartBars tall />
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                      <th>Label</th>
                      <th>Jumlah</th>
                      <th>% dari total</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-900">
                    {chartData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-600">
                          Tidak ada data.
                        </td>
                      </tr>
                    )}
                    {chartData.map((d, i) => (
                      <tr key={`${d.label}:${i}`} className={i % 2 ? "bg-slate-50/50" : ""}>
                        <td className="px-3 py-2 truncate" title={d.label}>{d.label}</td>
                        <td className="px-3 py-2 font-semibold tabular-nums">{d.value}</td>
                        <td className="px-3 py-2 text-slate-700">{d.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[12px] text-slate-500">
                * Klik di luar panel untuk menutup, atau tombol ✕ di kanan atas.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
