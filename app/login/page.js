"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc, getDoc, collection, query, where, getDocs, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// === Auth (email/password) untuk admin ===
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

/** Hash util: SHA-256 -> hex (untuk jalur username lama) */
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Ambil user jalur username (NON email): by doc ID → fallback by field `username` */
async function fetchUserByLoginId(id) {
  const byId = await getDoc(doc(db, "users_app", id));
  if (byId.exists()) return { id: byId.id, data: byId.data() };

  const q = query(collection(db, "users_app"), where("username", "==", id), limit(1));
  const qs = await getDocs(q);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { id: d.id, data: d.data() };
  }
  return null;
}

/** Ambil role utk user email/uid:
 *  1) custom claims (jika diset di Auth)
 *  2) users_app/{uid}
 *  3) users_app by email
 */
async function resolveRoleForAuthUser(user) {
  try {
    const token = await user.getIdTokenResult();
    const claimRole = String(token.claims?.role || "").toLowerCase();
    if (claimRole) return claimRole;
  } catch {}

  try {
    const byUid = await getDoc(doc(db, "users_app", user.uid));
    if (byUid.exists()) {
      const role = String(byUid.data()?.role || "").toLowerCase();
      if (role) return role;
    }
  } catch {}

  try {
    const q = query(collection(db, "users_app"), where("email", "==", user.email || ""), limit(1));
    const qs = await getDocs(q);
    if (!qs.empty) {
      const role = String(qs.docs[0].data()?.role || "").toLowerCase();
      if (role) return role;
    }
  } catch {}

  return "siswa";
}

export default function LoginPPDBPage() {
  const router = useRouter();
  const [idInput, setIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    const id = String(idInput || "").trim();
    const pass = String(password || "").trim();
    if (!id || !pass) {
      setMsg("Isi email/username dan password terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);

      // === Branch 1: Admin (email) → Firebase Auth ===
      if (id.includes("@")) {
        const cred = await signInWithEmailAndPassword(auth, id, pass);
        const user = cred.user;

        // WHITELIST admin dari screenshot
        const ADMIN_EMAILS = ["user@admin.com", "usmanirawan00@gmail.com"].map(e => e.toLowerCase());
        let role = ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())
          ? "admin"
          : await resolveRoleForAuthUser(user);

        const sessionObj = {
          id: user.uid,
          username: user.email || user.uid,
          role,
          ts: Date.now(),
        };

        try {
          localStorage.setItem("appUser", JSON.stringify(sessionObj));
          document.cookie = `ppdb_session=${encodeURIComponent(
            btoa(JSON.stringify({ id: sessionObj.id, role: sessionObj.role, ts: sessionObj.ts }))
          )}; Max-Age=86400; Path=/; SameSite=Lax`;
        } catch {}

        if (role === "admin" || role === "administrator") {
          router.push("/admin");
        } else {
          router.push("/portal");
        }
        return;
      }

      // === Branch 2: Jalur lama (username NIK/NISN) → Firestore
      const userRef = await fetchUserByLoginId(id);
      if (!userRef) {
        setMsg("Akun tidak ditemukan. Periksa Username Anda.");
        return;
      }
      const u = userRef.data || {};

      // Validasi password
      let ok = false;
      if (u.password != null) ok = String(pass) === String(u.password);
      else if (u.passwordHash != null) ok = String(await sha256Hex(pass)) === String(u.passwordHash);
      else if (u.username != null) ok = String(pass) === String(u.username);

      if (!ok) {
        setMsg("Password salah. Coba lagi.");
        return;
      }

      const role = String(u.role || "siswa").toLowerCase();
      const sessionObj = {
        id: userRef.id,
        username: u.username || userRef.id,
        role,
        ts: Date.now(),
      };

      try {
        localStorage.setItem("appUser", JSON.stringify(sessionObj));
        document.cookie = `ppdb_session=${encodeURIComponent(
          btoa(JSON.stringify({ id: sessionObj.id, role: sessionObj.role, ts: sessionObj.ts }))
        )}; Max-Age=86400; Path=/; SameSite=Lax`;
      } catch {}

      if (role === "admin" || role === "administrator") {
        router.push("/admin");
      } else {
        const isActive = u.verifiedPayment === true || u.accountEnabled === true;
        router.push(isActive ? "/portal" : "/pembayaran-pending");
      }
    } catch (err) {
      console.error(err);
      setMsg("Gagal login. Periksa email/username dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-sky-50 via-white to-slate-50 px-4 py-8">
      <div className="relative w-full max-w-5xl">
        <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />
        <div className="relative grid grid-cols-1 lg:grid-cols-2 rounded-[26px] bg-white ring-1 ring-slate-200 overflow-visible">
          {/* Panel Info */}
          <div className="order-1 lg:order-2 relative isolate overflow-hidden rounded-t-[26px] lg:rounded-tr-[26px] lg:rounded-br-[26px] lg:rounded-tl-none">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 to-violet-600" />
            <div className="relative z-10 h-full p-10 text-white flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold mb-8 text-white/95">Informasi Login</h3>
                <div className="space-y-6">
                  <div className="border-l-4 border-white pl-5">
                    <div className="text-sm font-medium text-white/80 mb-2">TK / SD / PPS Ula</div>
                    <div className="text-white font-mono text-lg font-semibold">8 digit terakhir NIK</div>
                  </div>
                  <div className="border-l-4 border-white pl-5">
                    <div className="text-sm font-medium text-white/80 mb-2">SMP / SMA / Universitas</div>
                    <div className="text-white font-mono text-lg font-semibold">NISN</div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-white/20">
                  <div className="text-xs text-white/70 mb-1">Contoh</div>
                  <div className="text-sm text-white/90">
                    NIK <span className="font-mono">3507012345678901</span>
                  </div>
                  <div className="text-base font-mono font-bold text-white mt-1">Login: 45678901</div>
                </div>
              </div>
              <div className="mt-8">
                <Link href="/spmb" className="block w-full text-center rounded-xl px-6 py-3.5 bg-white text-indigo-700 font-semibold hover:bg-white/95 transition-colors">
                  Belum Punya Akun? Daftar
                </Link>
              </div>
            </div>
          </div>

          {/* Form Login */}
          <div className="order-2 lg:order-1 relative z-20 p-8 md:p-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Login PPDB</h2>
              <p className="mt-2 text-slate-600">Gunakan email (admin) atau username (siswa) dan password Anda.</p>
              <div className="mt-3 text-sm text-slate-700">
                Belum daftar?{" "}
                <Link href="/spmb" className="text-indigo-600 hover:underline font-medium">
                  Daftar PPDB di sini
                </Link>.
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4 max-w-md">
              <label className="block">
                <span className="block text-sm font-semibold text-slate-700">Email / Username</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="8 digit NIK atau NISN"
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  autoComplete="username"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700">Password</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>

              {msg && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">
                  {msg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {loading ? "Memeriksa..." : "Masuk"}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Jika lupa akun, hubungi panitia pendaftaran.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
