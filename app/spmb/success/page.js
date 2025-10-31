"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, CircleUser, Key, LogIn, Copy, Check } from "lucide-react";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function PPDBSuccessInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState({ id: "", username: "", nama: "", jenjang: "" });
  const [copiedField, setCopiedField] = useState("");

  useEffect(() => {
    const id = searchParams.get("id");
    const username = searchParams.get("username");
    const nama = searchParams.get("nama");
    const jenjangQS = searchParams.get("jenjang");
    setData((prev) => ({
      ...prev,
      id: id || "",
      username: username || "",
      nama: nama ? decodeURIComponent(nama) : "",
      jenjang: jenjangQS ? decodeURIComponent(jenjangQS) : prev.jenjang,
    }));
  }, [searchParams]);

  useEffect(() => {
    async function fetchJenjang() {
      if (!data.username || data.jenjang) return;
      try {
        const ref = doc(db, "users_app", data.username);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          const jenjangDb = d?.registrationLevel || d?.jenjang || "";
          if (jenjangDb) setData((s) => ({ ...s, jenjang: jenjangDb }));
        }
      } catch (e) {
        console.error("Gagal mengambil jenjang:", e);
      }
    }
    fetchJenjang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.username]);

  const loginHref = "/login";

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 2000);
    } catch (err) {
      console.error("Gagal menyalin:", err);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-emerald-100/20 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <div className="relative mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="text-center animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full mb-4 shadow-xl shadow-emerald-500/25 animate-scale-in">
            <CheckCircle className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-2 tracking-tight">
            Pendaftaran <span className="text-emerald-600">Berhasil</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Data Anda berhasil didaftarkan dan telah tersimpan di dalam sistem.
          </p>
        </div>

        {/* CARD KREDENSIAL - Premium Design */}
        <section className="mt-5 sm:mt-6 animate-fade-in-up animation-delay-200">
          <div className="rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 overflow-hidden">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3">
              <h2 className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
                <Key className="h-4 w-4" />
                Akun Login Anda
              </h2>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {/* Username */}
                <div className="group relative">
                  {copiedField === "username" && (
                    <div className="absolute left-0 -top-2 z-10 animate-slide-in-top">
                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-xs whitespace-nowrap">
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Disalin</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    <CircleUser className="h-4 w-4 sm:h-5 sm:w-5" />
                    Username
                  </div>
                  <div className="relative">
                    <div 
                      onClick={() => copyToClipboard(data.username, "username")}
                      className="text-lg sm:text-2xl md:text-3xl font-bold font-mono text-slate-900 break-all bg-slate-50 rounded-xl px-3 py-3 sm:px-4 sm:py-4 pr-10 border-2 border-slate-200 transition-all duration-300 group-hover:border-emerald-400 group-hover:shadow-lg group-hover:shadow-emerald-100 cursor-pointer relative"
                    >
                      {data.username || "Loading..."}
                      <div className="absolute bottom-2 right-2">
                        {copiedField === "username" ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="group relative">
                  {copiedField === "password" && (
                    <div className="absolute left-0 -top-2 z-10 animate-slide-in-top">
                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-xs whitespace-nowrap">
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Disalin</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    <Key className="h-4 w-4 sm:h-5 sm:w-5" />
                    Password
                  </div>
                  <div className="relative">
                    <div 
                      onClick={() => copyToClipboard(data.username, "password")}
                      className="text-lg sm:text-2xl md:text-3xl font-bold font-mono text-slate-900 break-all bg-slate-50 rounded-xl px-3 py-3 sm:px-4 sm:py-4 pr-10 border-2 border-slate-200 transition-all duration-300 group-hover:border-emerald-400 group-hover:shadow-lg group-hover:shadow-emerald-100 cursor-pointer relative"
                    >
                      {data.username || "Loading..."}
                      <div className="absolute bottom-2 right-2">
                        {copiedField === "password" ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm sm:text-sm text-emerald-800 font-medium text-center">
                Silakan login dengan <b>username</b> dan <b>password</b> Anda untuk melanjutkan <b>proses pendaftaran</b>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CARD INFORMASI + TOMBOL LOGIN */}
        <section className="mt-4 sm:mt-5 animate-fade-in-up animation-delay-400">
          <div className="rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="p-4 sm:p-6 text-center">
              <p className="text-sm sm:text-base text-slate-700 mb-4">
                Klik tombol di bawah untuk login.
              </p>
              
              <Link
                href={loginHref}
                className="group relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-4 focus:ring-emerald-300"
                aria-label="Login ke Portal"
              >
                <LogIn className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                Silahkan Login
                <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>

             <div className="mt-8 text-center">
  <p className="text-xs text-slate-500">Butuh bantuan?</p>
  <a
    href="https://wa.me/6287720242025"
    target="_blank"
    rel="noopener noreferrer"
    className="block text-sm font-semibold text-emerald-700 hover:underline mt-1"
  >
    (+62) 877&nbsp;2024&nbsp;2025
  </a>
  <p className="text-[11px] text-slate-500 mt-1">
    WhatsApp Panitia SPMB — klik nomor untuk chat
  </p>
</div>
            </div>
          </div>
        </section>
      </div>



      {/* Advanced Animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translate(-10px, -50%);
          }
          to {
            opacity: 1;
            transform: translate(-100%, -50%);
          }
        }

        @keyframes slide-in-top {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(5deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(-5deg);
          }
        }

        @keyframes float-delayed {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(-30px, 30px) rotate(-5deg);
          }
          66% {
            transform: translate(20px, -20px) rotate(5deg);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .animate-slide-down {
          animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .animate-slide-in {
          animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .animate-slide-in-top {
          animation: slide-in-top 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .animate-scale-in {
          animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .animate-float {
          animation: float 20s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 25s ease-in-out infinite;
        }

        .animation-delay-200 {
          animation-delay: 200ms;
        }

        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  );
}

export default function PPDBSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PPDBSuccessInner />
    </Suspense>
  );
}