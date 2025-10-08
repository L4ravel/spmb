'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  UserCheck,
  Trophy,
  Calendar,
  FileText,
  BarChart3,
  MessageSquare,
  BookOpenCheck,
  DollarSign,
  Megaphone,
} from 'lucide-react';

// === Firestore ===
// Pastikan kamu sudah punya export db di `@/lib/firebase` (initializeApp + getFirestore).
// Jika path-mu beda, cukup ganti import di bawah ini:
import { db } from '@/lib/firebase';
import {
  collection,
  getCountFromServer,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export default function AdminDashboard() {
  // === Pintasan SERAGAM dengan sidebar; tanpa "Dashboard" ===
  const shortcutGroups = [
    {
      id: 'data-master',
      label: 'Data Master',
      items: [
        { label: 'Data Peserta', href: '/admin/data-master', icon: Users },
        { label: 'Hasil Penilain Al-Quran', href: '/admin/hasil-tahfidz', icon: BarChart3 },
        { label: 'Hasil Final', href: '/admin/hasil-final', icon: Trophy },
        { label: 'Umumkan', href: '/admin/hasil-final/umumkan', icon: Megaphone },
      ],
    },
    {
      id: 'pembayaran',
      label: 'Pembayaran',
      items: [
        { label: 'Verifikasi Pembayaran', href: '/admin/pembayaran', icon: CreditCard },
        { label: 'Rekap Pembayaran', href: '/admin/data-peserta', icon: BarChart3 },
      ],
    },
    {
      id: 'builder',
      label: 'Pembuatan Soal',
      items: [
        { label: 'Pembuatan Soal Akademik', href: '/admin/soal-akademik', icon: FileText },
        { label: 'Pembuatan Soal Wawancara', href: '/admin/soal-wawancara', icon: FileText },
      ],
    },
    {
      id: 'ujian',
      label: 'Ujian Akademik',
      items: [
        { label: 'Pembuatan Jadwal', href: '/admin/jadwal-ujian', icon: Calendar },
        { label: 'Verifikasi Peserta', href: '/admin/verifikasi-ujian', icon: Users },
      ],
    },
    {
      id: 'penilaian',
      label: 'Form Penilaian',
      items: [
        { label: 'Bacaan Al-Quran', href: '/admin/nilai-tahfidz', icon: BookOpenCheck },
        { label: 'Tes Wawancara', href: '/admin/tes-wawancara', icon: MessageSquare },
      ],
    },
    {
      id: 'lainnya',
      label: 'Lainnya',
      items: [
        { label: 'Input Pembayaran', href: '/admin/input-pembayaran', icon: CreditCard },
        { label: 'Kuota', href: '/admin/kuota', icon: UserCheck },
        { label: 'WhatsApp', href: '/admin/whatshap', icon: MessageSquare },
        { label: 'Kelengkapan Berkas', href: '/admin/kelengkapan-berkas', icon: FileText },
      ],
    },
  ];

  // Bagi grup menjadi dua kolom: kiri & kanan (selang-seling)
  const [leftGroups, rightGroups] = useMemo(() => {
    const L = [], R = [];
    shortcutGroups.forEach((g, i) => (i % 2 === 0 ? L : R).push(g));
    return [L, R];
  }, [shortcutGroups]);

  // === STATE Statistik ===
  const [loading, setLoading] = useState(true);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [quotaTotal, setQuotaTotal] = useState(0);
  const [quotaUsed, setQuotaUsed] = useState(0);

useEffect(() => {
  let alive = true;

  async function fetchStats() {
    try {
      const usersCol = collection(db, 'users_app');
      const quotasCol = collection(db, 'quotas');

      // susun query dulu
      const pendingQ = query(usersCol, where('registrationPaymentStatus', '==', 'waiting_review'));

      // JALANKAN PARALEL
      const [totalSnap, pendingSnap, quotasSnap] = await Promise.all([
        getCountFromServer(usersCol),
        getCountFromServer(pendingQ),
        getDocs(quotasCol),
      ]);

      if (!alive) return;

      // hitung kuota (sum limit & used)
      let limitSum = 0;
      let usedSum = 0;
      quotasSnap.forEach((d) => {
        const x = d.data() || {};
        limitSum += Number(x.limit ?? 0);
        usedSum += Number(x.used ?? 0);
      });

      setTotalPeserta(totalSnap.data().count || 0);
      setPendingRegistrations(pendingSnap.data().count || 0);
      setQuotaTotal(limitSum);
      setQuotaUsed(usedSum);
    } catch (err) {
      console.error('[AdminDashboard] fetchStats error:', err);
    } finally {
      if (alive) setLoading(false);
    }
  }

  fetchStats();
  return () => { alive = false; };
}, []);


  const quotaAvailable = Math.max(0, quotaTotal - quotaUsed);

  return (
    <div className="min-h-dvh bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Dashboard PPDB • Admin</h1>       
      </div>

      {/* Stats ringkas (dinamis) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Peserta"
          value={loading ? '…' : formatNumber(totalPeserta)}
          icon={Users}
          accent="blue"
          note={!loading && `Terhitung saat ini`}
          noteColor="text-slate-500"
        />

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Kuota Tersedia</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? '…' : formatNumber(quotaAvailable)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {loading ? ' ' : `dari ${formatNumber(quotaTotal)} kuota`}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="text-green-600" size={24} />
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{
                width: loading
                  ? '0%'
                  : `${quotaTotal > 0 ? Math.min(100, Math.round(((quotaTotal - quotaAvailable) / quotaTotal) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>

        <StatCard
          title="Menunggu Verifikasi"
          value={loading ? '…' : formatNumber(pendingRegistrations)}
          icon={CreditCard}
          accent="yellow"
          note={!loading && `Terhitung Saat Ini`}
          noteColor="text-yellow-700"
        />

        <StatCard
          title="Total Pembayaran"
          value="—"
          icon={DollarSign}
          accent="purple"
          note="(opsional: tarik dari fees)"
          noteColor="text-slate-400"
        />
      </div>

      {/* Dua kolom: kiri & kanan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kiri */}
        <div className="space-y-6">
          {leftGroups.map((group) => (
            <GroupCard key={group.id} label={group.label} items={group.items} />
          ))}
        </div>
        {/* Kanan */}
        <div className="space-y-6">
          {rightGroups.map((group) => (
            <GroupCard key={group.id} label={group.label} items={group.items} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Utils */
function formatNumber(n) {
  try {
    return new Intl.NumberFormat('id-ID').format(n);
  } catch {
    return String(n ?? '');
  }
}

/** Kartu statistik mini */
function StatCard({ title, value, icon: Icon, accent = 'blue', note, noteColor }) {
  const borderColor = {
    blue: 'border-blue-500',
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    purple: 'border-purple-500',
  }[accent];

  const bgIcon = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  }[accent];

  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${borderColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgIcon}`}>
          <Icon size={24} />
        </div>
      </div>
      {note && <p className={`${noteColor} text-xs mt-3`}>{note}</p>}
    </div>
  );
}

/** Kartu grup pintasan */
function GroupCard({ label, items }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
      <div className="px-5 py-4 border-b border-slate-200/60">
        <h2 className="text-base md:text-lg font-bold text-slate-900">{label}</h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3">
          {items.map((it) => (
            <QuickLink key={it.href} href={it.href} label={it.label} Icon={it.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tombol pintasan */
function QuickLink({ href, label, Icon }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-white p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition
                 hover:border-violet-300 hover:bg-violet-50"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-violet-100">
        <Icon size={20} className="text-slate-700" />
      </div>
      <span className="font-semibold text-slate-800 group-hover:text-violet-700 text-sm md:text-base">
        {label}
      </span>
    </Link>
  );
}
