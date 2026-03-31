"use client";

import { useNilaiTahfidzLogic } from "./logika-tahfidz";

export default function PageNilaiTahfid() {
  const {
    // state
    graderId,
    pageSize, setPageSize,
    levelFilter, setLevelFilter,
    search, setSearch,
    deductBig, setDeductBig,
    deductSmall, setDeductSmall,
    examinerName, setExaminerName,

    items, pageIndex, hasNext, loading, levels, errMsg,
    rowsState, saving,

    pageOptions,
    filtered,
    isLoggedIn,

    // handlers
    fetchPage, onNext, onPrev, incErr, setField, saveRow,

    // utils
    getNisn, getName,

    // global search
    qBusy,

    // saved
    savedMap,
  } = useNilaiTahfidzLogic();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 w-full px-4 md:px-6 lg:px-8 py-8">
        {/* Header + meta */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Penilaian Al-Qur&apos;an
            </h1>
            <p className="text-sm text-slate-600 mt-1">Sistem penilaian tahfidz siswa</p>
          </div>
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white shadow-sm border border-slate-200">
            <div className="text-xs text-slate-600">
              Halaman <span className="font-bold text-slate-800">{pageIndex + 1}</span>
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            <div className="text-xs text-slate-600">
              Baris <span className="font-bold text-slate-800">{filtered.length}</span> / {pageSize}
            </div>
          </div>
        </div>

        {errMsg && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {errMsg}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {/* Filter & Search */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Filter & Pencarian</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="flex-1 min-w-[120px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
              >
                {levels.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="flex-1 min-w-[120px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
              >
                {pageOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}/halaman
                  </option>
                ))}
              </select>

              <button
                onClick={() => fetchPage(0)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                title="Muat ulang halaman pertama"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NISN / Nama…"
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
              />
            </div>

            {qBusy && (
              <div className="mt-2 text-xs text-slate-500">Mencari di semua data…</div>
            )}
          </div>

          {/* Konfigurasi Poin */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Konfigurasi Poin</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-700 mb-2 font-medium">Kesalahan Besar</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-600 font-bold">−</span>
                  <input
                    type="number"
                    min={0}
                    value={deductBig}
                    onChange={(e) => setDeductBig(Number(e.target.value || 0))}
                    className="w-full rounded-xl border border-rose-200 pl-7 pr-3 py-2.5 text-slate-800 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 transition-all"
                  />
                </div>
              </label>
              <label className="text-sm">
                <span className="block text-slate-700 mb-2 font-medium">Kesalahan Kecil</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">−</span>
                  <input
                    type="number"
                    min={0}
                    value={deductSmall}
                    onChange={(e) => setDeductSmall(Number(e.target.value || 0))}
                    className="w-full rounded-xl border border-amber-200 pl-7 pr-3 py-2.5 text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Identitas Penguji */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Identitas Penguji</h3>
            </div>
            
            <label className="block text-sm">
              <span className="text-slate-700 mb-2 block font-medium">Nama Penguji</span>
              <input
                value={examinerName}
                onChange={(e) => setExaminerName(e.target.value)}
                placeholder="cth: Ust. Ahmad / Ustd. Fatimah"
                className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all ${isLoggedIn ? "bg-slate-50" : ""}`}
                readOnly={isLoggedIn}
                title={isLoggedIn ? "Terisi dari akun login" : "Bisa diisi jika belum login"}
              />
            </label>
          </div>
        </div>

        {/* ======= View: Mobile Cards (<md) ======= */}
        <div className="space-y-4 md:hidden">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="h-6 w-1/3 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-4 h-24 w-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          )}
          {!loading &&
            filtered.map((u, idx) => {
              const nisn = getNisn(u);
              const nm = getName(u);
              const state = rowsState[nisn]; // sudah diprefill dari dokumen kalau ada
              const absoluteNo = pageIndex * pageSize + (idx + 1);
              const savingState = saving[nisn] || "";
              const saved = savedMap[nisn] === true;

              return (
                <div
                  key={nisn || u.id}
                  className={`rounded-2xl border bg-white p-5 shadow-lg shadow-slate-100/70 hover:shadow-xl hover:shadow-slate-200/70 transition-all ${saved ? "border-emerald-300" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-white text-sm font-bold mb-2">
                        {absoluteNo}
                      </div>
                      <div className="font-bold text-lg text-slate-900">{nm}</div>
                      <div className="font-mono text-sm text-slate-700 font-medium">{nisn}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-block px-2 py-1 rounded-lg bg-slate-100 text-xs text-slate-700 font-medium">
                          {u.registrationLevel || "-"}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${saved ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200"}`}>
                          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: saved ? "#059669" : "#9CA3AF" }}></span>
                          {saved ? "Tersimpan" : "Belum disimpan"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => saveRow(u)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-emerald-700 active:scale-95 shadow-lg shadow-emerald-200 transition-all"
                    >
                      {savingState === "saving"
                        ? "Menyimpan…"
                        : savingState === "saved"
                        ? "✓ Tersimpan"
                        : savingState === "error"
                        ? "⚠ Gagal"
                        : "Simpan"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <label className="text-xs">
                      <span className="block text-slate-700 mb-1.5 font-medium">Skor</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={state?.score ?? 100}
                        onChange={(e) => setField(nisn, "score", Number(e.target.value || 0))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                      />
                    </label>

                    <label className="text-xs">
                      <span className="block text-slate-700 mb-1.5 font-medium">Hafalan (Juz)</span>
                      <input
                        type="number"
                        min={0}
                        value={state?.memorizedCount ?? 0}
                        onChange={(e) => setField(nisn, "memorizedCount", Number(e.target.value || 0))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                        placeholder="20"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={() => incErr(nisn, "big")}
                      aria-label={`Kurangi ${deductBig} poin (kesalahan besar)`}
                      className="flex items-center justify-center h-11 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-lg font-bold text-white active:scale-95 shadow-lg shadow-rose-200 hover:from-rose-600 hover:to-rose-700 transition-all"
                      title={`Kurangi ${deductBig} poin`}
                    >
                      −{deductBig}
                    </button>

                    <button
                      onClick={() => incErr(nisn, "small")}
                      aria-label={`Kurangi ${deductSmall} poin (kesalahan kecil)`}
                      className="flex items-center justify-center h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-lg font-bold text-white active:scale-95 shadow-lg shadow-amber-200 hover:from-amber-600 hover:to-amber-700 transition-all"
                      title={`Kurangi ${deductSmall} poin`}
                    >
                      −{deductSmall}
                    </button>
                  </div>

                  <label className="block text-xs">
                    <span className="text-slate-700 mb-1.5 block font-medium">Rekomendasi</span>
                    <select
                      value={state?.recommendation ?? ""}
                      onChange={(e) => setField(nisn, "recommendation", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                    >
                      <option value="">Pilih...</option>
                      <option value="LULUS">✓ Lulus</option>
                      <option value="TIDAK_LULUS">✗ Tidak Lulus</option>
                    </select>
                  </label>
                </div>
              );
            })}
          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">Tidak ada data siswa</p>
            </div>
          )}
        </div>

        {/* ======= View: Desktop Table (md+) ======= */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100/70">
            <div className="overflow-x-auto">
              <table className="min-w-[1150px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="px-4 py-4 text-left font-bold w-16">No</th>
                    <th className="px-4 py-4 text-left font-bold w-32">NISN</th>
                    <th className="px-4 py-4 text-left font-bold">Nama</th>
                    <th className="px-4 py-4 text-left font-bold">Level</th>
                    <th className="px-4 py-4 text-left font-bold w-36">Status</th>
                    <th className="px-4 py-4 text-left font-bold w-28">Skor</th>
                    <th className="px-4 py-4 text-left font-bold w-32">Hafalan (Juz)</th>
                    <th className="px-4 py-4 text-left font-bold w-32">Kesalahan Besar</th>
                    <th className="px-4 py-4 text-left font-bold w-32">Kesalahan Kecil</th>
                    <th className="px-4 py-4 text-left font-bold w-36">Rekomendasi</th>
                    <th className="px-4 py-4 text-left font-bold w-32">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8">
                        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((u, idx) => {
                      const nisn = getNisn(u);
                      const nm = getName(u);
                      const state = rowsState[nisn];
                      const absoluteNo = pageIndex * pageSize + (idx + 1);
                      const savingState = saving[nisn] || "";
                      const saved = savedMap[nisn] === true;

                      return (
                        <tr
                          key={nisn || u.id}
                          className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${saved ? "bg-emerald-50/[0.15]" : ""}`}
                        >
                          <td className="px-4 py-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white text-sm font-bold flex items-center justify-center">
                              {absoluteNo}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-slate-700 font-semibold">{nisn}</td>
                          <td className="px-4 py-4 text-slate-900 font-medium">{nm}</td>
                          <td className="px-4 py-4">
                            <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs">
                              {u.registrationLevel || "-"}
                            </span>
                          </td>

                          {/* STATUS BADGE */}
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset ${saved ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: saved ? "#059669" : "#9CA3AF" }}></span>
                              {saved ? "Tersimpan" : "Belum disimpan"}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={state?.score ?? 100}
                              onChange={(e) => setField(nisn, "score", Number(e.target.value || 0))}
                              className="w-20 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                            />
                          </td>

                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min={0}
                              value={state?.memorizedCount ?? 0}
                              onChange={(e) => setField(nisn, "memorizedCount", Number(e.target.value || 0))}
                              className="w-20 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                              placeholder="20"
                            />
                          </td>

                          <td className="px-4 py-4">
                            <button
                              onClick={() => incErr(nisn, "big")}
                              aria-label={`Kurangi ${deductBig} poin (kesalahan besar)`}
                              className="inline-flex h-9 min-w-[70px] items-center justify-center rounded-xl
                                      bg-gradient-to-r from-rose-500 to-rose-600 px-4 text-lg font-bold text-white shadow-lg shadow-rose-200
                                      active:scale-95 hover:from-rose-600 hover:to-rose-700 transition-all"
                              title={`Kurangi ${deductBig} poin`}
                            >
                              −{deductBig}
                            </button>
                          </td>

                          <td className="px-4 py-4">
                            <button
                              onClick={() => incErr(nisn, "small")}
                              aria-label={`Kurangi ${deductSmall} poin (kesalahan kecil)`}
                              className="inline-flex h-9 min-w-[70px] items-center justify-center rounded-xl
                                      bg-gradient-to-r from-amber-500 to-amber-600 px-4 text-lg font-bold text-white shadow-lg shadow-amber-200
                                      active:scale-95 hover:from-amber-600 hover:to-amber-700 transition-all"
                              title={`Kurangi ${deductSmall} poin`}
                            >
                              −{deductSmall}
                            </button>
                          </td>

                          <td className="px-4 py-4">
                            <select
                              value={state?.recommendation ?? ""}
                              onChange={(e) => setField(nisn, "recommendation", e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-medium text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                            >
                              <option value="">Pilih...</option>
                              <option value="LULUS">✓ Lulus</option>
                              <option value="TIDAK_LULUS">✗ Tidak Lulus</option>
                            </select>
                          </td>

                          <td className="px-4 py-4">
                            <button
                              onClick={() => saveRow(u)}
                              className="rounded-xl bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 active:scale-95 shadow-lg shadow-blue-200 transition-all"
                            >
                              {savingState === "saving"
                                ? "Simpan…"
                                : savingState === "saved"
                                ? "✓ Tersimpan"
                                : savingState === "error"
                                ? "⚠ Gagal"
                                : "Simpan"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td className="px-4 py-12 text-center" colSpan={11}>
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <p className="text-slate-600 font-medium">Tidak ada data siswa</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pager */}
        <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-600">Halaman</span>
            <span className="font-bold text-slate-800">{pageIndex + 1}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onPrev}
              disabled={pageIndex === 0 || loading}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext || loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-blue-200"
            >
              Berikutnya
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
