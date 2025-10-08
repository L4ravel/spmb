"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import HeroSection from "./HeroSection";
import dynamic from "next/dynamic";
const MenuSection = dynamic(() => import("./MenuSection"), { ssr: false });
import Footer from "./Footer";

function getCookie(name) {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="))
    ?.split("=")[1] || "";
}

export default function PortalPPDB_WhitePurple() {
  const router = useRouter();
  const [name, setName] = useState("Pengguna");
  const [statusPendaftaran, setStatusPendaftaran] = useState("MENUNGGU");
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Proteksi akses: butuh cookie sesi & localStorage
    const hasCookie = Boolean(getCookie("ppdb_session"));
    let localOk = false;
    try {
      const raw = localStorage.getItem("appUser");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.username) {
          setName(u.username);
          localOk = true;
        }
      }
    } catch {}
    if (!hasCookie || !localOk) {
      router.replace("/login");
      return;
    }
    setAuthed(true);
    setMounted(true);
    // Contoh bila mau set status:
    // setStatusPendaftaran("LULUS");
  }, [router]);

  const isLulus = statusPendaftaran === "LULUS";

  if (!authed) {
    // Hindari flash/mismatch saat redirect
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header name={name} />
      <HeroSection statusPendaftaran={statusPendaftaran} />
      <div suppressHydrationWarning>
        {mounted ? <MenuSection isLulus={isLulus} /> : null}
      </div>
      <Footer />
    </div>
  );
}
