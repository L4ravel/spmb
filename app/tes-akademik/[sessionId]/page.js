"use client";

import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import HeroSection from "./HeroSection";
import Footer from "@/app/components/Footer";

const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());

export default function PageTesAkademik() {
  const [nisn, setNisn] = useState("");
  const [nama, setNama] = useState("Peserta");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("appUser");
      if (raw) {
        const u = JSON.parse(raw);
        const candidate = u?.username || u?.id || "";
        if (isNISN(candidate)) setNisn(candidate);
        setNama(u?.displayName || u?.fullName || u?.name || "Peserta");
      }
    } catch {}
  }, []);

  if (!mounted) return null; // anti hydration mismatch

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header name={nama} />
      {/* Tombol aksi hanya di HeroSection */}
      <HeroSection nisn={nisn} nama={nama} />
      {/* area kosong, tapi ikut mendorong footer */}
      <main className="mx-auto w-full max-w-7xl px-4 md:px-6 pb-12 flex-1">
        {/* kosong */}
      </main>

      {/* jika Footer tidak terima className, bungkus dengan div mt-auto */}
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}
