// components/ppdb/CaraDaftar.js
"use client";

import { 
  MousePointerClick,
  FileText, 
  LogIn,
  Wallet, 
  Upload, 
  CheckCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

const STEPS_ONLINE = [
  {
    no: 1,
    title: "Klik Tombol Daftar Sekarang",
    desc: "Klik tombol daftar sekarang yang tersedia di website.",
    icon: MousePointerClick,
    color: "from-blue-500 to-cyan-500",
  },
  {
    no: 2,
    title: "Mengisi Data dan Upload Berkas",
    desc: "Mengisi data diri dan upload berkas yang diminta.",
    icon: FileText,
    color: "from-green-500 to-emerald-500",
  },
  {
    no: 3,
    title: "Login ke Akun Anda",
    desc: "Login menggunakan username dan password yang diberikan.",
    icon: LogIn,
    color: "from-purple-500 to-violet-500",
  },
  {
    no: 4,
    title: "Melakukan Pembayaran",
    desc: "Melakukan pembayaran melalui rekening yang tersedia.",
    icon: Wallet,
    color: "from-orange-500 to-amber-500",
  },
  {
    no: 5,
    title: "Upload Bukti Pembayaran",
    desc: "Upload bukti pembayaran setelah login.",
    icon: Upload,
    color: "from-pink-500 to-rose-500",
  },
  {
    no: 6,
    title: "Verifikasi dan Ujian Online",
    desc: "Tunggu akun diverifikasi dan bersiap mengikuti ujian online.",
    icon: CheckCircle,
    color: "from-indigo-500 to-blue-600",
  },
];

const STEPS_OFFLINE = [
  {
    no: 1,
    title: "Datang ke Stand Pendaftaran",
    desc: "Datang ke stand pendaftaran yang berada di pondok.",
    icon: MousePointerClick,
    color: "from-blue-500 to-cyan-500",
  },
  {
    no: 2,
    title: "Membawa Semua Berkas",
    desc: "Membawa semua berkas persyaratan (direkomendasikan dalam bentuk file).",
    icon: FileText,
    color: "from-green-500 to-emerald-500",
  },
  {
    no: 3,
    title: "Panitia Membantu Upload",
    desc: "Panitia akan membantu upload data dan berkas ke website.",
    icon: Upload,
    color: "from-purple-500 to-violet-500",
  },
  {
    no: 4,
    title: "Menerima Akun Login",
    desc: "Panitia akan memberi akun untuk login.",
    icon: LogIn,
    color: "from-orange-500 to-amber-500",
  },
  {
    no: 5,
    title: "Pembayaran ke Panitia",
    desc: "Melakukan proses pembayaran ke panitia.",
    icon: Wallet,
    color: "from-pink-500 to-rose-500",
  },
  {
    no: 6,
    title: "Verifikasi dan Ujian Online",
    desc: "Tunggu akun diverifikasi dan bersiap mengikuti ujian online.",
    icon: CheckCircle,
    color: "from-indigo-500 to-blue-600",
  },
];

function StepCard({ no, title, desc, icon: Icon, color, isLast }) {
  return (
    <div className="relative">
      {/* Connecting line untuk desktop - horizontal */}
      {!isLast && (
        <div className="absolute left-full top-1/2 z-0 hidden h-0.5 w-full -translate-y-1/2 xl:block">
          <div className="h-full w-full bg-gradient-to-r from-violet-200 via-violet-300 to-transparent" />
          <ArrowRight className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-2 text-violet-300" />
        </div>
      )}

      {/* Card */}
      <div className="group relative z-10 h-full">
        <div
          className="relative h-full overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/50 transition-all duration-300
                     hover:-translate-y-2 hover:shadow-2xl hover:ring-violet-300 md:p-7"
        >
          {/* Decorative background gradient */}
          <div 
            className={`absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl transition-all duration-300 group-hover:scale-150 group-hover:opacity-20`}
          />

          {/* Step number badge - corner */}
          <div className="absolute left-0 top-0">
            <div className={`flex h-12 w-12 items-center justify-center rounded-br-2xl rounded-tl-2xl bg-gradient-to-br ${color} shadow-lg`}>
              <span className="text-xl font-black text-white">{no}</span>
            </div>
          </div>

          {/* Content */}
          <div className="relative pt-6">
            {/* Icon */}
            <div className="mb-4">
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                <Icon className="h-7 w-7 text-white" />
              </div>
            </div>

            {/* Title */}
            <h3 className="mb-3 text-xl font-bold leading-snug text-slate-900 md:text-xl">
              {title}
            </h3>

            {/* Description */}
            <p className="text-sm leading-relaxed text-slate-600 md:text-base">
              {desc}
            </p>

            {/* Decorative arrow indicator */}
            <div className="mt-4 flex items-center text-sm font-semibold text-violet-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span>Pelajari lebih lanjut</span>
              <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CaraDaftar({ steps = STEPS_ONLINE, title = "Cara Daftar Online" }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-violet-50/30 to-white py-16 md:py-24">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full bg-violet-200/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 -translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        {/* PENDAFTARAN ONLINE */}
        <div className="mb-20">
          {/* Header */}
          <div className="mb-12 text-center md:mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-bold uppercase tracking-wider text-violet-700">
                Panduan Pendaftaran
              </span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 md:text-5xl">
              Cara Daftar Online
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Ikuti langkah-langkah berikut untuk menyelesaikan pendaftaran secara online
            </p>
          </div>

          {/* Steps Grid */}
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {STEPS_ONLINE.map((s, idx) => (
              <StepCard 
                key={s.no} 
                no={s.no} 
                title={s.title} 
                desc={s.desc}
                icon={s.icon}
                color={s.color}
                isLast={idx === STEPS_ONLINE.length - 1}
              />
            ))}
          </div>

          {/* Call to action */}
          <div className="mt-12 text-center md:mt-16">
            <div className="inline-flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 px-8 py-6 shadow-2xl md:flex-row md:px-10 md:py-8">
              <div className="text-center md:text-left">
                <p className="text-lg font-bold text-white md:text-xl">
                  Siap untuk mendaftar online?
                </p>
                <p className="mt-1 text-sm text-violet-100 md:text-base">
                  Mulai perjalanan pendidikan Anda bersama kami
                </p>
              </div>
              <Link href="/spmb">
                <button className="shrink-0 rounded-xl bg-white px-6 py-3 font-bold text-violet-600 shadow-lg transition-all hover:scale-105 hover:shadow-xl">
                  Daftar Sekarang
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* PENDAFTARAN OFFLINE */}
        <div>
          {/* Header */}
          <div className="mb-12 text-center md:mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-bold uppercase tracking-wider text-indigo-700">
                Alternatif Pendaftaran
              </span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 md:text-5xl">
              Cara Daftar Offline
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Daftar langsung di stand pendaftaran pondok dengan bantuan panitia
            </p>
          </div>

          {/* Steps Grid */}
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {STEPS_OFFLINE.map((s, idx) => (
              <StepCard 
                key={s.no} 
                no={s.no} 
                title={s.title} 
                desc={s.desc}
                icon={s.icon}
                color={s.color}
                isLast={idx === STEPS_OFFLINE.length - 1}
              />
            ))}
          </div>

          {/* Info box */}
          <div className="mt-12 text-center md:mt-16">
            <div className="inline-flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 px-8 py-6 shadow-2xl md:px-10 md:py-8">
              <div className="text-center">
                <p className="text-lg font-bold text-white md:text-xl">
                  Ingin mendaftar secara offline?
                </p>
                <p className="mt-2 text-sm text-indigo-100 md:text-base">
                  Kunjungi stand pendaftaran di pondok dan bawa semua berkas persyaratan
                </p>
                <p className="mt-3 text-xs font-semibold text-white md:text-sm">
                  💡 Tips: Siapkan berkas dalam bentuk file digital untuk memudahkan proses
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}