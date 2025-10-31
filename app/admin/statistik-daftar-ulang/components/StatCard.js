import { fmtIDR } from "../data";

export default function StatCard({ title, value, tone = "slate", hint, money = false }) {
  const toneMap = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    sky: "border-sky-300 bg-sky-50 text-sky-900",
    slate: "border-slate-200 bg-white text-slate-900",
  };

  return (
    <div className={`rounded-2xl border ${toneMap[tone] || toneMap.slate} p-4`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">
        {money ? fmtIDR(value) : (value ?? 0)}
      </div>
      {hint ? (
        <div className="mt-1 text-[12px] opacity-75">{hint}</div>
      ) : null}
    </div>
  );
}
