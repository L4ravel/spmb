"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc, getDoc, collection, query, where, getDocs, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, KeyRound } from "lucide-react";

/* ===== Util dari file login lama ===== */
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchUserByLoginId(id) {
  const byId = await getDoc(doc(db, "users_app", id));
  if (byId.exists()) return { id: byId.id, data: byId.data() };

  const q1 = query(collection(db, "users_app"), where("username", "==", id), limit(1));
  const s1 = await getDocs(q1);
  if (!s1.empty) {
    const d = s1.docs[0];
    return { id: d.id, data: d.data() };
  }
  return null;
}

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

/* ===== Helpers ala Pending Pembayaran ===== */
function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}

/* ===== Modal: Kegunaan Akun (mirip Pending) ===== */
function AccountInfoModal({ open, onClose }) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[1001] w-[92vw] max-w-[640px] md:w-[640px] h-[72vh] md:h-[520px] rounded-3xl bg-white/90 backdrop-blur-sm shadow-xl overflow-hidden animate-fade-in-up flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-base font-bold text-slate-900">Kegunaan Akun</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
  <p className="text-sm text-slate-700">
    Akun digunakan untuk mengikuti <b>tes akademik online</b> <i>(kecuali jenjang TK, SD dan PPS ULA)</i>.
  </p>

  <p className="mt-2 text-sm text-slate-700">
    Selain itu, akun calon peserta didik dipergunakan untuk melihat <b>informasi kelulusan</b>,
    melakukan <b>daftar ulang</b>, serta <b>bergabung ke grup WhatsApp</b> resmi.
  </p>

  <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-slate-700">
    <li>Harap menjaga kerahasiaan <b>username</b> dan <b>password</b>.</li>
    <li>Pastikan nomor WhatsApp aktif agar jadwal ujian dan informasi terkirim tepat waktu.</li>
    <li>Apabila mengalami kendala akses, silakan menghubungi panitia melalui WhatsApp pada bagian bantuan.</li>
  </ul>
</div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-sm font-semibold">
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Modal: Cara Login ===== */
function CaraLoginModal({ open, onClose }) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[1001] w-[92vw] max-w-[640px] md:w-[640px] h-[72vh] md:h-[520px] rounded-3xl bg-white/90 backdrop-blur-sm shadow-xl overflow-hidden animate-fade-in-up flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-base font-bold text-slate-900">Cara Login & Lupa Akun</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto text-sm text-slate-700">
  <ol className="list-decimal pl-5 space-y-4">
    <li>
      <span className="font-semibold">Username</span>
      <ul className="mt-1 list-disc pl-5 space-y-1">
        <li><b>SMP / SMA / STIT / MA'HAD ALY</b> → pakai <b>NISN</b>.</li>
        <li>
          <b>PPS ULA / SD / TK</b> → pakai <b>8 digit terakhir NIK</b>.
          <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
            <span className="text-slate-600">Contoh:</span>{" "}
            NIK <code className="font-mono">3507012345678901</code> → username{" "}
            <code className="font-mono font-semibold">45678901</code>
          </div>
        </li>
      </ul>
    </li>

    <li>
      <span className="font-semibold">Password</span> default diambil dari username
      (kecuali jika sudah diubah).
    </li>

    <li>
      <span className="font-semibold">Lupa password?</span> Silakan hubungi panitia.
    </li>
  </ol>

  {/* Butuh bantuan (ditaruh persis di bawah “Lupa password”) */}
 <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-center">
  <h3 className="text-sm font-semibold text-slate-900">Butuh bantuan?</h3>
  <p className="mt-1 text-sm text-slate-600">Hubungi panitia lewat WhatsApp.</p>

  <a
    href="https://wa.me/6287720242025"
    target="_blank"
    rel="noopener noreferrer"
    className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline"
    aria-label="Chat WhatsApp Panitia SPMB di nomor 6287720242025"
    title="Klik untuk chat WhatsApp"
  >
    (+62) 877&nbsp;2024&nbsp;2025
  </a>
</div>

