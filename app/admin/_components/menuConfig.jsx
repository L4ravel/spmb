// app/admin/menuConfig.jsx
"use client";

import {
  Home, Users, CreditCard, UserCheck, Trophy, Calendar,
  FileText, BarChart3, MessageSquare, CheckCircle2,
  BookOpenCheck, Megaphone, KeyRound, LineChart, Wallet, ClipboardList, PieChart, MapPin, Table, MessageCircle
} from "lucide-react";

// Sumber menu tunggal (dipakai sidebar & bottom bar)
export const BASE_MENU_GROUPS = [
  {
    id: "main",
    label: "Main Menu",
    items: [
      { label: "Dashboard", shortLabel: "Dash", href: "/admin", icon: Home },
    ],
  },
  {
    id: "data-master",
    label: "Data Master",
    items: [
      { label: "Data Peserta", shortLabel: "Peserta", href: "/admin/data-master", icon: Users },
      { label: "Geografi Peserta", shortLabel: "Geografi", href: "/admin/geografi", icon: MapPin }, 
        { label: "Penghasilan Orang Tua", shortLabel: "Penghasilan", href: "/admin/penghasilan-ortu", icon: Wallet },
      { label: "Hasil Penilain Al-Quran", shortLabel: "Tahfidz", href: "/admin/hasil-tahfidz", icon: BarChart3 },
      { label: "Hasil Final", shortLabel: "Final", href: "/admin/hasil-final", icon: Trophy },
      { label: "Umumkan", shortLabel: "Umumkan", href: "/admin/hasil-final/umumkan", icon: Megaphone },
      { label: "WA Kelulusan", shortLabel: "WA", href: "/admin/wa-kelulusan", icon: MessageCircle },
    ],
  },
  {
    id: "pembayaran",
    label: "Pembayaran",
    items: [
      { label: "Verifikasi Pembayaran", shortLabel: "Verif Bayar", href: "/admin/pembayaran", icon: CreditCard },
      { label: "Rekap Pembayaran", shortLabel: "Rekap Bayar", href: "/admin/data-peserta", icon: BarChart3 },
      { label: "Statistik Pembayaran", shortLabel: "Statistik", href: "/admin/statistik-pembayaran", icon: LineChart },
      { label: "Verifikasi Daftar Ulang", shortLabel: "Rekap Daful", href: "/admin/daftar-ulang", icon: ClipboardList },
      { label: "Data Daftar Ulang", shortLabel: "Data Daful", href: "/admin/data-daftar-ulang", icon: Table },
      { label: "Statistik Daftar Ulang", shortLabel: "Stat Daful", href: "/admin/statistik-daftar-ulang", icon: PieChart },
    ],
  },
  {
    id: "builder",
    label: "Pembuatan Soal",
    items: [
      { label: "Pembuatan Soal Akademik", shortLabel: "Soal Akad", href: "/admin/soal-akademik", icon: FileText },
      { label: "Pembuatan Soal Wawancara", shortLabel: "Soal Waw", href: "/admin/soal-wawancara", icon: FileText },
    ],
  },
  {
    id: "ujian",
    label: "Ujian Akademik",
    items: [
      { label: "Pembuatan Jadwal", shortLabel: "Jadwal", href: "/admin/jadwal-ujian", icon: Calendar },
      { label: "Verifikasi Peserta", shortLabel: "Verif Ujian", href: "/admin/verifikasi-ujian", icon: CheckCircle2 },
    ],
  },
  {
    id: "penilaian",
    label: "Form Penilaian",
    items: [
      { label: "Bacaan Al-Quran", shortLabel: "Al-Qur'an", href: "/admin/nilai-tahfidz", icon: BookOpenCheck },
      { label: "Tes Wawancara", shortLabel: "Wawancara", href: "/admin/tes-wawancara", icon: MessageSquare },
    ],
  },
  {
    id: "lainnya",
    label: "Lainnya",
    items: [
      { label: "Input Biaya Pendaftaran", shortLabel: "Input Bayar", href: "/admin/input-pembayaran", icon: CreditCard },
      { label: "Input Biaya Daftar Ulang", shortLabel: "Input Bayar", href: "/admin/biaya-daftar-ulang", icon: Wallet },      
      { label: "Kuota", shortLabel: "Kuota", href: "/admin/kuota", icon: UserCheck },
      { label: "WhatsApp", shortLabel: "WA", href: "/admin/whatshap", icon: MessageSquare },
      { label: "Kelengkapan Berkas", shortLabel: "Berkas", href: "/admin/kelengkapan-berkas", icon: FileText },
      { label: "Reset Password Peserta", shortLabel: "Reset Pass", href: "/admin/reset-password", icon: KeyRound },
    ],
  },
];

// Filter menu berdasarkan daftar path yang diizinkan
export function filterMenuByAllowed(groups, allowed) {
  if (allowed?.has?.("*")) return groups;
  const set = new Set(allowed || []);
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        Array.from(set).some(
          (base) => it.href === base || it.href.startsWith(base + "/")
        )
      ),
    }))
    .filter((g) => g.items.length > 0);
}

// Opsional: daftar datar untuk bottom bar mobile
export function getMobileItems(groups = BASE_MENU_GROUPS) {
  return groups.flatMap((g) =>
    g.items.map((it) => ({
      ...it,
      shortLabel: it.shortLabel || it.label, // fallback
    }))
  );
}
