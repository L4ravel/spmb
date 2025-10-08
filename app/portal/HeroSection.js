"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

/* Firebase init */
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

/* utils */
const toKey = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");


/* >>> FIX: tambahkan pembacaan appUser.username sebagai fallback NISN <<< */
function getNisnMulti() {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const q = url.searchParams.get("nisn") || url.searchParams.get("NISN");

  const ls =
    localStorage.getItem("nisn") ||
    localStorage.getItem("ppdb_nisn") ||
    localStorage.getItem("username");

  const ss =
    sessionStorage.getItem("nisn") ||
    sessionStorage.getItem("ppdb_nisn") ||
    sessionStorage.getItem("username");

  // NEW: baca appUser -> username
  let fromAppUser = null;
  try {
    const raw = localStorage.getItem("appUser");
    if (raw) {
      const u = JSON.parse(raw);
      if (u && typeof u.username === "string") fromAppUser = u.username;
    }
  } catch {}

  const globalVar =
    typeof window.PPDB_NISN !== "undefined" ? window.PPDB_NISN : null;

  return (q || ls || ss || fromAppUser || globalVar || "").toString().trim() || null;
}

export default function HeroSection({ statusPendaftaran }) {
  const [waLink, setWaLink] = useState(null);
  const [loadingWa, setLoadingWa] = useState(true);
  const [showWaModal, setShowWaModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingWa(true);
        const id = getNisnMulti();
        if (!id) { setWaLink(null); return; }

        const userSnap = await getDoc(doc(db, "users_app", id));
        if (!userSnap.exists()) { setWaLink(null); return; }

        const level = (userSnap.data()?.registrationLevel || "").toString().trim();
        if (!level) { setWaLink(null); return; }

        const key = toKey(level); // ex: "PGMI Putra (S1)" -> "PGMI_PUTRA__S1_"
        const waSnap = await getDoc(doc(db, "wa_groups", key));
        const link = waSnap.exists() ? (waSnap.data()?.link || "").toString().trim() : "";
        setWaLink(link || null);
      } catch (e) {
        console.error("Resolve WA error:", e);
        setWaLink(null);
      } finally {
        if (mounted) setLoadingWa(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section className="relative overflow-hidden h-[400px]">
      <div className={["absolute inset-y-0 left-0 w-[88%] md:w-[62%]",
        "bg-gradient-to-br from-[#6a11cb] via-[#5b22c7] to-[#3b1e8f]",
        "[clip-path:ellipse(110%_78%_at_8%_46%)] md:[clip-path:ellipse(100%_80%_at_6%_48%)]"].join(" ")}
      />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 h-full items-center">
          <div className="text-white">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight drop-shadow-sm">
              Selamat Datang di Portal PPDB
            </h1>
            <p className="mt-3 text-white/90 max-w-xl">
              Tempat calon Peserta Didik mengikuti tes Akademik, Tes Al Qur&apos;an, dan
              Wawancara, sekaligus memantau nilai dan pengumuman kelulusan.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link href="/ppdb/form"
                className="rounded-full bg-white text-violet-700 px-5 py-2 font-semibold shadow hover:bg-violet-50">
                Mulai Isi
              </Link>

              {waLink ? (
  <a
    href={waLink}
    target="_blank"
    rel="noreferrer"
    className="rounded-full bg-[#22B358] text-white px-5 py-2 font-semibold shadow hover:bg-green-700"
    title="Gabung grup WhatsApp sesuai jenjang Anda"
  >
    Grup WhatsApp
  </a>
) : (
  <button
    type="button"
    onClick={() => setShowWaModal(true)}
    className="rounded-full bg-[#22B358] text-white px-5 py-2 font-semibold shadow hover:bg-green-700"
    title="Link WA belum tersedia"
  >
    Grup WhatsApp
  </button>
)}
            </div>

           
          </div>

          <div className="flex md:justify-end">
            <div className="self-start rounded-2xl bg-white shadow-[0_15px_45px_rgba(24,0,75,.08)] ring-1 ring-violet-100 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {statusPendaftaran}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Fitur <b>Daftar Ulang</b> akan otomatis aktif bila status = <b>LULUS</b>.
              </div>
            </div>
          </div>
        </div>
      </div>

     {showWaModal && (
  <div
    className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-4"
    onClick={() => setShowWaModal(false)}
    role="dialog"
    aria-modal="true"
  >
    <div
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 grid place-items-center rounded-xl bg-yellow-50 text-yellow-600 ring-1 ring-yellow-100">
          {/* ikon info/bell */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
               className="h-5 w-5" fill="currentColor">
            <path d="M12 2a7 7 0 0 0-7 7v2.1c0 .7-.27 1.37-.75 1.87L3 15h18l-1.25-2.03c-.48-.5-.75-1.17-.75-1.87V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Grup belum dibuat</h3>
          <p className="mt-1 text-sm text-slate-600">
            Link WhatsApp untuk jenjang Anda belum tersedia. Silakan cek kembali nanti.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setShowWaModal(false)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
)}

    </section>
  );
}
