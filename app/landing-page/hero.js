"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Award, GraduationCap, Users } from "lucide-react";
import Section from "./SectionsPPDB";

/* ===== Advanced Background Decorations ===== */
function BgDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large gradient orbs (violet) */}
      <div
        className="absolute -right-[30%] -top-[25%] h-[130vmin] w-[130vmin] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(167,139,250,0.35) 0%, rgba(139,92,246,0.18) 40%, transparent 70%)",
          animation: "drift 20s ease-in-out infinite",
          filter: "blur(70px)",
        }}
      />
      <div
        className="absolute -left-[20%] top-[10%] h-[100vmin] w-[100vmin] rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(196,181,253,0.30) 0%, rgba(167,139,250,0.16) 50%, transparent 70%)",
          animation: "drift-reverse 25s ease-in-out infinite",
          filter: "blur(80px)",
        }}
      />

      {/* Animated gradient mesh (violet) */}
      <div
        className="absolute right-[5%] top-[15%] h-[70vmin] w-[70vmin] rounded-[40%]"
        style={{
          background:
            "linear-gradient(135deg, rgba(196,181,253,0.22), rgba(167,139,250,0.14), transparent 70%)",
          animation: "float1 12s ease-in-out infinite",
          transform: "rotate(25deg)",
        }}
      />

      {/* Floating shapes (violet muda) */}
      <div
        className="absolute left-[15%] bottom-[25%] h-32 w-32 rounded-3xl opacity-20"
        style={{
          background: "linear-gradient(135deg, #a78bfa, #c4b5fd)",
          animation: "float2 10s ease-in-out infinite",
          transform: "rotate(45deg)",
        }}
      />

      {/* Orbiting elements (ring & planet violet) */}
      <div className="absolute right-[15%] bottom-[30%]">
        <div className="relative h-48 w-48">
          <span className="absolute inset-0 rounded-full border-2 border-violet-300/35 animate-slow-rotate" />
          <span className="absolute inset-4 rounded-full border-2 border-violet-400/25 animate-slow-rotate-reverse" />
          <span className="absolute left-1/2 top-0 -ml-3 -mt-3 h-6 w-6 rounded-full bg-gradient-to-br from-violet-300 to-violet-400 shadow-md/30 animate-orbit opacity-80" />
          <span className="absolute right-0 top-1/2 -mr-2 -mt-2 h-4 w-4 rounded-full bg-gradient-to-br from-violet-200 to-violet-400 shadow-sm animate-orbit-reverse opacity-80" />
        </div>
      </div>

      {/* Particle grid (bulir violet) */}
      <div className="absolute left-[8%] top-[35%] grid grid-cols-8 gap-3 opacity-70">
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-violet-400 animate-pulse"
            style={{ animationDelay: `${i * 0.1}s`, opacity: 0.4 }}
          />
        ))}
      </div>

      {/* Animated arcs (garis violet pudar) */}
      <div
        className="absolute bottom-[15%] left-[10%] h-40 w-40 rounded-full border-8 border-violet-300/20 border-t-transparent border-r-transparent"
        style={{ animation: "slow-rotate 20s linear infinite" }}
      />
      <div
        className="absolute right-[8%] top-[40%] h-32 w-32 rounded-full border-6 border-violet-400/16 border-b-transparent border-l-transparent"
        style={{ animation: "slow-rotate-reverse 15s linear infinite" }}
      />

      {/* Glowing stars */}
      {[...Array(8)].map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute animate-twinkle"
          style={{
            left: `${15 + i * 10}%`,
            top: `${20 + (i % 3) * 20}%`,
            width: `${12 + (i % 3) * 4}px`,
            height: `${12 + (i % 3) * 4}px`,
            opacity: 0.3,
          }}
        >
          <path
            d="M12 2l2.2 5.6L20 9l-5.2 3.4L16 18l-4-2.8L8 18l1.2-5.6L4 9l5.8-1.4L12 2z"
            fill={i % 2 ? "#c4b5fd" : "#a78bfa"}
          />
        </svg>
      ))}
    </div>
  );
}

