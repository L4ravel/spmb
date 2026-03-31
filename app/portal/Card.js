import Link from "next/link";
import Icon from "./Icon";

/* ===== Kartu menu (tema putih dgn aksen ungu) ===== */
export default function Card({ title, desc, icon, href, locked = false, lockNote = "" }) {
  const base = [
    "relative rounded-2xl p-5",
    "bg-white",
    "ring-1 ring-violet-100 hover:ring-violet-200",
    "shadow-[0_10px_25px_rgba(24,0,75,.06)]",
    "transition-all duration-300",
    locked ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-0.5",
  ].join(" ");
  
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="text-[11px] tracking-wide text-slate-500">PPDB</div>
        <div className="rounded-xl p-2 bg-violet-50 ring-1 ring-violet-100">
          <Icon name={locked ? "lock" : icon} className="h-5 w-5 text-violet-700" />
        </div>
      </div>
      <div className="mt-3 font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
      {!locked ? (
        <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-700">
          Buka <Icon name="arrow" className="h-4 w-4" />
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-600">{lockNote || "Terkunci hingga status LULUS."}</div>
      )}
    </>
  );

  if (locked) return <div className={base} aria-disabled>{content}</div>;
  return (
    <Link href={href} className={base}>
      {content}
    </Link>
  );
}