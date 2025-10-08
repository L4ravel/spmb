"use client";

import Link from "next/link";
import { 
  ArrowRight, 
  Sparkles, 
  Award,
  GraduationCap,
  Users,
  BookOpen,
  Star
} from "lucide-react";

/* ===== Advanced Background Decorations ===== */
function BgDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large gradient orbs */}
      <div
        className="absolute -right-[30%] -top-[25%] h-[130vmin] w-[130vmin] rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(124,58,237,0.2) 40%, transparent 70%)",
          animation: "drift 20s ease-in-out infinite",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute -left-[20%] top-[10%] h-[100vmin] w-[100vmin] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(79,70,229,0.15) 50%, transparent 70%)",
          animation: "drift-reverse 25s ease-in-out infinite",
          filter: "blur(70px)",
        }}
      />
      
      {/* Animated gradient mesh */}
      <div
        className="absolute right-[5%] top-[15%] h-[70vmin] w-[70vmin] rounded-[40%]"
        style={{
          background:
            "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(139,92,246,0.15), transparent 70%)",
          animation: "float1 12s ease-in-out infinite",
          transform: "rotate(25deg)",
        }}
      />
      
      {/* Floating shapes */}
      <div
        className="absolute left-[15%] bottom-[25%] h-32 w-32 rounded-3xl opacity-20"
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          animation: "float2 10s ease-in-out infinite",
          transform: "rotate(45deg)",
        }}
      />
      
      {/* Orbiting elements */}
      <div className="absolute right-[15%] bottom-[30%]">
        <div className="relative h-48 w-48">
          <span className="absolute inset-0 rounded-full border-2 border-violet-300/40 animate-slow-rotate" />
          <span className="absolute inset-4 rounded-full border-2 border-indigo-300/30 animate-slow-rotate-reverse" />
          <span className="absolute left-1/2 top-0 -ml-3 -mt-3 h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 shadow-lg animate-orbit" />
          <span className="absolute right-0 top-1/2 -mr-2 -mt-2 h-4 w-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shadow-md animate-orbit-reverse" />
        </div>
      </div>
      
      {/* Particle grid */}
      <div className="absolute left-[8%] top-[35%] grid grid-cols-8 gap-3 opacity-60">
        {Array.from({ length: 32 }).map((_, i) => (
          <span 
            key={i} 
            className="h-2 w-2 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 animate-pulse" 
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      
      {/* Animated arcs */}
      <div
        className="absolute bottom-[15%] left-[10%] h-40 w-40 rounded-full border-8 border-violet-400/30 border-t-transparent border-r-transparent"
        style={{ animation: "slow-rotate 20s linear infinite" }}
      />
      <div
        className="absolute right-[8%] top-[40%] h-32 w-32 rounded-full border-6 border-indigo-400/25 border-b-transparent border-l-transparent"
        style={{ animation: "slow-rotate-reverse 15s linear infinite" }}
      />
      
      {/* Glowing stars */}
      {[...Array(8)].map((_, i) => (
        <Star
          key={i}
          className="absolute animate-twinkle"
          style={{
            left: `${15 + i * 10}%`,
            top: `${20 + (i % 3) * 20}%`,
            width: `${12 + (i % 3) * 4}px`,
            height: `${12 + (i % 3) * 4}px`,
            color: i % 2 ? '#a78bfa' : '#818cf8',
            animationDelay: `${i * 0.3}s`,
            opacity: 0.4,
          }}
        />
      ))}
    </div>
  );
}

/* ===== Stats Counter ===== */
function StatsCounter({ number, label, icon: Icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm p-5 shadow-lg ring-1 ring-violet-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-violet-300">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-violet-200/30 to-indigo-200/30 blur-2xl transition-all duration-300 group-hover:scale-150" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
          <Icon className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-3xl font-black text-slate-900">{number}</p>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ===== Main Hero Component ===== */
export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50">
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
          <div className="max-w-2xl">            
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 shadow-lg ring-1 ring-violet-200 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-violet-600 animate-pulse" />
              <span className="text-sm font-bold uppercase tracking-wider text-violet-700">
                Pendaftaran Dibuka
              </span>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
           
            <p className="mb-3 text-lg font-bold tracking-wide text-slate-700 md:text-xl">
              Pondok Pesantren Assunnah
            </p>
            
            <h1 className="mb-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-7xl font-black leading-[1.05] tracking-tight text-transparent md:text-8xl">
              SPMB 2026
            </h1>
            
            <p className="mb-4 text-3xl font-bold leading-relaxed text-slate-800 md:text-4xl">
              Sistem Penerimaan Murid Baru
            </p>
            <p className="mb-8 text-xl text-slate-600 md:text-2xl">
              Tahun Pelajaran 2026/2027
            </p>
            
            <div className="mb-8 rounded-2xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 p-6 backdrop-blur-sm ring-1 ring-violet-200">
              <p className="text-lg leading-relaxed text-slate-700">
                Bergabunglah dengan <span className="font-bold text-violet-700">ribuan santri</span> yang telah menempuh pendidikan Islam berkualitas dengan kurikulum <span className="font-bold text-indigo-700">Mu&apos;adalah</span> dari Universitas Islam Madinah.
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
                <span className="text-sm font-semibold text-slate-600">Terakreditasi A</span>
              </div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-violet-600" />
                <span className="text-sm font-semibold text-slate-600">Mu&apos;adalah Madinah</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <span className="text-sm font-semibold text-slate-600">10.000+ Alumni</span>
              </div>
            </div>
          </div>

          {/* Right: Stats Cards */}
          <div className="grid gap-6 sm:grid-cols-2">
            <StatsCounter number="20+" label="Tahun Berpengalaman" icon={Award} />
            <StatsCounter number="1000+" label="Santri Aktif" icon={Users} />
            <StatsCounter number="50+" label="Tenaga Pengajar" icon={GraduationCap} />
            {/* <StatsCounter number="A" label="Akreditasi BAN" icon={BookOpen} /> */}
          </div>
        </div>
      </div>

      {/* Wave Transition */}
      <div className="relative h-24 bg-white">
        <svg
          className="absolute bottom-0 w-full"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          style={{ height: '100px', transform: 'scaleY(-1)' }}
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
            fill="currentColor"
            className="text-white"
          />
        </svg>
      </div>

      {/* Floating Achievement Cards */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 w-full -translate-x-1/2 px-4">
        <div className="pointer-events-auto mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Mu&apos;adalah Card */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-violet-200 bg-white/95 p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-violet-400 hover:shadow-violet-500/20">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-violet-200/40 to-indigo-200/40 blur-2xl transition-all duration-300 group-hover:scale-150" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 p-3 ring-2 ring-violet-200 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <img
                  src="https://psb.pontrenassunnah.com/assets/images/uim.png"
                  alt="Mu&apos;adalah"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="text-xl font-black text-slate-900 group-hover:text-violet-700 transition-colors">
                  Mu&apos;adalah
                </p>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-violet-600 transition-colors">
                  Universitas Islam Madinah
                </p>
              </div>
            </div>
          </div>

          {/* Akreditasi Card */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-white/95 p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-indigo-400 hover:shadow-indigo-500/20">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/40 blur-2xl transition-all duration-300 group-hover:scale-150" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 p-3 ring-2 ring-indigo-200 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <img
                  src="https://psb.pontrenassunnah.com/assets/images/bansm.png"
                  alt="BAN-S/M"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="text-xl font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                  Terakreditasi A
                </p>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">
                  Badan Akreditasi Nasional
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-5deg); }
        }
        @keyframes drift-reverse {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-30px, 30px) rotate(-5deg); }
          66% { transform: translate(20px, -20px) rotate(5deg); }
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) rotate(25deg); }
          50% { transform: translate(20px, -30px) rotate(30deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) rotate(45deg); }
          50% { transform: translate(-15px, 25px) rotate(50deg); }
        }
        @keyframes slow-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slow-rotate-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(70px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(70px) rotate(-360deg); }
        }
        @keyframes orbit-reverse {
          from { transform: rotate(360deg) translateX(70px) rotate(360deg); }
          to { transform: rotate(0deg) translateX(70px) rotate(0deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        .animate-orbit {
          animation: orbit 8s linear infinite;
        }
        .animate-orbit-reverse {
          animation: orbit-reverse 6s linear infinite;
        }
        .animate-slow-rotate-reverse {
          animation: slow-rotate-reverse 25s linear infinite;
        }
        .animate-twinkle {
          animation: twinkle 3s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}