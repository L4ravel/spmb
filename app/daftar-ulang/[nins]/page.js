// app/daftar-ulang/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import FormPTK from "./form-ptk";
import FormNonPTK from "./form-nonptk";
import UkuranBaju from "./ukuran-baju";

/* ===== Helpers ===== */
function getActiveNISN() {
  try {
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      const fromQS = qs.get("nisn") || qs.get("nins");
      if (fromQS) return fromQS.trim();
      const fromLS = window.localStorage.getItem("nisn") || window.localStorage.getItem("nins");
      if (fromLS) return fromLS.trim();
      const fromSS = window.sessionStorage.getItem("nisn") || window.sessionStorage.getItem("nins");
      if (fromSS) return fromSS.trim();
    }
  } catch {}
  return "";
}

const CardButton = ({ title, desc, onClick, icon, cta = "Pilih Kategori Ini", disabled = false, lockNote }) => (
  <button
    onClick={disabled ? undefined : onClick}
    aria-disabled={disabled}
    className={[
      "group relative w-full text-left rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 p-5 sm:p-6",
      disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : "hover:shadow-lg",
    ].join(" ")}
    aria-label={title}
  >
    <div className="flex items-start gap-2">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-violet-50 transition-colors">
        <span className="text-slate-700 group-hover:text-violet-700">{icon}</span>
      </div>
      <div className="flex-1">
        <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 group-hover:text-violet-800 transition-colors">
          {title}
          {disabled ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              🔒 Terkunci (PTK terkonfirmasi)
            </span>
          ) : null}
        </h3>
        <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{desc}</p>
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className={["text-sm font-medium", disabled ? "text-slate-500" : "text-violet-700"].join(" ")}>
            {disabled ? lockNote || "Tidak dapat dipilih" : cta}
          </span>
          <svg className={["h-5 w-5", disabled ? "text-slate-400" : "text-violet-700 group-hover:translate-x-1"].join(" ")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </div>
  </button>
);

export default function DaftarUlangPage() {
  const [kategori, setKategori] = useState(null); // 'ptk' | 'nonptk' | null
  const [showUniform, setShowUniform] = useState(false);
  const [uniformRegLevel, setUniformRegLevel] = useState("");
  const [uniformFilled, setUniformFilled] = useState(false);

  const [isPTKApproved, setIsPTKApproved] = useState(false);
  const [checking, setChecking] = useState(true);
  const nisn = useMemo(() => getActiveNISN(), []);

  // Cek status via API (hanya jika nisn ada)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!nisn) {
          // Tanpa NISN: jangan blok apa pun
          setIsPTKApproved(false);
          setChecking(false);
          return;
        }
        setChecking(true);
        const res = await fetch("/api/ptk/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nisn }),
        });
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        setIsPTKApproved(!!j.approved);
      } catch {
        if (!alive) return;
        // Gagal cek → asumsi tidak approved supaya tidak memblokir user non-PTK
        setIsPTKApproved(false);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [nisn]);

  // Kalau tiba-tiba approved saat sudah di Non-PTK, kembalikan
  useEffect(() => {
    if (isPTKApproved && kategori === "nonptk") setKategori(null);
  }, [isPTKApproved, kategori]);

  // Klik Non-PTK: jika nisn ada → verifikasi; kalau tidak ada → langsung masuk (tidak diblok).
  const handleSelectNonPTK = async () => {
    try {
      if (!nisn) {
        // Tidak ada NISN: izinkan akses (ini kasus kamu barusan)
        setKategori("nonptk");
        return;
      }
      const res = await fetch("/api/ptk/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nisn }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.approved) {
        setIsPTKApproved(true);
        if (typeof window !== "undefined") window.alert("Non-PTK terkunci: status PTK sudah disetujui.");
        return;
      }
      setKategori("nonptk");
    } catch {
      // Error cek → jangan blok
      setKategori("nonptk");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 w-full">
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12">
          {/* Pilihan kategori */}
          {kategori === null && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="px-5 sm:px-8 py-5 sm:py-7 border-b border-slate-200 bg-white">
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Pendaftaran Ulang Santri</h1>
                <p className="mt-1 text-slate-700">Pilih kategori sesuai status orang tua/wali.</p>
                {isPTKApproved ? (
                  <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Akun ini sudah <b>terkonfirmasi sebagai PTK</b>. Opsi Non-PTK dikunci.
                  </p>
                ) : null}
              </div>

              <div className="p-2 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2">
                  <CardButton
                    title="Non-PTK"
                    desc={<>Untuk santri yang orang tua/walinya <span className="font-medium text-slate-900">tidak bekerja</span> sebagai tenaga pendidik atau kependidikan di pondok pesantren.</>}
                    onClick={handleSelectNonPTK}
                    icon={<span>👥</span>}
                    // Disabled hanya bila benar2 approved
                    disabled={isPTKApproved}
                    lockNote="Terkunci karena status PTK disetujui"
                  />
                  <CardButton
                    title="PTK"
                    desc={<>Untuk santri yang orang tua/walinya <span className="font-medium text-slate-900">bekerja</span> sebagai tenaga pendidik atau kependidikan di pondok pesantren.</>}
                    onClick={() => setKategori("ptk")}
                    icon={<span>✅</span>}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form (Non-PTK hanya dirender bila TIDAK approved) */}
          <div className={kategori ? "animate-[fadeIn_240ms_ease-out]" : ""}>
            {kategori === "nonptk" && !isPTKApproved && (
              <FormNonPTK
                onBack={() => setKategori(null)}
                onOpenUniform={(regLevel) => { setUniformRegLevel(regLevel || ""); setShowUniform(true); }}
                uniformFilled={uniformFilled}
              />
            )}
            {kategori === "ptk" && <FormPTK onBack={() => setKategori(null)} />}
          </div>
        </section>
      </main>

      <Footer />

      {showUniform && (
        <PageModal title="Ukuran Baju" onClose={() => setShowUniform(false)}>
          <UkuranBaju
            registrationLevel={uniformRegLevel}
            variant="modal"
            onLoaded={(filled) => setUniformFilled(!!filled)}
            onSaved={() => { setUniformFilled(true); setShowUniform(false); }}
          />
        </PageModal>
      )}
    </div>
  );
}

function PageModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white">
          <h3 className="text-base md:text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Tutup
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-64px)] p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
