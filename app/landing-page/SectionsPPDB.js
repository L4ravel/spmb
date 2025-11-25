// app/components/sections/SectionsPPDB.js
"use client";

import { useEffect, useRef } from "react";
import { BadgeCheck, GraduationCap, UsersRound, Sparkles, Award, BookOpen } from "lucide-react";
import Jenjang from "./Jenjang";
import CaraDaftar from "./CaraDaftar";
import LayananInformasi from "./LayananInformasi";

// util: observer -> tambah class 'is-visible' saat masuk viewport
function useReveal(ref, options = { threshold: 0.15 }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      options
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, options]);
}

// wrapper section dengan animasi reveal
function Section({ children, className = "", id }) {
  const ref = useRef(null);
  useReveal(ref);
  return (
    <section id={id} ref={ref} className={`reveal-up ${className}`}>
      {children}
    </section>
  );
}

// YouTube embed responsive 16:9 dengan border premium
function Youtube({ url }) {
  const idMatch = url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{6,})/);
  const id = idMatch ? idMatch[1] : url;
  const embed = `https://www.youtube.com/embed/${id}`;
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-2 shadow-2xl">
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-violet-200/50">
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={embed}
              title="YouTube video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Card dengan desain premium untuk Dewan Pengasuh
function DewanCard({ name, index }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-violet-50/30 p-6 shadow-lg ring-1 ring-violet-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-violet-200">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-violet-100/40 blur-2xl transition-transform duration-300 group-hover:scale-150" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
          <UsersRound className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <span className="block font-bold text-slate-900 text-lg">{name}</span>
          <span className="text-sm text-violet-600 font-medium">Dewan Pengasuh</span>
        </div>
      </div>
    </div>
  );
}