/* ===== Main Hero Component ===== */
export default function Hero() {
  return (
    <>
      {/* -mb-* untuk sedikit overlap; mask bikin fade mulus ke bawah */}
      <section
        className="relative w-full overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100 -mb-10 md:-mb-14"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.75) 90%, rgba(0,0,0,0) 100%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.75) 90%, rgba(0,0,0,0) 100%)",
        }}
      >
        {/* Radial glow overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 1400px 800px at 70% 30%, rgba(139,92,246,0.15), transparent 65%)",
          }}
        />
        <BgDecor />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-32 pt-24 md:px-6 md:pb-40 md:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Text */}
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 shadow-lg ring-1 ring-green-200 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-green-700 animate-pulse" />
                <span className="text-sm font-bold uppercase tracking-wider text-green-700">
                  Pendaftaran Dibuka
                </span>
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>

              <p className="mb-3 text-lg font-bold tracking-wide text-slate-700 md:text-xl">
                Pondok Pesantren Assunnah
              </p>

              <h1 className="mb-6 bg-gradient-to-r from-green-700 via-green-600 to-green-700 bg-clip-text text-5xl sm:text-7xl md:text-8xl font-black leading-[1.05] tracking-tight text-transparent">
                SPMB 2026
              </h1>

              <p className="mb-4 text-2xl md:text-4xl font-bold leading-relaxed text-slate-800">
                Sistem Penerimaan Murid Baru
              </p>
              <p className="mb-8 text-xl text-slate-600 md:text-2xl">
                Tahun Pelajaran 2026/2027
              </p>

              <div className="mb-8 rounded-2xl bg-gradient-to-r from-violet-200/10 to-indigo-500/10 p-6 backdrop-blur-sm ring-1 ring-violet-200">
                <p className="text-lg leading-relaxed text-slate-700">
                  Bergabunglah dengan{" "}
                  <span className="font-bold text-green-700">ribuan santri</span>{" "}
                  yang telah menempuh pendidikan Islam berkualitas dengan kurikulum{" "}
                  <span className="font-bold text-green-700">Mu&apos;adalah</span> dari
                  Universitas Islam Madinah.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/spmb"
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-base font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-violet-500/50 md:text-lg"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    Daftar Sekarang
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-indigo-700 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>

                <Link
                  href="/pengumuman"
                  className="group rounded-xl border-2 border-violet-300 bg-white/80 px-8 py-4 text-base font-bold text-violet-700 backdrop-blur-sm transition-all duration-300 hover:border-violet-500 hover:bg-violet-50 hover:shadow-lg md:text-lg"
                >
                  <span className="flex items-center gap-3">
                    Lihat Pengumuman
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-600">
                    Terakreditasi A
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-violet-600" />
                  <span className="text-sm font-semibold text-slate-600">
                    Mu&apos;adalah Madinah
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm font-semibold text-slate-600">
                    10.000+ Alumni
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Cards */}
            <div className="grid grid-cols-1 gap-4 w-full max-w-[360px] sm:max-w-[380px] lg:max-w-[400px] ml-auto">
  {/* Mu'adalah (atas) */}
  <div className="group relative overflow-hidden rounded-2xl border-2 border-violet-200 bg-white/95 p-5 sm:p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-violet-400 hover:shadow-violet-500/20">
    <div className="absolute -right-8 -top-8 h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-gradient-to-br from-violet-200/40 to-indigo-200/40 blur-2xl transition-all duration-300 group-hover:scale-150" />
    <div className="relative flex items-center gap-4 sm:gap-5">
      <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 p-3 ring-2 ring-violet-200">
        <img
          src="https://psb.pontrenassunnah.com/assets/images/uim.png"
          alt="Mu'adalah"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-violet-700">
          Mu&apos;adalah
        </p>
        <p className="text-sm font-semibold text-slate-600 group-hover:text-violet-600">
          Universitas Islam Madinah
        </p>
      </div>
    </div>
  </div>

  <div className="group relative overflow-hidden rounded-2xl border-2 border-violet-200 bg-white/95 p-5 sm:p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-violet-400 hover:shadow-violet-500/20">
  <div className="absolute -right-8 -top-8 h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-gradient-to-br from-violet-200/40 to-indigo-200/40 blur-2xl transition-all duration-300 group-hover:scale-150" />
  <div className="relative flex items-center gap-4 sm:gap-5">
    <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 p-3 ring-2 ring-violet-200">
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Kementerian_Agama_new_logo.png/535px-Kementerian_Agama_new_logo.png"
        alt="Kementerian Agama RI"
        className="h-full w-full object-contain"
      />
    </div>
    <div className="min-w-0">
      <p className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-violet-700">
        Kementerian Agama RI
      </p>
      <p className="text-sm font-semibold text-slate-600 group-hover:text-violet-600">
        Direktorat Jenderal Pendidikan Islam
      </p>
    </div>
  </div>
