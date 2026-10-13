"use client";

import { ArrowRight, BadgeCheck, GraduationCap, UsersRound, Award, BookOpen } from "lucide-react";
import Jenjang from "./Jenjang";
import CaraDaftar from "./CaraDaftar";
import LayananInformasi from "./LayananInformasi";

const DEWAN = [
  "Ustadz Sofyan Bafein Zein",
  "Ustadz Mizan Qudsiyah, Lc., MA",
  "Ustadz Abdullah Husni, Lc",
];
const MISI = [
  "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Beraqidah dan Bermanhaj Salaf Ahlussunnah Wal Jamaah, Mengamalkan Ilmu dan Berakhlaq Mulia",
  "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Menghafal, Memahami, dan Mengamalkan Al Qur'an",
  "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Menguasai Bidang Sains, Teknologi Informatika, Bahasa Arab, dan Bahasa Inggris",
  "Menyelenggarakan Pengajaran dan Pengasuhan untuk Melahirkan Santri yang Mampu Melanjutkan Pendidikan ke Jenjang Perguruan Tinggi Dalam dan Luar Negeri",
  "Melaksanakan Pembelajaran yang Aktif, Kreatif, Efektif, dan Menyenangkan",
  "Melaksanakan Pembelajaran dengan Standar Mu&apos;adalah dari Universitas Islam Madinah",
  "Manajemen dengan Standar SPM dan SNP",
  "Meningkatkan Profesionalisme Pendidik dan Tenaga Kependidikan",
  "Meningkatkan Kerjasama dan Kemitraan dengan Pihak Luar atau Stakeholder",
];
const LULUSAN = [
  "Mencintai Allah dan Rasul-Nya",
  "BerAqidah dan Bermanhaj Salaf Ahlussunnah Wal Jamaah, Mengamalkan Ilmu dan Berakhlaq Mulia",
  "Melaksanakan Praktek Ibadah Sesuai Sunnah",
  "Menghafal, Memahami, dan Mengamalkan Al Qur'an",
  "Menguasai Bahasa Arab dan Bahasa Inggris",
  "Melanjutkan Pendidikan ke Jenjang Perguruan Tinggi Dalam dan Luar Negeri",
];

export default function SectionsPPDB() {
  return (
    <div className="spmb-sections">
      {/* LexTour's introduction: a large headline beside the supporting media. */}
      <section className="spmb-section spmb-introduction">
        <div className="spmb-container spmb-intro-layout">
          <div>
            <p className="spmb-eyebrow">Pengenalan</p>
            <h2 className="spmb-display-title">Video Profil Pondok</h2>
          </div>
          <div className="spmb-intro-detail">
            <p>Mengenal lebih dekat Pondok Pesantren Assunnah</p>
            <div className="spmb-video-frame">
              <iframe
                src="https://www.youtube.com/embed/T_6j_q5pWpI"
                title="YouTube video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <a className="spmb-help-link spmb-video-link" href="https://www.youtube.com/watch?v=T_6j_q5pWpI" target="_blank" rel="noreferrer">Video tidak tampil? Tonton di YouTube<ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      {/* LexTour's service panel: one broad surface, heading and integrated cells. */}
      <section className="spmb-section spmb-dewan-section">
        <div className="spmb-wide-panel">
          <div className="spmb-panel-heading">
            <div>
              <p className="spmb-eyebrow">Pembimbing</p>
              <h2 className="spmb-display-title">Dewan Pengasuh</h2>
            </div>
            <p>Para ustadz berpengalaman yang membimbing santri dengan penuh dedikasi</p>
          </div>
          <div className="spmb-dewan-grid">
            {DEWAN.map((name) => (
              <article className="spmb-dewan-cell" key={name}>
                <UsersRound aria-hidden="true" size={28} strokeWidth={1.5} />
                <h3>{name}</h3>
                <p>Dewan Pengasuh</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="spmb-section spmb-profile-section">
        <div className="spmb-container">
          <div className="spmb-intro-layout">
            <div>
              <p className="spmb-eyebrow">Profil</p>
              <h2 className="spmb-display-title">Pondok Pesantren Assunnah</h2>
            </div>
            <div className="spmb-intro-detail">
              <p>Membentuk generasi Qur&apos;ani yang berakhlak mulia dan berilmu</p>
              <div className="spmb-vision">
                <div className="spmb-subheading"><Award aria-hidden="true" /><h3>Visi</h3></div>
                <p>
                  Menjadi Salah Satu Pondok Pesantren Islam Terbaik di Pulau Lombok
                  yang Bermanhaj dan Beraqidah Ahlussunnah Wal Jamaah
                </p>
              </div>
            </div>
          </div>
          <div className="spmb-mission">
            <div className="spmb-subheading"><BookOpen aria-hidden="true" /><h3>Misi</h3></div>
            <div className="spmb-mission-grid">
              {MISI.map((item) => (
                <article className="spmb-mission-cell" key={item}>
                  <BadgeCheck aria-hidden="true" size={24} strokeWidth={1.5} />
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LexTour's preparation layout: heading on the left, a checklist on the right. */}
      <section className="spmb-section spmb-graduate-section">
        <div className="spmb-container spmb-preparation-layout">
          <div>
            <GraduationCap aria-hidden="true" size={32} strokeWidth={1.5} />
            <h2 className="spmb-display-title">Profil Mutu Lulusan</h2>
          </div>
          <div className="spmb-graduate-grid">
            {LULUSAN.map((txt) => (
              <div className="spmb-graduate-item" key={txt}>
                <BadgeCheck aria-hidden="true" size={20} />
                <p>{txt}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="spmb-section spmb-teachers-section">
        <div className="spmb-container spmb-intro-layout">
          <div>
            <UsersRound aria-hidden="true" size={32} strokeWidth={1.5} />
            <h2 className="spmb-display-title">Tenaga Pengajar</h2>
          </div>
          <div className="spmb-intro-detail">
            <p>
              Tenaga pengajar Pondok Pesantren Assunnah merupakan lulusan
              perguruan tinggi luar negeri (Universitas Islam Madinah, Kuliah
              Masjidil Haram, Kerajaan Saudi Arabia) dan dalam negeri (LIPIA,
              STAI Ali bin Abi Thalib, STDI Imam Syafi&apos;i, Ma&apos;had Aly As-Sunnah,
              UNRAM, dan lulusan berbagai Pondok Pesantren di Indonesia).
            </p>
          </div>
        </div>
      </section>

      <section id="jenjang" className="spmb-section spmb-catalogue-section">
        <div className="spmb-container"><Jenjang /></div>
      </section>
      <div id="cara-daftar"><CaraDaftar /></div>
      <LayananInformasi />
    </div>
  );
}
