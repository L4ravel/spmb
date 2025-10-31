"use client";

export default function ConfirmModal({
  open,
  title = "Selesaikan Ujian?",
  message = "Apakah Anda yakin ingin menyelesaikan ujian? Setelah menekan Selesai, Anda tidak akan bisa mengulang lagi.",
  confirmText = "Ya, Selesaikan",
  cancelText = "Batal",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px] opacity-100"
        onClick={onCancel}
      />
      {/* dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-slate-900">{title}</h3>
          </div>
          <div className="px-5 py-4 text-slate-700">
            {message}
          </div>
          <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-violet-600 text-white px-4 py-2 font-semibold hover:bg-violet-700"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