</div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-sm font-semibold">
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Halaman Login: UI dibuat mirip Pending Pembayaran (single card + 2 tombol) ===== */
function LoginInner() {
  const router = useRouter();
  const [idInput, setIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [caraOpen, setCaraOpen] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const id = String(idInput || "").trim();
    const pass = String(password || "").trim();
    if (!id || !pass) { setMsg("Isi email/username dan password terlebih dahulu."); return; }

    try {
      setLoading(true);

      // === Admin (email) via Firebase Auth ===
      if (id.includes("@")) {
  const cred = await signInWithEmailAndPassword(auth, id, pass);
  const user = cred.user;

  // ⬇️ Admin whitelist (FULL ACCESS)
  const ADMIN_EMAILS = [
    "user@admin.com",
    "usmanirawan00@gmail.com",
    "riaruqoyyah@spmb.com",
    "heniherawati@spmb.com",
    "hisyam.salafy@gmail.com",
    "satria1satu@googlemail.com",
    "satria1satu@gmail.com",
    "mzkyzakky@gmail.com",
    "abdurrahman.man.88@gmail.com",
    "wirasandilalu12@gmail.com",
    "zul@spmb.com",
    "bahaudin@smpb.com",
    "ekasastrawijaya@spmb.com",
    "amrizkaul@gmail.com",
  ].map((e) => e.toLowerCase());

  let role = ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())
    ? "admin"
    : await resolveRoleForAuthUser(user);

  const sessionObj = { id: user.uid, username: user.email || user.uid, role, ts: Date.now() };
  try {
    localStorage.setItem("appUser", JSON.stringify(sessionObj));
    document.cookie = `ppdb_session=${encodeURIComponent(
      btoa(JSON.stringify({ id: sessionObj.id, role: sessionObj.role, ts: sessionObj.ts }))
    )}; Max-Age=86400; Path=/; SameSite=Lax`;
  } catch {}

  router.push(role === "admin" || role === "administrator" ? "/admin" : "/portal");
  return;
}


      // === Non-email (username NISN/NIK) via Firestore ===
      const userRef = await fetchUserByLoginId(id);
      if (!userRef) { setMsg("Akun tidak ditemukan. Periksa Username Anda."); return; }
      const u = userRef.data || {};

      let ok = false;
      if (u.password != null) ok = String(pass) === String(u.password);
      else if (u.passwordHash != null) ok = String(await sha256Hex(pass)) === String(u.passwordHash);
      else if (u.username != null) ok = String(pass) === String(u.username);

      if (!ok) { setMsg("Password salah. Coba lagi."); return; }

      const role = String(u.role || "siswa").toLowerCase();
      const sessionObj = { id: userRef.id, username: u.username || userRef.id, role, ts: Date.now() };
      try {
        localStorage.setItem("appUser", JSON.stringify(sessionObj));
        document.cookie = `ppdb_session=${encodeURIComponent(
          btoa(JSON.stringify({ id: sessionObj.id, role: sessionObj.role, ts: sessionObj.ts }))
        )}; Max-Age=86400; Path=/; SameSite=Lax`;
      } catch {}

      const isActive = u.verifiedPayment === true || u.accountEnabled === true;
      router.push(role === "admin" || role === "administrator" ? "/admin" : isActive ? "/portal" : "/pembayaran-pending");
    } catch (err) {
      console.error(err);
      setMsg("Gagal login. Periksa email/username dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Decorative background (oranye) ala Pending */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-violet-100/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-violet-100/20 rounded-full blur-3xl animate-float-delayed" />
      </div>

      {/* Single Card */}
      <div className="relative mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        <div className="rounded-3xl border border-slate-200/60 bg-white/90 backdrop-blur-sm shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in-up">
          {/* Header Card */}
          <div className="text-center pt-4 px-3">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full mb-4 shadow-xl shadow-violet-500/25 animate-scale-in">
             <KeyRound className="h-8 w-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-1 tracking-tight">
              Login <span className="text-violet-600">SPMB</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
              Masukkan username dan password untuk melanjutkan.
            </p>
          </div>

          {/* Divider halus */}
          <div className="mx-6 my-6 border-t border-slate-200" />

          {/* BAR ATAS: 2 tombol kanan (Kegunaan Akun & Cara Login) */}
          <div className="px-6 pb-2 flex items-center justify-end md:justify-center gap-2 text-black">
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="inline-flex h-14 w-48 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 text-center"
            >
              <span className="leading-tight">Kegunaan Akun</span>
            </button>
            <button
              type="button"
              onClick={() => setCaraOpen(true)}
              className="inline-flex h-14 w-48 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 text-center"
            >
              <span className="leading-tight text-center">
  Cara Login<br /> & Lupa Akun
</span>
            </button>
          </div>

          {/* Form Login */}
          <div className="px-4 sm:px-6 pb-6">
            <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
              <label className="block">
                <span className="block text-sm font-semibold text-slate-700">Username</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Masukkan username"
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  autoComplete="username"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700">Password</span>
                <div className="mt-1 relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-2 inline-flex items-center justify-center px-2 text-slate-500 hover:text-slate-700"
                    aria-label={showPwd ? "Sembunyikan password" : "Tampilkan password"}
                    title={showPwd ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
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

              <div className="mt-4 flex items-center justify-between text-sm text-center">
                <Link href="/spmb" className="text-indigo-600 hover:underline font-medium">
                  Belum punya akun? Daftar
                </Link>
                <span className="text-slate-500">Butuh panduan? tekan “Cara Login”</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Animations (copy gaya Pending) */}
      <style jsx>{`
        @keyframes fade-in-up { from { opacity:0; transform: translateY(30px);} to { opacity:1; transform: translateY(0);} }
        @keyframes scale-in { from { opacity:0; transform: scale(0.5);} to { opacity:1; transform: scale(1);} }
        @keyframes float { 0%,100%{ transform: translate(0,0) rotate(0deg);} 33%{ transform: translate(30px,-30px) rotate(5deg);} 66%{ transform: translate(-20px,20px) rotate(-5deg);} }
        @keyframes float-delayed { 0%,100%{ transform: translate(0,0) rotate(0deg);} 33%{ transform: translate(-30px,30px) rotate(-5deg);} 66%{ transform: translate(20px,-20px) rotate(5deg);} }
        .animate-fade-in-up { animation: fade-in-up .8s cubic-bezier(.16,1,.3,1) both; }
        .animate-scale-in { animation: scale-in .6s cubic-bezier(.34,1.56,.64,1) both; }
        .animate-float { animation: float 20s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 25s ease-in-out infinite; }
      `}</style>

      {/* Modals */}
      <AccountInfoModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <CaraLoginModal open={caraOpen} onClose={() => setCaraOpen(false)} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
