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
      // 1) Ambil dari prop atau localStorage
      let initialName = (nameProp && String(nameProp).trim()) || "";
      let username = "";

      try {
        const raw = localStorage.getItem("appUser");
        if (raw) {
          const u = JSON.parse(raw);
          username = u?.username || u?.id || "";
          // kalau login sudah menyimpan displayName, pakai dulu
          if (u?.displayName) initialName = String(u.displayName).trim();
        }
      } catch {}

      // 2) Set sementara
      if (initialName) setDisplayName(initialName);

      // 3) Jika yang tampil masih NISN/username angka → fetch nama asli
      const key = username || initialName;
      if (isLikelyNISN(initialName) || isLikelyNISN(username)) {
        try {
          const snap = await getDoc(doc(db, "users_app", key));
          if (!cancelled && snap.exists()) {
            const d = snap.data() || {};
            const nm =
              d.fullName ||
              d.namaLengkap ||
              d.nama ||
              d.name ||
              d.profile?.fullName ||
              d.profile?.name ||
              "";
            if (nm) setDisplayName(nm);
          }
        } catch {
          /* ignore */
        }
      } else if (!initialName && username) {
        // fallback: kalau prop kosong tapi ada username, coba fetch juga
        try {
          const snap = await getDoc(doc(db, "users_app", username));
          if (!cancelled && snap.exists()) {
            const d = snap.data() || {};
            const nm =
              d.fullName ||
              d.namaLengkap ||
              d.nama ||
              d.name ||
              d.profile?.fullName ||
              d.profile?.name ||
              username;
            setDisplayName(nm);
          }
        } catch {
          setDisplayName(username);
        }
      }
    }

    resolveName();
    return () => {
      cancelled = true;
    };
  }, [nameProp]);

  const handleLogout = () => {
    try {
      localStorage.removeItem("appUser");
    } catch {}
    document.cookie = "ppdb_session=; Max-Age=0; Path=/; SameSite=Lax";
    window.location.href = "/login";
  };

  return (
    <header className="border-b border-violet-100/60 bg-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Kiri: Logo + salam */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-lg bg-violet-600 text-white font-bold">
            PP
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-black">Portal PPDB</div>
            <div className="text-xs text-slate-500">
              Selamat datang, <b>{displayName}</b>
            </div>
          </div>
        </div>

        {/* Kanan: hanya Logout */}
        <button
          onClick={handleLogout}
          className="text-sm font-medium rounded-full border border-violet-300/60 px-4 py-1.5 text-violet-700 hover:bg-violet-50"
          aria-label="Log out"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
