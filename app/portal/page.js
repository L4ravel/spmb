"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";
import { downloadBuktiPembayaran } from "./pdf";

/* ============ Firebase Init ============ */
function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}
const app = getFirebaseApp();
const db = getFirestore(app);

/* ============ Icon Component ============ */
function Icon({ name, className = "h-5 w-5" }) {
  const d = {
    user: "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z",
    book: "M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 0-4-4V4z",
    quran: "M3 5h14a2 2 0 0 1 2 2v12H7a2 2 0 0 0-2 2H3V5zm9 4l-4 3 4 3",
    mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm-7 7a7 7 0 0 0 14 0M12 21v-4",
    score: "M3 12h18M7 12v7m5-7v7m5-7v7",
    announce: "M3 11h5l7-4v12l-7-4H3z",
    refresh: "M4 4v6h6M20 20v-6h-6M20 8a8 8 0 0 0-14-4M4 16a8 8 0 0 0 14 4",
    lock: "M6 10V8a6 6 0 1 1 12 0v2m-9 4h6a2 2 0 0 1 2 2v4H7v-4a2 2 0 0 1 2-2z",
    arrow: "M5 12h14M13 5l7 7-7 7",
    whatsapp:
      "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884",
    home: "M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[name]} />
    </svg>
  );
}

/* ============ Card (dipakai selain ganti password) ============ */
function Card({ title, desc, icon, href, locked = false, lockNote = "", onClick }) {
  const base = [
    "relative rounded-2xl p-5",
    "bg-white",
    "border border-slate-200/70",
    "bg-gradient-to-br from-white to-violet-50/20",
    "hover:border-violet-300 hover:shadow-[0_8px_28px_rgba(79,70,229,0.15)]",
    "shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
    "transition-all duration-300",
    locked ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[2px] cursor-pointer",
  ].join(" ");

  const content = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-xl p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
          <Icon name={locked ? "lock" : icon} className="h-5 w-5 text-white" />
        </div>
        <div className="text-[10px] font-semibold tracking-widest text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200">
          SPMB
        </div>
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
      {!locked ? (
        <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700">
          Buka <Icon name="arrow" className="h-4 w-4" />
        </div>
      ) : (
        <div className="mt-3 text-sm text-amber-600 font-medium">{lockNote || "Terkunci hingga status LULUS."}</div>
      )}
    </>
  );

  if (locked) return <div className={base} aria-disabled>{content}</div>;
  if (onClick) return <div className={base} onClick={onClick}>{content}</div>;
  return <Link href={href} className={base}>{content}</Link>;
}

