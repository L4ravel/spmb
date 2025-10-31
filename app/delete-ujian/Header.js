import Link from "next/link";

/* ===== NAVBAR PUTIH (menyatu) ===== */
export default function Header({ name }) {
  return (
    <header className="border-b border-violet-100/60">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-lg bg-violet-600 text-white font-bold">
            PP
          </div>
          <div className="leading-tight">
            <div className="text-base text-black font-semibold">Portal PPDB</div>
            <div className="text-xs text-slate-500">Selamat datang, {name}</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/ppdb/form" className="text-sm font-medium text-slate-700 hover:text-violet-700">
            Isi Formulir
          </Link>
          <Link href="/ppdb/status" className="text-sm font-medium text-slate-700 hover:text-violet-700">
            Status
          </Link>
          <Link href="/ppdb/cetak" className="text-sm font-medium rounded-full border border-violet-300/60 px-4 py-1.5 text-violet-700 hover:bg-violet-50">
            Cetak
          </Link>
        </nav>
      </div>
    </header>
  );
}