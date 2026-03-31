"use client";

import { buildFilesForNisn, fmtDate, fmtDurationSince, isEmpty } from "../lib/utils";

/**
 * Props:
 * - open, selected, onClose, filterStatus, onDeleteAll, deletingId  (as is)
 * - onOpenEdit?: (row) => void  <-- opsional; jika diberikan, tombol Edit tampil
 */
export default function DetailModal({
  open,
  selected,
  onClose,
  filterStatus,
  onDeleteAll,
  deletingId,
  onOpenEdit, // ⬅️ opsional
}) {
  if (!open || !selected) return null;

  const canDelete = filterStatus === "UNPAID" && selected._unpaidEmpty === true;
  const nisnOrId = String(selected?.nisn || selected?._id || "-");

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute inset-0 flex items-start justify-center overflow-y-auto p-2 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt-0 sm:mt-10 w-full max-w-none sm:max-w-6xl rounded-none sm:rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="text-base md:text-lg font-semibold">
                Detail Peserta — {selected.nama || "-"} ({nisnOrId})
              </h3>
              <p className="text-xs text-slate-600">
                Dibuat: {fmtDate(selected.createdAt)} • Diubah: {fmtDate(selected.updatedAt)}
              </p>
              {selected._unpaidEmpty === true && (
                <p className="text-xs text-amber-700 mt-1">
                  Belum bayar selama <b>{fmtDurationSince(selected.createdAt)}</b>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Tombol Edit opsional */}
              {typeof onOpenEdit === "function" && (
                <button
                  onClick={() => onOpenEdit(selected)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  title="Edit data (users_app & ppdb)"
                >
                  Edit
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => onDeleteAll(selected)}
                  disabled={deletingId === String(selected._id || selected.nisn)}
                  className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  title="Hapus keseluruhan data PPDB (khusus yang belum bayar)"
                >
                  {deletingId === String(selected._id || selected.nisn) ? "Menghapus…" : "Delete semua"}
                </button>
              )}

              <button
                onClick={onClose}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
              >
                Tutup
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(selected).map(([k, v]) => {
                if (k.startsWith("_")) return null;
                if (k === "files" || k === "filesMeta") return null;
                const val =
                  typeof v === "object" && v?.seconds
                    ? fmtDate(v)
                    : typeof v === "object"
                    ? JSON.stringify(v)
                    : String(isEmpty(v) ? "-" : v);
                return (
                  <div key={k} className="rounded border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-600">{k}</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{val}</div>
                  </div>
                );
              })}
            </div>

            {(() => {
              const files = buildFilesForNisn(selected);
              if (files.length === 0) return null;
              return (
                <div className="mt-5">
                  <div className="text-sm font-semibold">Berkas Terunggah</div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {files.map((f) => {
                      const isImg =
                        /^image\//i.test(f.contentType) ||
                        /\.(png|jpe?g|webp|gif)$/i.test(f.url);
                      const isPdf =
                        /^application\/pdf$/i.test(f.contentType) ||
                        /\.pdf($|\?)/i.test(f.url);

                      return (
                        <div
                          key={`${f.key}-${f.url}`}
                          className="rounded-lg border border-slate-200 p-3 bg-white"
                        >
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            {f.key}
                          </div>

                          <div className="mt-2">
                            {isImg ? (
                              <a href={f.url} target="_blank" rel="noreferrer" title={`Buka ${f.key}`}>
                                <img
                                  src={f.url}
                                  alt={f.key}
                                  className="max-h-40 w-auto rounded border border-slate-200 object-contain"
                                  loading="lazy"
                                />
                              </a>
                            ) : isPdf ? (
                              <a href={f.url} target="_blank" rel="noreferrer" title={`Buka ${f.key}`}>
                                <embed
                                  src={f.url}
                                  type="application/pdf"
                                  className="h-40 w-full rounded border border-slate-200"
                                />
                              </a>
                            ) : (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-violet-700 hover:underline break-words inline-block"
                                title={`Buka ${f.key}`}
                              >
                                {f.url}
                              </a>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            {f.contentType ? <span>{f.contentType}</span> : null}
                            {f.size ? <span>• {(Number(f.size) / 1024).toFixed(0)} KB</span> : null}
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50"
                            >
                              Buka
                            </a>
                            <button
                              onClick={() => navigator.clipboard?.writeText(f.url)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50"
                            >
                              Salin URL
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
            {canDelete && (
              <button
                onClick={() => onDeleteAll(selected)}
                disabled={deletingId === String(selected._id || selected.nisn)}
                className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingId === String(selected._id || selected.nisn) ? "Menghapus…" : "Delete semua"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