/* ============ Utilities ============ */
const SESSION_COOKIE = "ppdb_session";
const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());
const toKey = (s) => (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");


function getCookie(name) {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find((row) => row.startsWith(name + "="))?.split("=")[1] || "";
}
function readSessionCookie() {
  try {
    const raw = getCookie(SESSION_COOKIE);
    if (!raw) return null;
    const json = atob(decodeURIComponent(raw));
    return JSON.parse(json || "{}");
  } catch {
    return null;
  }
}
function getNisnMulti() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get("nisn") || url.searchParams.get("NISN");
  const ls = localStorage.getItem("nisn") || localStorage.getItem("ppdb_nisn") || localStorage.getItem("username");
  const ss = sessionStorage.getItem("nisn") || sessionStorage.getItem("ppdb_nisn") || sessionStorage.getItem("username");
  let fromAppUser = null;
  try {
    const raw = localStorage.getItem("appUser");
    if (raw) {
      const u = JSON.parse(raw);
      if (u && typeof u.username === "string") fromAppUser = u.username;
    }
  } catch {}
  // @ts-ignore
  const globalVar = typeof window.PPDB_NISN !== "undefined" ? window.PPDB_NISN : null;
  return (q || ls || ss || fromAppUser || globalVar || "").toString().trim() || null;
}
function generateSessionId() {
  const ts = Date.now().toString(36);
  if (typeof window !== "undefined" && crypto?.getRandomValues) {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${ts}-${hex}`;
  }
  return `${ts}-${Math.random().toString(16).slice(2, 10)}`;
}
function cn(...xs) { return xs.filter(Boolean).join(" "); }
const hasLetter = (s) => /[A-Za-z]/.test(s || "");
const hasNumber = (s) => /\d/.test(s || "");
const strongEnough = (s) => (s?.length >= 8 && hasLetter(s) && hasNumber(s));
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ============ BottomNav (mobile) ============ */
function BottomNav({ onGo }) {
  const Item = ({ id, icon, label }) => (
    <button onClick={() => onGo(id)} className="flex flex-col items-center justify-center gap-1 px-4 py-2.5 flex-1" aria-label={label}>
      <Icon name={icon} className="h-6 w-6" />
      <span className="sr-only">{label}</span>
    </button>
  );
  return (
    <nav
      className={[
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70",
        "border-t border-slate-200",
        "shadow-[0_-8px_24px_rgba(0,0,0,0.06)]",
        "pt-1 pb-[calc(env(safe-area-inset-bottom)+6px)]",
      ].join(" ")}
      role="navigation"
      aria-label="Jalan Pintas"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-3 text-slate-700">
          <Item id="top" icon="home" label="Beranda" />
          <Item id="section-tes" icon="book" label="Tes Seleksi" />
          <Item id="section-hasil" icon="score" label="Hasil & Pengumuman" />
        </div>
      </div>
    </nav>
  );
}

/* ============ Main Portal Page ============ */
export default function PortalPPDB() {
  const router = useRouter();
  const sessionId = useMemo(() => generateSessionId(), []);

  const [name, setName] = useState("Pengguna");
  const [nisn, setNisn] = useState("");
  const [statusPendaftaran, setStatusPendaftaran] = useState("MENUNGGU");
  const [waLink, setWaLink] = useState(null);

  const [showWaModal, setShowWaModal] = useState(false);
  const [showAkademikOffline, setShowAkademikOffline] = useState(false);
  const [registrationLevel, setRegistrationLevel] = useState("");
  const [showQuranModal, setShowQuranModal] = useState(false);
  const [showWawancaraModal, setShowWawancaraModal] = useState(false);

  // NEW: modal ganti password
  const [showChangePwModal, setShowChangePwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Helper: normalisasi status ke 3 nilai baku
  function normalizeStatus(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (!s) return "MENUNGGU";
    if (["lulus", "diterima", "accepted", "pass"].includes(s)) return "LULUS";
    if (["tidak_lulus"].includes(s)) return "TIDAK LULUS";
    return "MENUNGGU";
  }

  // Ambil status dari users_app/{nisn}/finalDecision (subkoleksi), fallback field di doc user
  async function fetchFinalDecisionStatus(id) {
    try {
      // 1) Coba subkoleksi
      const colRef = collection(db, "users_app", id, "finalDecision");
      const qs = await getDocs(colRef);
      if (!qs.empty) {
        // Preferensi: cari doc bernama 'latest', kalau tidak ada ambil doc pertama
        let docData = null;
        qs.forEach((d) => {
          if (!docData) docData = d.data();
          if (d.id.toLowerCase() === "latest") docData = d.data();
        });
        const val = docData?.status || docData?.finalDecision || docData?.result || "";
        setStatusPendaftaran(normalizeStatus(val));
        return;
      }

      // 2) Fallback: field di dokumen user
      const userRef = doc(db, "users_app", id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() || {};
        const val = data.finalDecision || data.decision || data.status || "";
        setStatusPendaftaran(normalizeStatus(val));
        return;
      }
    } catch (e) {
      console.error("[finalDecision] fetch error:", e);
    }

    // Default
    setStatusPendaftaran("MENUNGGU");
  }

  const [authed, setAuthed] = useState(false);
  const pengumumanHref = nisn ? `/hasil-pengumuman/${nisn}` : "/hasil-pengumuman";

  const goTo = useCallback((id) => {
    const el = id === "top" ? document.body : document.getElementById(id);
    if (!el) return;
    const y = id === "top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const id = getNisnMulti();
      if (!id) return alert("NISN tidak ditemukan.");
      await downloadBuktiPembayaran({ db, nisn: id });
    } catch (e) {
      console.error(e);
      alert(e.message || "Tidak bisa mengunduh bukti. Coba lagi.");
    }
  }, []);
  

  useEffect(() => {
    try {
      document.documentElement.style.scrollBehavior = "smooth";
    } catch {}

    const session = readSessionCookie();
    let localOk = false;
    try {
      const raw = localStorage.getItem("appUser");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.username) {
          setName(u.username);
          const n = u?.username || u?.id || "";
          if (isNISN(n)) setNisn(String(n));
          localOk = true;
        }
      }
    } catch {}

    if (!session || !localOk) {
      router.replace("/login");
      return;
    }

    const status = String(session?.registrationPaymentStatus || "").toLowerCase();
    const verified = status === "verified";
    if (!verified) {
      router.replace("/pembayaran-pending");
      return;
    }
    setAuthed(true);

    (async () => {
      try {
        const id = getNisnMulti();
        if (!id) return;
        const userSnap = await getDoc(doc(db, "users_app", id));
        if (!userSnap.exists()) return;
        const level = (userSnap.data()?.registrationLevel || "").toString().trim();
        setRegistrationLevel(level);
        if (!level) return;
        const key = toKey(level);
        const waSnap = await getDoc(doc(db, "wa_groups", key));
        const link = waSnap.exists() ? (waSnap.data()?.link || "").toString().trim() : "";
        setWaLink(link || null);
        await fetchFinalDecisionStatus(id);
      } catch (e) {
        console.error("Resolve WA error:", e);
      }
    })();
  }, [router]);

  const OFFLINE_LEVELS = new Set([
    "TK",
    "SD Putra",
    "SD Putri",
    "PPS Ula Putra",
    "PPS Ula Putri",
  ]);

  function handleTesAkademikClick() {
    const lvl = (registrationLevel || "").trim();
    if (OFFLINE_LEVELS.has(lvl)) {
      setShowAkademikOffline(true);
    } else {
      router.push("/confirm-ujian");
    }
  }

  const isLulus = statusPendaftaran === "LULUS";
  const score = useMemo(() => {
    let s = 0;
    if ((newPw || "").length >= 8) s += 1;
    if (hasLetter(newPw)) s += 1;
    if (hasNumber(newPw)) s += 1;
    if ((newPw || "").length >= 12) s += 1;
    return s;
  }, [newPw]);

  if (!authed) return null;

  async function handleChangePassword(e) {
    e?.preventDefault?.();
    setMsg({ type: "", text: "" });

    const id = getNisnMulti();
    if (!id) { setMsg({ type: "error", text: "NISN tidak ditemukan. Silakan login ulang." }); return; }
    if (!currentPw) { setMsg({ type: "error", text: "Masukkan password saat ini." }); return; }
    if (!strongEnough(newPw)) { setMsg({ type: "error", text: "Password baru minimal 8 karakter serta mengandung huruf dan angka." }); return; }
    if (newPw !== confirmPw) { setMsg({ type: "error", text: "Konfirmasi password tidak cocok." }); return; }

    setSubmitting(true);
    try {
      const ref = doc(db, "users_app", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setMsg({ type: "error", text: "Akun tidak ditemukan." }); setSubmitting(false); return; }
      const data = snap.data() || {};
      const currentHash = (data.passwordHash || "").toString();

      const oldHash = await sha256Hex(currentPw);
      if (!currentHash || oldHash !== currentHash) { setMsg({ type: "error", text: "Password saat ini salah." }); setSubmitting(false); return; }

      const newHash = await sha256Hex(newPw);
      if (newHash === currentHash) { setMsg({ type: "error", text: "Password baru tidak boleh sama dengan yang lama." }); setSubmitting(false); return; }

      await updateDoc(ref, { passwordHash: newHash, passwordChangedAt: serverTimestamp() });
      setMsg({ type: "success", text: "Password berhasil diubah." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      console.error("[change-password] error:", err);
      setMsg({ type: "error", text: "Gagal mengubah password. Coba lagi sebentar." });
    } finally {
      setSubmitting(false);
    }
  }
  

  return (
    <div className="min-h-screen bg-white" id="top">
      <Header name={name} />

      {/* Top Section */}
      <section className="relative pt-6 pb-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Status Card (simplified) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-900 grid place-items-center">
                  <Icon name="user" className="h-6 w-6 text-white" />
                </div>

                <div className="flex-1">
                  <div className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase mb-2">
                    Status Pendaftaran
                  </div>

                  {/* Status Ringkas */}
                  <div className="mb-3">
                    {statusPendaftaran === "MENUNGGU" || statusPendaftaran === "DIPROSES" ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 px-3 py-1.5 text-sm font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {statusPendaftaran}
                      </div>
                    ) : statusPendaftaran === "LULUS" ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-green-50 text-green-700 px-3 py-1.5 text-sm font-semibold">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        LULUS
                      </div>
                    ) : statusPendaftaran === "TIDAK LULUS" ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 text-rose-700 px-3 py-1.5 text-sm font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        TIDAK LULUS
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-700 px-3 py-1.5 text-sm font-semibold">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        {statusPendaftaran}
                      </div>
                    )}
                  </div>

                  {/* Info singkat per status */}
                  {statusPendaftaran === "MENUNGGU" || statusPendaftaran === "DIPROSES" ? (
                    <p className="text-[13px] text-slate-700 leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      Mohon menunggu pengumuman resmi.
                    </p>
                  ) : statusPendaftaran === "LULUS" ? (
                    <p className="text-[13px] text-slate-700 leading-relaxed bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                      Selamat! Anda dinyatakan <b>Lulus, </b>Silakan lanjut ke menu <b>Daftar Ulang</b>.
                    </p>
                  ) : statusPendaftaran === "TIDAK LULUS" ? (
                    <p className="text-[13px] text-slate-700 leading-relaxed bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                      Anda belum berhasil pada seleksi ini. Tetap semangat.
                    </p>
                  ) : (
                    <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                      Fitur <b>Daftar Ulang</b> aktif bila status = <b>LULUS</b>.
                    </p>
                  )}

                  {/* Tombol aksi ringkas */}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChangePwModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 transition-all"
                      aria-label="Ganti Password"
                    >
                      <Icon name="lock" className="h-4 w-4 text-white" />
                      Ganti Password
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 text-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-all"
                      aria-label="Unduh bukti pembayaran"
                      title="Unduh Bukti Pembayaran (PDF)"
                    >
                      📄 Bukti Pembayaran
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp Card (simplified) — DIREVISI */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-600 to-green-600 p-6 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/15 grid place-items-center">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
                  </svg>
                </div>

                <div className="flex-1">
                  <div className="text-[11px] font-semibold tracking-widest text-white/90 uppercase mb-2">
                    WhatsApp
                  </div>

                  {/* Keterangan dinamis sesuai status */}
                  {isLulus ? (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Informasi via WhatsApp</h3>
                      <p className="text-[13px] text-white/90 mb-3 leading-relaxed">
                        Silakan gabung grup resmi berikut.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Informasi via WhatsApp</h3>
                      <p className="text-[13px] text-white/90 mb-3 leading-relaxed">
                        <b>Jadwal ujian</b> akan disampaikan dari <b>WhatsApp</b> oleh panitia.
                      </p>
                    </>
                  )}

                  {/* Aksi Gabung WA: HANYA saat LULUS (hapus semua tampilan tombol/lock untuk selain LULUS) */}
                  {isLulus && waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-700 px-5 py-2.5 font-semibold shadow hover:shadow-md hover:bg-emerald-50 transition-all"
                    >
                      Buka Grup <Icon name="arrow" className="h-4 w-4" />
                    </a>
                  )}
                  {isLulus && !waLink && (
                    <button
                      type="button"
                      onClick={() => setShowWaModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/20 text-white px-5 py-2 font-semibold hover:bg-white/30 transition-all ring-1 ring-white/40"
                    >
                      Bergabung <Icon name="arrow" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Menu Section */}
      <main className="mx-auto max-w-7xl px-4 md:px-6 pb-24">
        {/* Tes Group */}
        <div id="section-tes" className="mb-8 scroll-mt-24">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-1 w-10 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full"></div>
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-violet-700">Tes Seleksi</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              icon="book"
              title="Tes Akademik"
              desc="Uji pengetahuan akademik, sesuai paket soal yang disiapkan panitia."
              onClick={handleTesAkademikClick}
            />
            <Card icon="quran" title="Tes Al Qur'an" desc="Uji kemampuan bacaan dan hafalan Al Qur'an sesuai ketentuan panitia." onClick={() => setShowQuranModal(true)} />
            <Card icon="mic" title="Tes Wawancara" desc="Sesi tanya-jawab dan penilaian kepribadian bersama panitia SPMB." onClick={() => setShowWawancaraModal(true)} />
          </div>
        </div>

        {/* Hasil Group */}
        <div id="section-hasil" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-1 w-10 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full"></div>
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-violet-700">Hasil & Pengumuman</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card "Lihat Nilai" dihapus sesuai permintaan */}
            <Card
              href={pengumumanHref}
              icon="announce"
              title="Pengumuman"
              desc="Cek status kelulusan dan instruksi lanjutan dari panitia SPMB."
            />
            <Card href={`/daftar-ulang/${nisn}`} icon="refresh" title="Daftar Ulang" desc="Konfirmasi kehadiran dan unggah berkas pendaftaran ulang." locked={!isLulus} lockNote="Fitur ini akan aktif ketika status Anda LULUS." />
          </div>

          {/* === Footer Bantuan (punya divider di atas) === */}
          <div className="mt-10 pt-6 border-t border-slate-200">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <h3 className="text-sm font-semibold text-slate-900">Butuh bantuan?</h3>
              <p className="mt-1 text-sm text-slate-600">Hubungi panitia lewat WhatsApp.</p>

              <div className="mt-3 flex items-center justify-center gap-2">
                <a
                  href="https://wa.me/6287720242025"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                  aria-label="Chat WhatsApp Panitia SPMB"
                >
                  {/* ikon WA kecil */}
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52s-.67-1.61-.92-2.2c-.24-.58-.49-.5-.67-.51H7.7c-.2 0-.52.07-.79.37S5.87 6.9 5.87 8.36c0 1.46 1.06 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.48 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88Z"/>
                  </svg>
                  Chat WhatsApp
                </a>

                <span className="text-xs text-slate-500">(+62) 877&nbsp;2024&nbsp;2025</span>
              </div>
            </div>
          </div>


        </div>
      </main>

      {/* Bottom Nav (mobile) */}
      <BottomNav onGo={goTo} />

      <Footer />

      {/* WhatsApp Modal */}
      {showWaModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowWaModal(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-xl bg-amber-50 text-amber-600 ring-2 ring-amber-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7v2.1c0 .7-.27 1.37-.75 1.87L3 15h18l-1.25-2.03c-.48-.5-.75-1.17-.75-1.87V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1.5">Grup Belum Tersedia</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Link WhatsApp untuk jenjang Anda belum dibuat oleh panitia. Silakan cek kembali beberapa saat lagi.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setShowWaModal(false)} className="rounded-lg bg-violet-600 text-white px-5 py-2 font-semibold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/25">Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {showAkademikOffline && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowAkademikOffline(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-xl bg-violet-50 text-violet-600 ring-2 ring-violet-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M3 11h5l7-4v12l-7-4H3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1.5">Tes Akademik (Offline)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Khusus jenjang <b>{registrationLevel || "tertentu"}</b>, ujian akademik
                  <b className="text-violet-700"> dilakukan secara offline</b>. Mohon
                  <b> menunggu informasi resmi dari panitia</b> terkait jadwal dan lokasi.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowAkademikOffline(false)}
                className="rounded-lg bg-violet-600 text-white px-5 py-2 font-semibold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/25"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quran Modal */}
      {showQuranModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowQuranModal(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-xl bg-green-50 text-green-600 ring-2 ring-green-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1.5">Tes Al Qur'an</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Informasi Tes Al-Qur&apos;an akan disampaikan melalui pesan{" "}
                  <span className="font-semibold text-green-600">WhatsApp</span> ke nomor yang terdaftar.
                  Pastikan nomor aktif dan dapat menerima pesan.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowQuranModal(false)} className="rounded-lg border border-slate-200 text-slate-700 px-5 py-2 font-semibold hover:bg-slate-50 transition-colors">Tutup</button>
              {isLulus && waLink && (
                <a href={waLink} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 text-white px-5 py-2 font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/25">
                  Buka Grup WA
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === Modal Ganti Password (POPUP) === */}
      {showChangePwModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowChangePwModal(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Ganti Password</h3>
              <p className="text-sm text-slate-600">Password diverifikasi terhadap akun Anda. Disarankan tidak memakai NISN.</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-black">
              <div>
                <label className="text-sm font-medium text-slate-700">Password Saat Ini</label>
                <div className="mt-1 relative">
                  <input type={showCur ? "text" : "password"} className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" placeholder="Masukkan password saat ini" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" required/>
                  <button type="button" onClick={() => setShowCur((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700" tabIndex={-1}>{showCur ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Password Baru</label>
                <div className="mt-1 relative">
                  <input type={showNew ? "text" : "password"} className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" placeholder="Minimal 8 karakter, kombinasi huruf & angka" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required/>
                  <button type="button" onClick={() => setShowNew((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700" tabIndex={-1}>{showNew ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>
                <div className="mt-2">
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className={cn("h-2 rounded-full transition-all", score <= 1 && "bg-rose-500", score === 2 && "bg-amber-500", score >= 3 && "bg-emerald-600")} style={{ width: `${(score / 4) * 100}%` }}/>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Syarat: minimal 8 karakter, mengandung huruf dan angka.</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Konfirmasi Password Baru</label>
                <div className="mt-1 relative">
                  <input type={showConf ? "text" : "password"} className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" placeholder="Ulangi password baru" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required/>
                  <button type="button" onClick={() => setShowConf((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700" tabIndex={-1}>{showConf ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>
              </div>

              {!!msg.text && (
                <div className={cn("rounded-lg px-3 py-2 text-sm", msg.type === "success" && "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300", msg.type === "error" && "bg-rose-50 text-rose-800 ring-1 ring-rose-300")}>
                  {msg.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowChangePwModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:emerald-700 disabled:opacity-50">{submitting ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}     
    </div>
  );
}
