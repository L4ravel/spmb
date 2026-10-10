"use client";

import Link from "next/link";
import { ArrowRight, Award, GraduationCap, Users, ShieldCheck } from "lucide-react";
import Section from "./SectionsPPDB";

export default function Hero() {
  return (
    <>
      <section className="spmb-hero">
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
            <p className="spmb-hero-eyebrow">Pondok Pesantren Assunnah</p>
            <h1>SPMB 2027</h1>
            <p className="spmb-hero-subtitle">Sistem Penerimaan Murid Baru</p>
            <p className="spmb-hero-year">Tahun Pelajaran 2026/2027</p>
            <div className="spmb-hero-description">
              <p>
                Bergabunglah dengan{" "}
                <span className="font-bold">ribuan santri</span>{" "}
                yang telah menempuh pendidikan Islam berkualitas dengan kurikulum{" "}
                <span className="font-bold">Mu&apos;adalah</span> dari
                Universitas Islam Madinah.
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
            <div className="spmb-trust">
              <div><Award className="h-5 w-5" /><span>Terakreditasi A</span></div>
              <div><GraduationCap className="h-5 w-5" /><span>Mu&apos;adalah Madinah</span></div>
              <div><Users className="h-5 w-5" /><span>10.000+ Alumni</span></div>
            </div>
          </div>
        </div>
        <div className="spmb-container spmb-hero-credentials">
            <div className="spmb-credential">
              <div className="spmb-credential-icon" aria-hidden="true"><GraduationCap /></div>
              <p>Mu&apos;adalah</p>
              <p>Universitas Islam Madinah</p>
            </div>
            <div className="spmb-credential">
              <div className="spmb-credential-icon" aria-hidden="true"><ShieldCheck /></div>
              <p>Kementerian Agama RI</p>
              <p>Direktorat Jenderal Pendidikan Islam</p>
            </div>
            <div className="spmb-credential">
              <div className="spmb-credential-icon" aria-hidden="true"><Award /></div>
              <p>Terakreditasi A</p>
              <p>Badan Akreditasi Nasional</p>
            </div>
        </div>
      </section>
      <Section />
    </>
  );
}
