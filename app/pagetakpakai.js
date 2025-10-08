"use client";

import Link from "next/link";

/* Ikon minimal */
function Icon({ name, className }) {
  const d = {
    userPlus:
      "M15 14c2.76 0 5 2.24 5 5v1H10v-1c0-2.76 2.24-5 5-5zm-7-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm13-6h-2V4h-2v2h-2v2h2v2h2V8h2V6z",
    login:
      "M10 17l5-5-5-5v3H3v4h7v3zm9-13H9a2 2 0 0 0-2 2v3h2V6h10v12H9v-3H7v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={d[name]} />
    </svg>
  );
}

/* Tombol aksi */
function ActionBtn({ href, label, icon }) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 rounded-xl px-4 py-3 bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-slate-300 shadow transition-all duration-300 hover:-translate-y-0.5"
    >
      <span className="grid place-items-center rounded-lg p-2 bg-slate-50 ring-1 ring-slate-200">
        <Icon name={icon} className="h-5 w-5 text-slate-700" />
      </span>
      <span className="font-semibold tracking-wide">{label}</span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-sky-50 via-white to-slate-50 px-4">
      <div className="relative w-full max-w-5xl">
        <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 rounded-[26px] bg-white ring-1 ring-slate-200 overflow-visible">
          {/* Kolom kiri: judul + tombol */}
          <div className="relative z-20 p-8 md:p-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Web PPDB
              </h2>
              <p className="mt-2 text-slate-600">
                Sistem Penerimaan Peserta Didik Baru.
              </p>
            </div>

            {/* Tombol daftar + login */}
            <div className="mt-6 space-y-3">
              <ActionBtn href="/ppdb" label="Pendaftaran Siswa" icon="userPlus" />
              <ActionBtn href="/login" label="Login Akun" icon="login" />
            </div>
          </div>

          {/* Kolom kanan: panel gradien */}
          <div className="relative isolate overflow-hidden rounded-tr-[26px] rounded-br-[26px]">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 to-violet-600" />
            <div className="hidden md:block absolute -left-25 top-0 h-full w-32 rounded-r-[60px] bg-white -z-10 pointer-events-none" />
            <div className="relative z-10 h-full p-8 md:p-10 text-white flex flex-col items-center justify-center text-center">
              <h3 className="text-3xl font-extrabold">PPDB Online</h3>
              <p className="mt-3 text-indigo-100 max-w-sm">
                Daftarkan diri Anda dengan mudah dan cepat melalui sistem PPDB
                berbasis web.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/ppdb"
                  className="rounded-full px-6 py-2 bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition"
                >
                  Daftar Sekarang
                </Link>               
              </div>
            </div>
          </div>
          {/* Akhir kolom kanan */}
        </div>
      </div>
    </div>
  );
}
