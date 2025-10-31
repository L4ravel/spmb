"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const isLikelyNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());

export default function Header({ name: nameProp }) {
  const [displayName, setDisplayName] = useState("Pengguna");

  useEffect(() => {
    let cancelled = false;
    async function resolveName() {
      let initialName = (nameProp && String(nameProp).trim()) || "";
      let username = "";

      try {
        const raw = localStorage.getItem("appUser");
        if (raw) {
          const u = JSON.parse(raw);
          username = u?.username || u?.id || "";
          if (u?.displayName) initialName = String(u.displayName).trim();
        }
      } catch {}

      if (initialName) setDisplayName(initialName);

      const key = username || initialName;
      if (isLikelyNISN(initialName) || isLikelyNISN(username)) {
        try {
          const snap = await getDoc(doc(db, "users_app", key));
          if (!cancelled && snap.exists()) {
            const d = snap.data() || {};
            const nm =
              d.fullName || d.namaLengkap || d.nama || d.name ||
              d.profile?.fullName || d.profile?.name || "";
            if (nm) setDisplayName(nm);
          }
        } catch {}
      } else if (!initialName && username) {
        try {
          const snap = await getDoc(doc(db, "users_app", username));
          if (!cancelled && snap.exists()) {
            const d = snap.data() || {};
            const nm =
              d.fullName || d.namaLengkap || d.nama || d.name ||
              d.profile?.fullName || d.profile?.name || username;
            setDisplayName(nm);
          }
        } catch {
          setDisplayName(username);
        }
      }
    }
    resolveName();
    return () => { cancelled = true; };
  }, [nameProp]);

  const handleLogout = () => {
    try { localStorage.removeItem("appUser"); } catch {}
    document.cookie = "ppdb_session=; Max-Age=0; Path=/; SameSite=Lax";
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Kiri: PPDB + Greeting di bawahnya */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-xl bg-violet-500/40 blur-md" />
            <div className="relative h-9 w-9 grid place-items-center rounded-xl
                            bg-gradient-to-br from-violet-600 to-indigo-700
                            text-white text-[11px] font-bold shadow-lg">
              PP
            </div>
          </div>

          <div className="flex flex-col leading-tight">
            <div className="text-base font-extrabold tracking-tight text-slate-900">
              Portal SPMB
            </div>
            <div className="text-[12px] text-slate-600 -mt-0.5 truncate max-w-[52vw] sm:max-w-none">
              Selamat Datang, {displayName}
            </div>
          </div>
        </div>

        {/* Kanan: tombol Keluar */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700
                     hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          aria-label="Keluar"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
