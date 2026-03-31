"use client";

import { displayNisn, fmtDurationSince, getAyahNama, pickWhatsApp } from "../lib/utils";

export default function MobileCards({
  view,
  loading,
  filterStatus,
  onOpenDetail,
  onDeleteAll,
  deletingId,
  onOpenEdit, // ⬅️ opsional: jika ada, tombol Edit tampil
}) {
  return (
    <div className="mt-4 -mx-4 sm:mx-0 space-y-3 md:hidden">
      {loading ? (
        <div className="h-16 animate-pulse rounded-none border-y border-slate-200 bg-slate-100" />
      ) : view.length === 0 ? (
        <div className="rounded-none border-y border-slate-200 bg-white p-6 text-center text-slate-600">
          Tidak ada data.
        </div>
      ) : (
        view.map((r, idx) => (
          <div
            key={`${r._id ?? r.nisn ?? "row"}-${idx}`}
            className="rounded-none border-y border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">No {idx + 1}</div>
                <div className="mt-0.5 font-semibold">{r.nama || "-"}</div>
                <div className="font-mono text-sm">{displayNisn(r)}</div>
                <div className="text-xs text-slate-600">{r._regLevel || r.jenjang || "-"}</div>
                {r._unpaidEmpty === true && (
                  <div className="mt-1 text-[11px] text-amber-700">
                    Belum bayar selama <b>{fmtDurationSince(r.createdAt)}</b>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  onClick={() => onOpenDetail(r)}
                  className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
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
                  <button
                    onClick={() => onDeleteAll(r)}
                    disabled={deletingId === String(r._id || r.nisn)}
                    className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    title="Hapus keseluruhan data peserta ini"
                  >
                    {deletingId === String(r._id || r.nisn) ? "Menghapus…" : "Delete semua"}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-500">Ayah</div>
              <div className="text-right">{getAyahNama(r)}</div>
              <div className="text-slate-500">WhatsApp</div>
              <div className="text-right">{pickWhatsApp(r)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
