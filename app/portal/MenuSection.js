"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "./Card";

/** generator sessionId ringan: base36 timestamp + 8 hex acak */
function generateSessionId() {
  const ts = Date.now().toString(36);
  if (typeof window !== "undefined" && crypto?.getRandomValues) {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${ts}-${hex}`;
  }
  // fallback
  return `${ts}-${Math.random().toString(16).slice(2, 10)}`;
}

const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());

/* ===== MENU ===== */
export default function MenuSection({ isLulus }) {
  // sessionId unik per render halaman (jika ingin tracking klik dsb.)
  const sessionId = useMemo(() => generateSessionId(), []);

  // Ambil NISN dari sesi login (localStorage.appUser.username)
  const [nisn, setNisn] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("appUser");
      if (!raw) return;
      const u = JSON.parse(raw);
      const n = u?.username || u?.id || "";
      if (isNISN(n)) setNisn(String(n));
    } catch {}
  }, []);

  // Build href hasil ujian (fallback kalau nisn belum terdeteksi)
  const hasilHref = nisn ? `/hasil-ujian/${nisn}` : "/hasil-ujian";

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 pb-12">
      {/* Kelompok: Tes */}
      <div className="mt-4 text-sm uppercase tracking-wide text-slate-600">Tes</div>
      <section className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          // Lewat halaman konfirmasi agar patuh jadwal dan verifikasi pembayaran
          href={`/tes-akademik/${sessionId}`}
          icon="book"
          title="Tes Akademik"
          desc="Kerjakan soal akademik sesuai jadwal."
        />
        <Card
          href="/tes/quran"
          icon="quran"
          title="Tes Al Qur&apos;an"
          desc="Uji bacaan/hafalan sesuai ketentuan panitia."
        />
        <Card
          href="/tes/wawancara"
          icon="mic"
          title="Wawancara"
          desc="Sesi tanya-jawab bersama panitia."
        />
      </section>

      {/* Kelompok: Hasil */}
      <div className="mt-8 text-sm uppercase tracking-wide text-slate-600">Hasil</div>
      <section className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          href={hasilHref}
          icon="score"
          title="Lihat Nilai"
          desc="Rekap nilai Tes Akademik, Al Qur&apos;an, dan Wawancara."
        />
        <Card
          href="/hasil/pengumuman"
          icon="announce"
          title="Pengumuman"
          desc="Status kelulusan & instruksi lanjutan."
        />
        <Card
          href="/daftar-ulang"
          icon="refresh"
          title="Daftar Ulang"
          desc="Konfirmasi & unggah berkas daftar ulang."
          locked={!isLulus}
          lockNote="Terkunci. Akan aktif ketika status LULUS."
        />
      </section>
    </main>
  );
}
