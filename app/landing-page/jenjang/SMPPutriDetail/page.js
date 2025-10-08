// components/ppdb/SMPPutraDetail.js
"use client";

import { useState } from "react";
import {
  CheckCircle,
  FileText,
  Wallet,
  User,
  Phone,
  Award,
  Share2,
  ArrowRight,
  School,
  Image as ImageIcon,
} from "lucide-react";
import Header from "@/app/landing-page/header";
import Footer from "@/app/landing-page/footer";

export default function SMPPutraDetail() {
  const [activeTab, setActiveTab] = useState("persyaratan");

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "SMP Islam Khadijah",
        text: "Informasi pendaftaran SMP Islam Khadijah",
        url: window.location.href,
      });
    }
  };

  const tabs = [
    { id: "persyaratan", label: "Persyaratan", icon: FileText },
    { id: "biaya", label: "Biaya", icon: Wallet },
    { id: "profil", label: "Profil", icon: School },
    { id: "galeri", label: "Galeri", icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 py-12 sm:py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-3 sm:px-4 md:px-6">
          <div className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <School className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-black text-white sm:text-4xl md:text-5xl">
                SMP ISLAM KHADIJAH
              </h1>
              <p className="mt-0.5 text-base text-slate-300 sm:mt-1">Program Putri</p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-8 sm:py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* MAIN */}
          <div className="lg:col-span-8 min-w-0">
            {/* Tabs — scrollable on mobile */}
            <div className="mb-6 sm:mb-8 overflow-x-auto no-scrollbar">
              <div className="flex min-w-max gap-2 rounded-2xl border border-violet-200 bg-white p-2 sm:min-w-0 sm:flex-wrap w-full">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 sm:px-6 sm:py-3 sm:text-base ${
                        active
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                          : "text-slate-600 hover:bg-violet-50"
                      }`}
                    >
                      <Icon className="mx-auto mb-1 h-5 w-5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card konten */}
            <div className="rounded-3xl border border-violet-200 bg-white p-5 sm:p-8 md:p-10">
              {activeTab === "persyaratan" && <Persyaratan />}
              {activeTab === "biaya" && <Biaya />}
              {activeTab === "profil" && <Profil />}
              {activeTab === "galeri" && <Galeri />}
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="lg:col-span-4 min-w-0">
            <div className="space-y-6 lg:sticky lg:top-24">
              {/* Info Card */}
              <div className="overflow-hidden rounded-3xl border border-violet-200 bg-white">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-black text-white">Informasi Lembaga</h3>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <InfoItem icon={<Award className="h-5 w-5 text-amber-500" />} label="Akreditasi: A" />
                  <InfoItem
                    icon={<User className="h-5 w-5 text-violet-600" />}
                    label="Kepala/Ketua : SUHAIMI, S.Ag"
                    value="SUHAIMI, S.Ag"
                  />
                  <InfoItem
                    icon={<Phone className="h-5 w-5 text-green-600" />}
                    label="Wa/Telpon"
                    value="(+62) 819 9998 6735"
                  />
                </div>
              </div>

              {/* CTA */}
              <button className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 sm:p-6 transition-all hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-indigo-700 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center justify-between">
                  <span className="text-lg sm:text-xl font-black text-white">DAFTAR</span>
                  <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-white transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-200 bg-white px-5 py-3.5 sm:px-6 sm:py-4 font-bold text-violet-600 transition-all hover:border-violet-300 hover:bg-violet-50"
              >
                <Share2 className="h-5 w-5" />
                SHARE
              </button>

              {/* Features */}
              <div className="space-y-3 rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 sm:p-6">
                <h4 className="mb-3 sm:mb-4 font-bold text-slate-900">Keunggulan Program</h4>
                <FeatureItem text="Kurikulum Mu&apos;adalah Madinah" />
                <FeatureItem text="Asrama Nyaman & Aman" />
                <FeatureItem text="Pengajar Berpengalaman" />
                <FeatureItem text="Fasilitas Lengkap" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hapus scrollbar horizontal di Webkit/Firefox */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <Footer />
    </div>
  );
}

/* ====== Sub-sections (konten sama, styling responsive) ====== */
function Persyaratan() {
  return (
    <div>
      <p className="mb-6 text-slate-600">
        Berikut syarat-syarat pendaftaran untuk lembaga{" "}
        <span className="font-bold text-slate-900">SMP ISLAM KHADIJAH</span>
      </p>

      <div className="mb-8 sm:mb-10">
        <h2 className="mb-4 text-xl font-black text-slate-900 sm:mb-6 sm:text-2xl">1. Ketentuan Umum</h2>
        <div className="space-y-3 sm:space-y-4">
          <RequirementItem
            text={
              <>
                Membayar biaya pendaftaran sebesar{" "}
                <span className="font-bold text-violet-600">Rp 350.000</span>
              </>
            }
          />
          <RequirementItem text="Bersedia tinggal di asrama selama masa pendidikan" />
          <RequirementItem text="Bersedia mengikuti pendidikan hingga selesai" />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-black text-slate-900 sm:mb-6 sm:text-2xl">2. Dokumen Persyaratan</h2>
        <div className="space-y-3 sm:space-y-4">
          <DocumentItem text="Akta Kelahiran ( Uploud Dokumen )" />
          <DocumentItem text="Kartu Keluarga ( Uploud Dokumen )" />
          <DocumentItem text="Ijazah/Suket Aktif Sekolah ( Uploud Dokumen )" />
          <DocumentItem text="Pas Foto 3x4 Latar Merah ( Uploud Dokumen )" />  
        </div>
      </div>
    </div>
  );
}

function Biaya() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-black text-slate-900">Biaya Daftar Ulang</h2>
      <div className="overflow-x-auto rounded-2xl border border-violet-200">
        <table className="w-full min-w-[560px]">
          <thead className="bg-gradient-to-r from-violet-50 to-indigo-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">No</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">Biaya</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="transition-colors hover:bg-violet-50/50">
              <td className="px-4 py-3 font-semibold text-slate-900 sm:px-6 sm:py-4">1</td>
              <td className="px-4 py-3 text-slate-700 sm:px-6 sm:py-4">SPP Satu Semester</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 sm:px-6 sm:py-4">-</td>
            </tr>
            <tr className="transition-colors hover:bg-violet-50/50">
              <td className="px-4 py-3 font-semibold text-slate-900 sm:px-6 sm:py-4">2</td>
              <td className="px-4 py-3 text-slate-700 sm:px-6 sm:py-4">Uang Pangkal</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 sm:px-6 sm:py-4">-</td>
            </tr>
          </tbody>
          <tfoot className="bg-gradient-to-r from-violet-700 to-indigo-700">
            <tr>
              <td colSpan="2" className="px-4 py-3 text-left text-base font-black text-white sm:px-6 sm:py-4 sm:text-lg">
                Total
              </td>
              <td className="px-4 py-3 text-right text-base font-black text-white sm:px-6 sm:py-4 sm:text-lg">
                -
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Profil() {
  return (
    <div>
      <h2 className="mb-5 text-xl font-black text-slate-900 sm:mb-6 sm:text-2xl">Target</h2>
      <div className="mb-8 space-y-3 sm:mb-10 sm:space-y-3.5">
        <ProfileItem text="Menguasai dan mengamalkan dasar-dasar aqidah dan manhaj ahlussunnah wal jamaah." />
        <ProfileItem text="Menguasai dan mengamalkan dasar-dasar ibadah sesuai sunnah." />
        <ProfileItem text="Menguasai dan mengamalkan dasar-dasar akhlaq mulia sesuai sunnah." />
        <ProfileItem text="Menghafal 5 Juz (reguler) atau 10 Juz (Kelas Tahfizh) dan Bulughul Maram Kitab Thaharah (47 hadits)." />
        <ProfileItem text="Aktif berbahasa Arab." />
        <ProfileItem text="Berani berbahasa Inggris." />
        <ProfileItem text="Mencapai kriteria maksimum jenjang pendidikan menengah." />
        <ProfileItem text="Mampu mengoperasikan MS Word dan Excel." />
        <ProfileItem text="Kompetitif dalam seleksi masuk SMA unggulan." />
      </div>

      <h2 className="mb-5 text-xl font-black text-slate-900 sm:mb-6 sm:text-2xl">Ekstrakurikuler</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <EkstrakurikulerItem text="Tahfizh" />
        <EkstrakurikulerItem text="TIK" />        
      </div>
    </div>
  );
}

function Galeri() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-black text-slate-900">Galeri</h2>
      <div className="flex min-h-[220px] sm:min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-8 sm:p-12">
        <div className="text-center">
          <ImageIcon className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 text-violet-300" />
          <p className="text-base sm:text-lg font-semibold text-slate-600">Galeri foto akan segera ditambahkan</p>
        </div>
      </div>
    </div>
  );
}

/* ===== Reusable items ===== */
function RequirementItem({ text }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 p-3.5 sm:p-4 ring-1 ring-violet-100 w-full">
      <CheckCircle className="mt-0.5 h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-violet-600" />
      <p className="pt-0.5 text-slate-700">{text}</p>
    </div>
  );
}

function DocumentItem({ text }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 p-3.5 sm:p-4 ring-1 ring-violet-100 w-full">
      <FileText className="mt-0.5 h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-violet-600" />
      <p className="pt-0.5 text-slate-700">{text}</p>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="mt-0.5 font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function FeatureItem({ text }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle className="h-5 w-5 shrink-0 text-violet-600" />
      <span className="text-sm font-medium text-slate-700">{text}</span>
    </div>
  );
}

function ProfileItem({ text }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 p-3.5 sm:p-4 ring-1 ring-violet-100 w-full">
      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
      <p className="text-slate-700">{text}</p>
    </div>
  );
}

function EkstrakurikulerItem({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-white p-3.5 sm:p-4 w-full">
      <CheckCircle className="h-5 w-5 shrink-0 text-violet-600" />
      <span className="font-medium text-slate-700">{text}</span>
    </div>
    
  );
}
