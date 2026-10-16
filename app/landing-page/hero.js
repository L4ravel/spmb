"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Section from "./SectionsPPDB";

const heroPhotos = [
  "/images/hero/pondok-assunnah-gerbang.webp",
  "/images/hero/pondok-assunnah-lapangan-1.webp",
  "/images/hero/pondok-assunnah-lapangan-2.webp",
];

export default function Hero() {
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setActivePhoto((current) => (current + 1) % heroPhotos.length);
    }, 8000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <section className="spmb-hero">
        <div className="spmb-hero-media" aria-hidden="true">
          {heroPhotos.map((src, index) => (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              quality={75}
              className={index === activePhoto ? "is-active" : ""}
            />
          ))}
        </div>
        <div className="spmb-hero-overlay" aria-hidden="true" />
        <div className="spmb-hero-pattern" aria-hidden="true">
          <svg viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice">
            <g className="spmb-pattern-orbit">
              <rect x="880" y="100" width="480" height="480" rx="100" />
              <rect x="930" y="150" width="380" height="380" rx="80" />
              <rect x="980" y="200" width="280" height="280" rx="60" />
            </g>
            <g className="spmb-pattern-drift">
              <circle cx="120" cy="720" r="240" />
              <circle cx="120" cy="720" r="190" />
              <circle cx="120" cy="720" r="140" />
              <path d="M600 -80V220a90 90 0 0 0 90 90h90M760 900V680a90 90 0 0 1 90-90h220" />
            </g>
            <g className="spmb-pattern-stars">
              <path d="M750 90v36m-18-18h36M1300 690v48m-24-24h48M410 470v28m-14-14h28" />
            </g>
          </svg>
        </div>
        <div className="spmb-container spmb-hero-layout">
          <div className="spmb-hero-copy">
            <div className="spmb-hero-primary">
              <p className="spmb-hero-eyebrow">Pondok Pesantren Assunnah</p>
              <h1>SPMB 2027</h1>
            </div>
            <div className="spmb-hero-details">
              <p className="spmb-hero-subtitle">Sistem Penerimaan Murid Baru</p>
              <p className="spmb-hero-year">Tahun Pelajaran 2027/2028</p>
              <div className="spmb-hero-description">
                <p className="spmb-hero-invitation">
                  Mari bergabung bersama keluarga besar
                  <span>Pondok Pesantren Assunnah</span>
                </p>
                <p className="spmb-hero-vision">
                  Membentuk generasi Qur&apos;ani yang berilmu, berakhlak mulia,
                  dan beraqidah Ahlus Sunnah wal Jama&apos;ah.
                </p>
              </div>
              <div className="spmb-hero-actions">
                <Link href="https://ahsan.pontrenassunnah.com/spmb/daftar" className="spmb-button spmb-button-orange">
                  Daftar Sekarang <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="https://ahsan.pontrenassunnah.com/login" className="spmb-button spmb-button-outline">
                  Login <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="spmb-container spmb-hero-credentials">
            <div className="spmb-credential">
              <div className="spmb-credential-logo spmb-credential-logo-iu">
                <Image src="/logo/official/universitas-islam-madinah.svg" alt="Logo resmi Universitas Islam Madinah" width={56} height={56} />
              </div>
              <p>Mu&apos;adalah</p>
              <p>Universitas Islam Madinah</p>
            </div>
            <div className="spmb-credential">
              <div className="spmb-credential-logo spmb-credential-logo-kemenag">
                <Image src="/logo/official/kementerian-agama-bangka-tengah.png" alt="Logo Kementerian Agama Republik Indonesia" width={3694} height={3513} />
              </div>
              <p>Kementerian Agama RI</p>
              <p>Direktorat Jenderal Pendidikan Islam</p>
            </div>
            <div className="spmb-credential">
              <div className="spmb-credential-logo spmb-credential-logo-bansm">
                <Image src="/logo/official/ban-sm.jpg" alt="Logo Badan Akreditasi Nasional Sekolah dan Madrasah" width={600} height={404} />
              </div>
              <p>Terakreditasi A</p>
              <p>Badan Akreditasi Nasional Sekolah/Madrasah</p>
            </div>
        </div>
      </section>
      <Section />
    </>
  );
}
