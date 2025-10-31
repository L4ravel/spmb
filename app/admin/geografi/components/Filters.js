// app/admin/geografi/components/Filters.js
"use client";

function Select({ value, onChange, children, className = "", ...rest }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className={
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm " +
        "focus:outline-none focus-visible:ring-2 " + className
      }
      {...rest}
    >
      {children}
    </select>
  );
}

/**
 * Props baru (opsional) untuk filter per Jenjang:
 * - levelList: string[]   ⇒ contoh: ["ALL", "TK", "SD", "SMP", "SMA"]
 * - levelValue: string    ⇒ contoh: "ALL" | "SMP" | ...
 * - onLevelChange: (val)  ⇒ handler perubahan jenjang
 *
 * Backward-compatible: jika levelList tidak dikirim, dropdown Jenjang disembunyikan.
 */
export default function Filters({
  provMap, regOpts, distOpts,
  provinceCode, regencyCode, districtCode,
  qSearch, pageSize,
  onProvChange, onRegChange, onDistrictChange,
  onSearch, onPageSize, loadedCount,

  // ⬇️ tambahan (opsional)
  levelList, levelValue = "ALL", onLevelChange,
}) {
  const isOther = provinceCode === "OTHER";

  const handleProvChange = (code) => {
    onProvChange?.(code);
    if (code === "OTHER") {
      onRegChange?.("");
      onDistrictChange?.("");
    }
  };

  // Tampilkan kolom Jenjang hanya jika ada levelList dari parent
  const showLevel = Array.isArray(levelList) && levelList.length > 0;

  return (
    <div className={`grid grid-cols-1 ${showLevel ? "md:grid-cols-6" : "md:grid-cols-5"} gap-3`}>
      {/* Jenjang (opsional) */}
      {showLevel && (
        <div className="md:col-span-1">
          <label className="block text-[12px] font-semibold text-slate-700 mb-1">Jenjang</label>
          <Select
            value={levelValue}
            onChange={onLevelChange}
            className="text-slate-900"
            title="Filter data wilayah per jenjang"
          >
            {levelList.map((lv) => (
              <option key={lv} value={lv}>{lv}</option>
            ))}
          </Select>
        </div>
      )}

      {/* Provinsi */}
      <div className="md:col-span-1">
        <label className="block text-[12px] font-semibold text-slate-700 mb-1">Provinsi</label>
        <Select value={provinceCode} onChange={handleProvChange} className="text-slate-900">
          <option value="">— Semua —</option>
          {Array.from(provMap.entries()).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
          <option value="OTHER">Lainnya</option>
        </Select>
      </div>

      {/* Kab/Kota */}
      <div className="md:col-span-1">
        <label className="block text-[12px] font-semibold text-slate-700 mb-1">Kab/Kota</label>
        <Select
          value={isOther ? "" : regencyCode}
          onChange={onRegChange}
          disabled={!provinceCode || isOther}
          className="text-slate-900"
        >
          <option value="">— Semua —</option>
          {regOpts.map((r, idx) => (
            <option key={`${r.code}:${idx}`} value={r.code}>{r.name}</option>
          ))}
        </Select>
      </div>

      {/* Kecamatan */}
      <div className="md:col-span-1">
        <label className="block text-[12px] font-semibold text-slate-700 mb-1">Kecamatan</label>
        <Select
          value={isOther ? "" : districtCode}
          onChange={onDistrictChange}
          disabled={!regencyCode || isOther}
          className="text-slate-900"
        >
          <option value="">— Semua —</option>
          {distOpts.map((d, idx) => (
            <option key={`${d.code}:${idx}`} value={d.code}>{d.name}</option>
          ))}
        </Select>
      </div>

      {/* Search */}
      <div className={showLevel ? "md:col-span-2" : "md:col-span-2"}>
        <label className="block text-[12px] font-semibold text-slate-700 mb-1">
          Cari (nama/username/alamat)
        </label>
        <input
          type="text"
          value={qSearch}
          onChange={(e) => onSearch?.(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2"
          placeholder="Ketik untuk mencari…"
        />
        <div className="mt-1 text-[12px] text-slate-600">Dimuat: {loadedCount}</div>
      </div>

      {/* Baris/halaman */}
      <div className={`${showLevel ? "md:col-span-6" : "md:col-span-5"} flex items-center gap-2 text-sm mt-1`}>
        <span className="text-slate-700">Baris/halaman</span>
        <Select value={pageSize} onChange={onPageSize} className="w-24 text-slate-900">
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </Select>
      </div>
    </div>
  );
}
