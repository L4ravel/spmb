"use client";

import { displayNisn, fmtDurationSince, getAyahNama, pickWhatsApp } from "../lib/utils";

export default function TableView({
  view,
  loading,
  filterStatus,
  onOpenDetail,
  onDeleteAll,
  deletingId,
  onOpenEdit, // ⬅️ opsional: jika ada, tombol Edit muncul
}) {
  return (
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
            <th className="w-48 px-3 py-2 text-left">Aksi</th>
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
              <tr key={`${r._id ?? r.nisn ?? 'row'}-${i}`} className={i % 2 ? "bg-slate-50/40" : "bg-white"}>
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2 font-mono">{displayNisn(r)}</td>
                <td className="px-3 py-2">{r.nama || "-"}</td>
                <td className="px-3 py-2">{r._regLevel || r.jenjang || "-"}</td>
                <td className="px-3 py-2">{getAyahNama(r)}</td>
                <td className="px-3 py-2">{pickWhatsApp(r)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onOpenDetail(r)}
                      className="rounded bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Detail
                    </button>

                    {/* Tombol Edit opsional */}
                    {typeof onOpenEdit === "function" && (
                      <button
                        onClick={() => onOpenEdit(r)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50"
                        title="Edit data (users_app & ppdb)"
                      >
                        Edit
                      </button>
                    )}

                    {filterStatus === "UNPAID" && r._unpaidEmpty === true && (
                      <>
                        <button
                          onClick={() => onDeleteAll(r)}
                          disabled={deletingId === String(r._id || r.nisn)}
                          className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          title="Hapus keseluruhan data peserta ini (khusus yang belum bayar)"
                        >
                          {deletingId === String(r._id || r.nisn) ? "Menghapus…" : "Delete"}
                        </button>
                        <span className="text-[11px] text-amber-700">
                          <b>{fmtDurationSince(r.createdAt)}</b>
                        </span>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