</div>

  {/* Terakreditasi (bawah) */}
  <div className="group relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-white/95 p-5 sm:p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-indigo-500/20">
    <div className="absolute -right-8 -top-8 h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/40 blur-2xl transition-all duration-300 group-hover:scale-150" />
    <div className="relative flex items-center gap-4 sm:gap-5">
      <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 p-3 ring-2 ring-indigo-200">
        <img
          src="https://psb.pontrenassunnah.com/assets/images/bansm.png"
          alt="Terakreditasi A"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-indigo-700">
          Terakreditasi A
        </p>
        <p className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">
          Badan Akreditasi Nasional
        </p>
      </div>
    </div>
  </div>
</div>

            {/* End Right Cards */}
          </div>
        </div>

        {/* NOTE: SVG wave dihapus. Mask di atas yang bikin fade mulus. */}

        {/* ==== Animations ==== */}
        <style jsx global>{`
          @keyframes drift { 0%,100%{transform:translate(0,0) rotate(0)} 33%{transform:translate(30px,-30px) rotate(5deg)} 66%{transform:translate(-20px,20px) rotate(-5deg)} }
          @keyframes drift-reverse { 0%,100%{transform:translate(0,0) rotate(0)} 33%{transform:translate(-30px,30px) rotate(-5deg)} 66%{transform:translate(20px,-20px) rotate(5deg)} }
          @keyframes float1 { 0%,100%{transform:translate(0,0) rotate(25deg)} 50%{transform:translate(18px,-26px) rotate(30deg)} }
          @keyframes float2 { 0%,100%{transform:translate(0,0) rotate(45deg)} 50%{transform:translate(-12px,20px) rotate(50deg)} }
          @keyframes slow-rotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          @keyframes slow-rotate-reverse { from{transform:rotate(360deg)} to{transform:rotate(0)} }
          @keyframes orbit { from{transform:rotate(0) translateX(70px) rotate(0)} to{transform:rotate(360deg) translateX(70px) rotate(-360deg)} }
          @keyframes orbit-reverse { from{transform:rotate(360deg) translateX(70px) rotate(360deg)} to{transform:rotate(0) translateX(70px) rotate(0)} }
          @keyframes twinkle { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.55;transform:scale(1.12)} }
          .animate-orbit{animation:orbit 8s linear infinite}
          .animate-orbit-reverse{animation:orbit-reverse 6s linear infinite}
          .animate-slow-rotate-reverse{animation:slow-rotate-reverse 25s linear infinite}
          .animate-twinkle{animation:twinkle 3s ease-in-out infinite}
          html{scroll-behavior:smooth}
        `}</style>
      </section>

      {/* ==== CALL SECTION PPDB AFTER HERO ==== */}
      <Section />
    </>
  );
}