// Section Header yang elegant
function SectionHeader({ label, title, subtitle }) {
  return (
    <div className="text-center">
      {label && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-bold tracking-wider text-violet-700 uppercase">
            {label}
          </span>
        </div>
      )}
      <h2 className="mt-3 text-4xl font-black text-slate-900 md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function SectionsPPDB() {
  return (
     <div className="relative z-10 bg-gradient-to-b from-white via-violet-50/20 to-white pt-10 md:pt-14">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />
        <div className="absolute top-96 -left-40 h-96 w-96 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      {/* ====== Video ====== */}
      <Section className="relative mx-auto max-w-7xl px-4 pt-24 md:px-6 md:pt-32">
        <SectionHeader 
          label="Pengenalan"
          title="Video Profil Pondok"
          subtitle="Mengenal lebih dekat Pondok Pesantren Assunnah"
        />
        <div className="mt-12">
         <Youtube url="https://www.youtube.com/watch?v=T_6j_q5pWpI" />
        </div>
      </Section>

      {/* ====== Dewan Pengasuh ====== */}
      <Section className="relative mx-auto max-w-7xl px-4 pt-24 md:px-6 md:pt-32">
        <SectionHeader 
          label="Pembimbing"
          title="Dewan Pengasuh"
          subtitle="Para ustadz berpengalaman yang membimbing santri dengan penuh dedikasi"
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            "Ustadz Sofyan Bafein Zein",
            "Ustadz Mizan Qudsiyah, Lc., MA",
            "Ustadz Abdullah Husni, Lc",
          ].map((name, i) => (
            <DewanCard key={i} name={name} index={i} />
          ))}
        </div>
      </Section>

      {/* ====== Profil Pondok: Visi & Misi ====== */}
      <Section className="relative mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 md:pb-20 md:pt-32">
        <SectionHeader 
          label="Profil"
          title="Pondok Pesantren Assunnah"
          subtitle="Membentuk generasi Qur&apos;ani yang berakhlak mulia dan berilmu"
        />

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          {/* Visi + Misi */}
          <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200/50 md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                <Award className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 md:text-3xl">Visi</h3>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-6">
              <p className="text-lg leading-relaxed text-slate-700">
                Menjadi Salah Satu Pondok Pesantren Islam Terbaik di Pulau Lombok
                yang Bermanhaj dan Beraqidah Ahlussunnah Wal Jamaah
              </p>
            </div>

            <div className="mb-6 mt-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 md:text-3xl">Misi</h3>
            </div>
            <div className="space-y-4">
              {[
                "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Beraqidah dan Bermanhaj Salaf Ahlussunnah Wal Jamaah, Mengamalkan Ilmu dan Berakhlaq Mulia",
                "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Menghafal, Memahami, dan Mengamalkan Al Qur'an",
                "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Menguasai Bidang Sains, Teknologi Informatika, Bahasa Arab, dan Bahasa Inggris",
                "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Mampu Melanjutkan Pendidikan ke Jenjang Perguruan Tinggi Dalam dan Luar Negeri",
                "Melaksanakan Pembelajaran yang Aktif, Kreatif, Efektif, dan Menyenangkan",
                "Melaksanakan Pembelajaran dengan Standar Mu&apos;adalah dari Universitas Islam Madinah",
                "Manajemen dengan Standar SPM dan SNP",
                "Meningkatkan Profesionalisme Pendidik dan Tenaga Kependidikan",
                "Meningkatkan Kerjasama dan Kemitraan dengan Pihak Luar atau Stakeholder",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="group flex gap-4 rounded-xl bg-gradient-to-r from-white to-violet-50/30 p-4 transition-all duration-200 hover:shadow-md"
                >
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 transition-transform group-hover:scale-110" />
                  <span className="text-slate-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profil Mutu Lulusan + Tenaga Pengajar */}
          <div className="space-y-8">
            <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200/50 md:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 md:text-3xl">
                  Profil Mutu Lulusan
                </h3>
              </div>

              <div className="space-y-3">
                {[
                  "Mencintai Allah dan Rasul-Nya",
                  "BerAqidah dan Bermanhaj Salaf Ahlussunnah Wal Jamaah, Mengamalkan Ilmu dan Berakhlaq Mulia",
                  "Melaksanakan Praktek Ibadah Sesuai Sunnah",
                  "Menghafal, Memahami, dan Mengamalkan Al Qur'an",
                  "Menguasai Bahasa Arab dan Bahasa Inggris",
                  "Melanjutkan Pendidikan ke Jenjang Perguruan Tinggi Dalam dan Luar Negeri",
                ].map((txt, i) => (
                  <div
                    key={i}
                    className="group flex items-start gap-4 rounded-xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/20 p-5 transition-all duration-200 hover:-translate-x-1 hover:border-violet-300 hover:shadow-lg"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 transition-colors group-hover:bg-violet-200">
                      <GraduationCap className="h-4 w-4 text-violet-600" />
                    </div>
                    <p className="text-slate-700 leading-relaxed">{txt}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 p-8 shadow-xl md:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <UsersRound className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-black text-white md:text-3xl">
                  Tenaga Pengajar
                </h3>
              </div>
              <p className="text-lg leading-relaxed text-white/95 text-justify">
                Tenaga pengajar Pondok Pesantren Assunnah merupakan lulusan
                perguruan tinggi luar negeri (Universitas Islam Madinah, Kuliah
                Masjidil Haram, Kerajaan Saudi Arabia) dan dalam negeri (LIPIA,
                STAI Ali bin Abi Thalib, STDI Imam Syafi&apos;i, Ma&apos;had Aly As-Sunnah,
                UNRAM, dan lulusan berbagai Pondok Pesantren di Indonesia).
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ====== Jenjang Pendidikan ====== */}
      <Section id="jenjang" className="relative mx-auto max-w-7xl px-4 pb-24 pt-16 md:px-6 md:pb-32 md:pt-20">
        <Jenjang />
      </Section>

      {/* Cara Daftar Online */}
      <Section id="cara-daftar" className="relative mx-auto max-w-7xl px-0 md:px-0">
        <CaraDaftar />
      </Section>

      <Section className="relative mx-auto max-w-7xl px-0 md:px-0">
        <LayananInformasi />
      </Section>
    </div>
  );
}
