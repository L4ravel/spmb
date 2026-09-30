// app/admin/page.js
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, CreditCard, UserCheck, Calendar, FileText, BarChart3, MessageSquare,
  BookOpenCheck, DollarSign, Megaphone, KeyRound, LineChart, Wallet, ClipboardList,
  PieChart, MapPin, Table, RefreshCw, MessageCircle, PlusCircle, ReceiptText
} from 'lucide-react';

import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  isPendingRegistrationPayment,
  isVerifiedRegistrationPayment,
} from '@/app/admin/_lib/registrationPayment';
import { loadCanonicalDaftarUlang } from '@/app/admin/data-daftar-ulang/data/canonical';

/* ================== HALAMAN DASHBOARD (UI dipertahankan) ================== */
export default function AdminDashboard() {
  const shortcutGroups = [
    {
      id: 'data-master',
      label: 'Data Master',
      items: [
        { label: 'Data Peserta', href: '/admin/data-master', icon: Users },
        { label: 'Geografi Peserta', shortLabel: 'Geografi', href: '/admin/geografi', icon: MapPin },
          { label: "Penghasilan Orang Tua", shortLabel: "Penghasilan", href: "/admin/penghasilan-ortu", icon: Wallet },
        { label: 'Hasil Penilain Al-Quran', href: '/admin/hasil-tahfidz', icon: BarChart3 },
        { label: 'Hasil Final', href: '/admin/hasil-final', icon: Table },
        { label: 'Umumkan', href: '/admin/hasil-final/umumkan', icon: Megaphone },
        { label: "WA Kelulusan", shortLabel: "WA", href: "/admin/wa-kelulusan", icon: MessageCircle },
        { label: "Tambah WA Grup", shortLabel: "Add WA", href: "/admin/add-wa", icon: PlusCircle },
      ],
    },
    {
      id: 'pembayaran',
      label: 'Pembayaran',
      items: [
        { label: 'Verifikasi Pembayaran', href: '/admin/pembayaran', icon: CreditCard },
        { label: 'Rekap Pembayaran', href: '/admin/data-peserta', icon: BarChart3 },
        { label: 'Statistik Pembayaran', shortLabel: 'Statistik', href: '/admin/statistik-pembayaran', icon: LineChart },
        { label: 'Verifikasi Daftar Ulang', shortLabel: 'Rekap Daful', href: '/admin/daftar-ulang', icon: ClipboardList },
        { label: 'Data Daftar Ulang', shortLabel: 'Data Daful', href: '/admin/data-daftar-ulang', icon: Table },
        { label: 'Statistik Daftar Ulang', shortLabel: 'Stat Daful', href: '/admin/statistik-daftar-ulang', icon: PieChart },
        { label: 'Audit Uang Pendaftaran', shortLabel: 'Audit Bayar', href: '/admin/audit-uang-pendaftaran', icon: ReceiptText },
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
        { label: 'Input Biaya Pendaftaran', href: '/admin/input-pembayaran', icon: CreditCard },
        { label: 'Input Biaya Daftar Ulang', shortLabel: 'Input Bayar', href: '/admin/biaya-daftar-ulang', icon: Wallet },
        { label: 'Kuota', href: '/admin/kuota', icon: UserCheck },
        { label: 'WhatsApp', href: '/admin/whatshap', icon: MessageSquare },
        { label: 'Kelengkapan Berkas', href: '/admin/kelengkapan-berkas', icon: FileText },
        { label: 'Reset Password Peserta', href: '/admin/reset-password', icon: KeyRound },
      ],
    },
  ];

  const leftGroups = shortcutGroups.filter((_, index) => index % 2 === 0);
  const rightGroups = shortcutGroups.filter((_, index) => index % 2 !== 0);

  // === STATE Statistik umum (tetap, UI kamu)
  const [loading, setLoading] = useState(true);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [totalPembayaran, setTotalPembayaran] = useState(0);       // uang masuk (registrasi)
  const [totalTargetPayment, setTotalTargetPayment] = useState(0); // potensi (pendaftar × fee)
  const [statsReloadKey, setStatsReloadKey] = useState(0);

  // === Tambahan: angka Daftar Ulang dari LOGIKA STATISTIK (dataset TOTAL) ===
  const [totalDafulPendapatan, setTotalDafulPendapatan] = useState(0);
  const [totalDafulTunggakan, setTotalDafulTunggakan]   = useState(0);
  const [totalDafulPotensi, setTotalDafulPotensi]       = useState(0);
  const dafulRequestRef = useRef(false);
  const [loadingDaful, setLoadingDaful] = useState(false);
  const [dafulLoaded, setDafulLoaded] = useState(false);

  // === Mode tampilan kartu uang (UI tetap)
  const [moneyCardMode, setMoneyCardMode] = useState('pembayaran'); // 'pembayaran' | 'daful_pendapatan' | 'daful_tunggakan'
  const onToggleMoneyCard = () => {
    setMoneyCardMode((m) =>
      m === 'pembayaran' ? 'daful_pendapatan' :
      m === 'daful_pendapatan' ? 'daful_tunggakan' :
      'pembayaran'
    );
  };

  // ====== Ambil statistik umum (SEPERTI VERSI MU SEBELUMNYA, TANPA UBAH UI) ======
  useEffect(() => {
    let alive = true;
    async function fetchStats() {
      setLoading(true);
      try {
        const usersCol   = collection(db, 'users_app');
        const feesCol    = collection(db, 'fees');

        // Kedua koleksi independen: ambil paralel agar dashboard cepat tampil.
        const [feesSnap, allUsersSnap] = await Promise.all([
          getDocs(feesCol),
          getDocs(usersCol),
        ]);

        // --- Ambil semua fees sekali: build map label -> fee
        const feeByLabel = new Map();
        feesSnap.forEach((d) => {
          const x = d.data() || {};
          const label = (x.label || '').trim();
          const fee   = Number(x.fee ?? 0);
          if (label) feeByLabel.set(label, fee);
        });

        if (!alive) return;

        const allUsers = allUsersSnap.docs.map((userDoc) => ({
          id: userDoc.id,
          ...userDoc.data(),
        }));
        const verifiedUsers = allUsers.filter(isVerifiedRegistrationPayment);

        setTotalPeserta(allUsers.length);
        setPendingRegistrations(allUsers.filter(isPendingRegistrationPayment).length);
        setVerifiedCount(verifiedUsers.length);

        // === Total Pembayaran (uang real) = jumlah verified per level × fee(label)
        const countVerifiedByLevel = new Map();
        verifiedUsers.forEach((u) => {
          const levelLabel = (u.registrationLevel || '').trim();
          if (!levelLabel) return;
          countVerifiedByLevel.set(levelLabel, (countVerifiedByLevel.get(levelLabel) || 0) + 1);
        });

        let totalPaid = 0;
        countVerifiedByLevel.forEach((cnt, label) => {
          totalPaid += Number(feeByLabel.get(label) || 0) * Number(cnt || 0);
        });
        setTotalPembayaran(totalPaid);

        // === Target Pembayaran (potensi)
        const countAllByLevel = new Map();
        allUsersSnap.forEach((s) => {
          const u = s.data() || {};
          const label = (u.registrationLevel || '').trim();
          if (!label) return;
          countAllByLevel.set(label, (countAllByLevel.get(label) || 0) + 1);
        });

        let target = 0;
        countAllByLevel.forEach((cnt, label) => {
          target += Number(feeByLabel.get(label) || 0) * Number(cnt || 0);
        });

        setTotalTargetPayment(target);
      } catch (err) {
        console.error('[AdminDashboard] fetchStats error:', err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchStats();
    return () => { alive = false; };
  }, [statsReloadKey]);
  // ====== Ringkasan kanonis dari Data Daftar Ulang ======
  const reloadDaful = useCallback(async () => {
    if (dafulRequestRef.current) return;
    dafulRequestRef.current = true;
    setLoadingDaful(true);
    try {
      const { stats } = await loadCanonicalDaftarUlang(db);
      setTotalDafulPendapatan(stats.totalPaid);
      setTotalDafulTunggakan(stats.totalSisa);
      setTotalDafulPotensi(stats.totalTagihanNet);
      setDafulLoaded(true);
    } catch (e) {
      console.error('[AdminDashboard] reloadDaful error:', e);
    } finally {
      dafulRequestRef.current = false;
      setLoadingDaful(false);
    }
  }, []);

  // Data daftar ulang jauh lebih berat. Muat hanya saat mode tersebut dibuka,
  // sehingga angka pembayaran pendaftaran tidak ikut tertahan.
  useEffect(() => {
    if (moneyCardMode !== 'pembayaran' && !dafulLoaded) reloadDaful();
  }, [moneyCardMode, dafulLoaded, reloadDaful]);

  // Setelah kartu utama selesai, siapkan ringkasan daftar ulang di belakang layar.
  // Ini tidak menahan render dashboard, tetapi membuat perpindahan kartu terasa cepat.
  useEffect(() => {
    if (loading || dafulLoaded) return;
    const timer = window.setTimeout(() => reloadDaful(), 300);
    return () => window.clearTimeout(timer);
  }, [loading, dafulLoaded, reloadDaful]);

  // === Derive untuk progress bars & label (UI tetap)
  const percentVerified = totalPeserta > 0 ? Math.min(100, Math.round((verifiedCount / totalPeserta) * 100)) : 0;
  const percentPending  = totalPeserta > 0 ? Math.min(100, Math.round((pendingRegistrations / totalPeserta) * 100)) : 0;
  const percentRevenue  = totalTargetPayment > 0 ? Math.min(100, Math.round((totalPembayaran / totalTargetPayment) * 100)) : 0;

  const unpaidCount    = Math.max(0, totalPeserta - verifiedCount);
  const percentUnpaid  = totalPeserta > 0 ? Math.min(100, Math.round((unpaidCount / totalPeserta) * 100)) : 0;

  const moneyLabel = (() => {
    if (moneyCardMode === 'daful_pendapatan') return 'Total Pembayaran Daftar Ulang';
    if (moneyCardMode === 'daful_tunggakan')  return 'Tunggakan Daftar Ulang';
    return 'Total Pembayaran Pendaftaran';
  })();

  const moneyLoading = moneyCardMode === 'pembayaran' ? loading : loadingDaful || !dafulLoaded;

  const moneyValue = (() => {
    if (moneyLoading) return '…';
    if (moneyCardMode === 'daful_pendapatan') return formatCurrency(totalDafulPendapatan);
    if (moneyCardMode === 'daful_tunggakan')  return formatCurrency(totalDafulTunggakan);
    return formatCurrency(totalPembayaran);
  })();

  const dafulTotal = Math.max(0, totalDafulPotensi);
  const percentDafulPendapatan = dafulTotal > 0 ? Math.min(100, Math.round((totalDafulPendapatan / dafulTotal) * 100)) : 0;
  const percentDafulTunggakan  = dafulTotal > 0 ? Math.min(100, Math.round((totalDafulTunggakan  / dafulTotal) * 100)) : 0;

  const moneySub = (() => {
    if (moneyLoading) return ' ';
    if (moneyCardMode === 'daful_pendapatan') return `Terbayar: ${percentDafulPendapatan}% dari tagihan net`;
    if (moneyCardMode === 'daful_tunggakan')  return `Sisa: ${percentDafulTunggakan}% dari tagihan net`;
    return `Potensi: ${formatCurrency(totalTargetPayment)}`;
  })();

  // === Styling dinamis kartu uang (UI tetap)
  const modeStyles = (() => {
    if (moneyCardMode === 'daful_pendapatan') {
      return {
        border: 'border-green-500 hover:border-green-600',
        iconWrap: 'bg-green-100 group-hover:bg-green-500',
        icon: 'text-green-600 group-hover:text-white',
        gradient: 'from-green-50',
        bar: 'bg-green-500 group-hover:bg-green-600',
        progressPct: `${moneyLoading ? 0 : percentDafulPendapatan}%`,
      };
    }
    if (moneyCardMode === 'daful_tunggakan') {
      return {
        border: 'border-yellow-500 hover:border-yellow-600',
        iconWrap: 'bg-yellow-100 group-hover:bg-yellow-500',
        icon: 'text-yellow-600 group-hover:text-white',
        gradient: 'from-yellow-50',
        bar: 'bg-yellow-500 group-hover:bg-yellow-600',
        progressPct: `${moneyLoading ? 0 : percentDafulTunggakan}%`,
      };
    }
    return {
      border: 'border-purple-500 hover:border-purple-600',
      iconWrap: 'bg-purple-100 group-hover:bg-purple-500',
      icon: 'text-purple-600 group-hover:text-white',
      gradient: 'from-purple-50',
      bar: 'bg-purple-500 group-hover:bg-purple-600',
      progressPct: `${moneyLoading ? 0 : percentRevenue}%`,
    };
  })();

  return (
    <div className="min-h-dvh bg-slate-10 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Dashboard SPMB • Admin</h1>
        <div className="ml-auto" />
        <button
          type="button"
          onClick={() => {
            setStatsReloadKey((current) => current + 1);
            if (dafulLoaded) reloadDaful();
          }}
          disabled={loading || loadingDaful}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 text-black"
        >
          <RefreshCw className={`h-4 w-4 ${loading || loadingDaful ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      {/* Stats Cards (UI dipertahankan) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Peserta */}
        <Link href="/admin/data-master" className="group bg-white rounded-xl shadow-sm hover:shadow-xl p-5 border-l-4 border-blue-500 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer hover:border-blue-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm group-hover:text-blue-600 transition-colors">Total Peserta</p>
                <p className="text-3xl font-bold text-slate-900 mt-1 group-hover:text-blue-700 transition-colors">
                  {loading ? '…' : formatNumber(totalPeserta)}
                </p>
                <p className="text-xs text-slate-500 mt-1 group-hover:text-blue-600 transition-colors">
                  {loading ? ' ' : `Belum bayar: ${percentUnpaid}%`}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 group-hover:scale-110 transition-all duration-300">
                <Users className="text-blue-600 group-hover:text-white transition-colors" size={24} />
              </div>
            </div>
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 group-hover:bg-blue-600" style={{ width: loading ? '0%' : `${percentUnpaid}%` }} />
          </div>
        </Link>

        {/* Sudah Bayar */}
        <Link href="/admin/kuota" className="group bg-white rounded-xl shadow-sm hover:shadow-xl p-5 border-l-4 border-green-500 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer hover:border-green-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm group-hover:text-green-600 transition-colors">Sudah Bayar</p>
                <p className="text-3xl font-bold text-slate-900 mt-1 group-hover:text-green-700 transition-colors">
                  {loading ? '…' : formatNumber(verifiedCount)}
                </p>
                <p className="text-xs text-slate-500 mt-1 group-hover:text-green-600 transition-colors">
                  {loading ? ' ' : `Sudah bayar: ${percentVerified}%`}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 group-hover:scale-110 transition-all duration-300">
                <UserCheck className="text-green-600 group-hover:text-white transition-colors" size={24} />
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-500 group-hover:bg-green-600" style={{ width: loading ? '0%' : `${percentVerified}%` }} />
            </div>
          </div>
        </Link>

        {/* Menunggu Verifikasi */}
        <Link href="/admin/pembayaran" className="group bg-white rounded-xl shadow-sm hover:shadow-xl p-5 border-l-4 border-yellow-500 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer hover:border-yellow-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm group-hover:text-yellow-600 transition-colors">Menunggu Verifikasi</p>
                <p className="text-3xl font-bold text-slate-900 mt-1 group-hover:text-yellow-700 transition-colors">
                  {loading ? '…' : formatNumber(pendingRegistrations)}
                </p>
                <p className="text-xs text-slate-500 mt-1 group-hover:text-yellow-600 transition-colors">
                  {loading ? ' ' : `Menunggu: ${percentPending}%`}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-500 group-hover:scale-110 transition-all duration-300">
                <CreditCard className="text-yellow-600 group-hover:text-white transition-colors" size={24} />
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-yellow-500 h-2 rounded-full transition-all duration-500 group-hover:bg-yellow-600" style={{ width: loading ? '0%' : `${percentPending}%` }} />
            </div>
          </div>
        </Link>

        {/* KARTU UANG: klik untuk cycle nominal (UI tetap) */}
        <button
          type="button"
          onClick={onToggleMoneyCard}
          className={`text-left group bg-white rounded-xl shadow-sm hover:shadow-xl p-5 border-l-4 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer relative overflow-hidden ${modeStyles.border}`}
          title="Klik untuk mengganti tampilan nominal"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${modeStyles.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm transition-colors">{moneyLabel}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1 transition-colors">
                  {moneyValue}
                </p>
                <p className="text-xs text-slate-500 mt-1 transition-colors">
                  {moneySub}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-all duration-300 ${modeStyles.iconWrap}`}>
                <DollarSign className={`${modeStyles.icon}`} size={24} />
              </div>
            </div>

            {/* Progress bar sesuai mode (UI tetap) */}
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${modeStyles.bar}`}
                style={{ width: moneyLoading ? '0%' : modeStyles.progressPct }}
              />
            </div>

            {/* Hint kecil mode */}
            <div className="mt-2 text-[11px] text-slate-400">
              Klik untuk ganti: {moneyCardMode === 'pembayaran' ? 'Pembayaran Daful' : moneyCardMode === 'daful_pendapatan' ? 'Tunggakan Daful' : 'Total Pembayaran Pendaftaran'}
            </div>
          </div>
        </button>
      </div>

      {/* Dua kolom pintasan (UI tetap) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {leftGroups.map((group) => (
            <GroupCard key={group.id} label={group.label} items={group.items} />
          ))}
        </div>
        <div className="space-y-6">
          {rightGroups.map((group) => (
            <GroupCard key={group.id} label={group.label} items={group.items} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Utils tampilan */
function formatNumber(n) {
  try {
    return new Intl.NumberFormat('id-ID').format(n);
  } catch {
    return String(n ?? '');
  }
}
function formatCurrency(n) {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `Rp ${formatNumber(n || 0)}`;
  }
}

/** Kartu grup pintasan (UI tetap) */
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

/** Tombol pintasan (UI tetap) */
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
