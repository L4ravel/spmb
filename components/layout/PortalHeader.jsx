"use client";

import Link from "next/link";

export default function PortalHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-violet-100/60">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-lg bg-violet-600 text-white font-bold">
            PP
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-slate-900">Portal PPDB</div>
            <div className="text-xs text-slate-500">Builder Soal Akademik</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/portal" className="text-sm font-medium text-slate-700 hover:text-violet-700">Portal</Link>
          <Link href="/tes/akademik" className="text-sm font-medium text-slate-700 hover:text-violet-700">Tes Siswa</Link>
          <Link href="/ppdb/status" className="text-sm font-medium text-slate-700 hover:text-violet-700">Status</Link>
          <Link href="/ppdb/cetak" className="text-sm font-medium rounded-full border border-violet-300/60 px-4 py-1.5 text-violet-700 hover:bg-violet-50">
            Cetak
          </Link>
        </nav>
      </div>
    </header>
  );
}
