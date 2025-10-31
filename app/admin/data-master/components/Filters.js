"use client";

import { PAGE_SIZE } from "../lib/utils";

export default function Filters({
  levels,
  levelsLoading,
  filterLevel, setFilterLevel,
  filterIncome, setFilterIncome,
  filterParents, setFilterParents,
  filterStatus, setFilterStatus,
  search, setSearch,
  pageIndex, viewLength, hasNext, loading, err,
  onPrev, onNext,
  onExport, exporting,
}) {
  return (
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

        {/* Penghasilan Ortu (gabungan) */}
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
          Halaman <b>{pageIndex + 1}</b> • Baris: <b>{viewLength}</b> / {PAGE_SIZE}
          {err ? <span className="ml-2 text-rose-600">{err}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={pageIndex === 0 || loading}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
          >
            ← Kembali
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext || loading}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
          >
            Berikutnya →
          </button>

          <button
            onClick={onExport}
            disabled={exporting}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            title="Download semua data PPDB sebagai .xls"
          >
            {exporting ? "Menyiapkan…" : "Download .XLS (semua)"}
          </button>
        </div>
      </div>
    </div>
  );
}
