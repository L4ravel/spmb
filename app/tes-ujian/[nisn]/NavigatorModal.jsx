"use client";

export default function NavigatorModal({
  open,
  total = 0,
  current = 0,           // index saat ini (0-based)
  answered = {},         // {soalId: indexOpsi}
  ids = [],              // array id soal berurutan
  onGoto,                // (targetIndex: number) => void
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      {/* dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Navigasi Soal</h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-slate-100"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-4">
            {/* legend */}
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
                Belum dijawab
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-violet-100 border border-violet-300" />
                Saat ini
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-100 border border-green-300" />
                Sudah dijawab
              </span>
            </div>

            {/* grid nomor */}
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: total }).map((_, i) => {
                const id = ids[i];
                const isCurrent = i === current;
                const isAnswered = answered[id] !== undefined;
                const base =
                  "h-9 rounded-md text-sm font-semibold border transition focus:outline-none";
                const style = isCurrent
                  ? "bg-violet-100 text-violet-700 border-violet-300"
                  : isAnswered
                  ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                  : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200";
                return (
                  <button
                    key={i}
                    className={`${base} ${style}`}
                    onClick={() => { onGoto?.(i); onClose?.(); }}
                    aria-label={`Ke soal ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-4 border-t text-right">
            <button
              className="rounded-lg border px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
