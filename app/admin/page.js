// app/admin/page.js
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, CreditCard, UserCheck, Calendar, FileText, BarChart3, MessageSquare,
  BookOpenCheck, DollarSign, Megaphone, KeyRound, LineChart, Wallet, ClipboardList,
  PieChart, MapPin, Table, RefreshCw, MessageCircle, PlusCircle
} from 'lucide-react';

import { db } from '@/lib/firebase';
import {
  collection,
  getCountFromServer,
  query,
  where,
  getDocs,
  doc, getDoc, collection as fbCollection, getDocs as fbGetDocs,
  orderBy, limit as fbLimit, startAfter
} from 'firebase/firestore';

// ===== Ambil pager yang sama persis dengan halaman Statistik Daftar Ulang =====
import { listUsersWithPaymentPage } from '@/app/admin/data-daftar-ulang/data/firestore'; // pastikan path ini sama seperti di page statistikmu

/* ================== UTIL LOGIKA: disamakan dengan halaman Statistik Daful ================== */
// normalisasi teks
const up = (v) => (v ?? '').toString().trim().toUpperCase();
// normalisasi status PTK
const normPTK = (v) => {
  const s = up(v);
  if (['APPROVED','VERIFIED','ACCEPTED','CONFIRMED'].includes(s)) return 'APPROVED';
  if (['REJECTED','DENIED','DECLINED'].includes(s)) return 'REJECTED';
  return s || 'PENDING';
};
// kandidat kunci dokumen
const pickDocKeys = (r) =>
  [r?.id, r?.docId, r?.username, r?.uid, r?.userId, r?.NIS, r?.NISN, r?.nisn]
    .map((x) => (x ?? '').toString().trim())
    .filter(Boolean);

// prefetch finalDecision & status ptk_confirmation/current → sama persis seperti di statistik
async function prefetchMetaForKeys(keys, cache) {
  const unique = Array.from(new Set(keys)).filter(Boolean);
  const missing = unique.filter((k) => !cache.has(k));
  if (missing.length === 0) return cache;

  await Promise.all(
    missing.map(async (k) => {
      let fd = ''; let ptkApproved = false;
      try {
        const [userDoc, ptkDoc] = await Promise.all([
          getDoc(doc(db, 'users_app', k)),
          getDoc(doc(db, 'users_app', k, 'ptk_confirmation', 'current')),
        ]);
        if (userDoc.exists()) fd = up(userDoc.data()?.finalDecision);
        if (ptkDoc.exists())  ptkApproved = normPTK(ptkDoc.data()?.status) === 'APPROVED';
      } catch {}
      cache.set(k, { fd, ptkApproved });
    })
  );

  // fallback cari finalDecision terbaru di subkoleksi finalDecision
  const needFd = missing.filter((k) => !cache.get(k)?.fd);
  const CONCURRENCY = 6;
  for (let i = 0; i < needFd.length; i += CONCURRENCY) {
    const slice = needFd.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (k) => {
        try {
          const qref = query(
            fbCollection(db, 'users_app', k, 'finalDecision'),
            orderBy('finalDecidedAt', 'desc'),
            fbLimit(1)
          );
          const snap = await fbGetDocs(qref);
          if (!snap.empty) {
            const fd = up(snap.docs[0].data()?.finalDecision);
            const prev = cache.get(k) || { fd:'', ptkApproved:false };
            cache.set(k, { ...prev, fd });
          }
        } catch {}
      })
    );
  }
  return cache;
}

async function enrichBatch(rows, cache) {
  const allKeys = rows.flatMap((r) => pickDocKeys(r));
  await prefetchMetaForKeys(allKeys, cache);
  return rows.map((r) => {
    const keys = pickDocKeys(r);
    let fd = up(r?.finalDecision);
    let ptkApproved = false;
    for (const k of keys) {
      const m = cache.get(k);
      if (!m) continue;
      if (!fd && m.fd) fd = m.fd;
      if (m.ptkApproved) ptkApproved = true;
      if (fd && ptkApproved) break;
    }
    return { ...r, __finalDecision: fd, __ptkApproved: !!ptkApproved };
  });
}

const isRowPTK     = (r) => !!r.__ptkApproved;
const isRowNonPTK  = (r) => !r.__ptkApproved && up(r.__finalDecision) === 'LULUS';
const isRowValid   = (r) => isRowPTK(r) || isRowNonPTK(r); // dataset "total" persis seperti statistik
const isLunas      = (r) => Number(r?.tunggakan || 0) <= 0 && Number(r?.kewajibanTotal || 0) > 0;

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

  const [leftGroups, rightGroups] = useMemo(() => {
    const L = [], R = [];
    shortcutGroups.forEach((g, i) => (i % 2 === 0 ? L : R).push(g));
    return [L, R];
  }, [shortcutGroups]);

  // === STATE Statistik umum (tetap, UI kamu)
  const [loading, setLoading] = useState(true);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [quotaTotal, setQuotaTotal] = useState(0);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [totalPembayaran, setTotalPembayaran] = useState(0);       // uang masuk (registrasi)
  const [totalTargetPayment, setTotalTargetPayment] = useState(0); // potensi (pendaftar × fee)
  const [potentialCount, setPotentialCount] = useState(0);

  // === Tambahan: angka Daftar Ulang dari LOGIKA STATISTIK (dataset TOTAL) ===
  const [totalDafulPendapatan, setTotalDafulPendapatan] = useState(0);
  const [totalDafulTunggakan, setTotalDafulTunggakan]   = useState(0);
  const [totalDafulPotensi, setTotalDafulPotensi]       = useState(0);
  const metaCacheRef = useRef(new Map());
  const [loadingDaful, setLoadingDaful] = useState(false);

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
      try {
        const usersCol   = collection(db, 'users_app');
        const quotasCol  = collection(db, 'quotas');
        const feesCol    = collection(db, 'fees');

        // --- Ambil semua fees sekali: build map label -> fee
        const feesSnap = await getDocs(feesCol);
        const feeByLabel = new Map();
        feesSnap.forEach((d) => {
          const x = d.data() || {};
          const label = (x.label || '').trim();
          const fee   = Number(x.fee ?? 0);
          if (label) feeByLabel.set(label, fee);
        });

        // --- Query counts dasar
        const pendingQ  = query(usersCol, where('registrationPaymentStatus', '==', 'waiting_review'));
        const verifiedQ = query(usersCol, where('registrationPaymentStatus', '==', 'verified'));

        const [totalSnap, pendingSnap, quotasSnap, verifiedSnap, allUsersSnap] = await Promise.all([
          getCountFromServer(usersCol),
          getCountFromServer(pendingQ),
          getDocs(quotasCol),
          getDocs(verifiedQ),
          getDocs(usersCol),
        ]);

        if (!alive) return;

        // === Index user & hitung per level
        const existingIds = new Set();
        const countByLevel = new Map();
        allUsersSnap.forEach((s) => {
          const id = s.id;
          existingIds.add(id);
          const u = s.data() || {};
          const level = (u.registrationLevel || '').trim();
          if (level) countByLevel.set(level, (countByLevel.get(level) || 0) + 1);
        });

        // === Kuota tervalidasi
        let limitSum = 0;
        let usedSum  = 0;

        quotasSnap.forEach((d) => {
          const q = d.data() || {};
          const label = (q.label ?? d.id ?? '').trim();
          const limit = Number(q.limit ?? 0);
          limitSum += limit;

          if (Array.isArray(q.assignedUsernames)) {
            const validUsed = q.assignedUsernames.filter((u) => existingIds.has(String(u))).length;
            usedSum += validUsed;
            return;
          }

          if (q.usedBy && typeof q.usedBy === 'object') {
            const validUsed = Object.keys(q.usedBy).filter((u) => existingIds.has(String(u))).length;
            usedSum += validUsed;
            return;
          }

          if (label) usedSum += Number(countByLevel.get(label) || 0);
        });

        setTotalPeserta(totalSnap.data().count || 0);
        setPendingRegistrations(pendingSnap.data().count || 0);
        setQuotaTotal(limitSum);
        setQuotaUsed(usedSum);
        setVerifiedCount(verifiedSnap.size || 0);

        // === Total Pembayaran (uang real) = jumlah verified per level × fee(label)
        const countVerifiedByLevel = new Map();
        verifiedSnap.forEach((docSnap) => {
          const u = docSnap.data() || {};
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
        let totalPotentialUsers = 0;
        allUsersSnap.forEach((s) => {
          const u = s.data() || {};
          const label = (u.registrationLevel || '').trim();
          if (!label) return;
          countAllByLevel.set(label, (countAllByLevel.get(label) || 0) + 1);
          totalPotentialUsers += 1;
        });

        let target = 0;
        countAllByLevel.forEach((cnt, label) => {
          target += Number(feeByLabel.get(label) || 0) * Number(cnt || 0);
        });

        setPotentialCount(totalPotentialUsers);
        setTotalTargetPayment(target);
      } catch (err) {
        console.error('[AdminDashboard] fetchStats error:', err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchStats();
    return () => { alive = false; };
  }, []);

  // ====== Ambil angka Daftar Ulang via pager (PERSIS seperti page statistik) ======
  const reloadDaful = useCallback(async () => {
    setLoadingDaful(true);
    try {
      const cache = metaCacheRef.current;
      let local = [];
      let cursor = null;
      let safety = 0;
      const SAFETY_LIMIT = 200;

      while (safety < SAFETY_LIMIT) {
        safety += 1;
        const res = await listUsersWithPaymentPage({ pageSize: 200, cursor });
        const batch = res?.list || [];
        if (!batch.length) break;
        const enriched = await enrichBatch(batch, cache);
        local = local.concat(enriched);
        cursor = res?.lastDoc || null;
        if (!cursor) break;
      }

      // dataset TOTAL: PTK + NonPTK LULUS (identik statistik)
      const effectiveRows = local.filter(isRowValid); // :contentReference[oaicite:2]{index=2}
      let totalTunggakan = 0, totalPendapatan = 0;

      for (const r of effectiveRows) {
        const tunggakan = Number(r?.tunggakan || 0);
        const tagihan   = Number(r?.kewajibanTotal || 0);
        const pendapatan = Math.max(tagihan - tunggakan, 0);
        totalTunggakan  += Math.max(tunggakan, 0);
        totalPendapatan += pendapatan;
      }
      const potensi = totalPendapatan + totalTunggakan; // :contentReference[oaicite:3]{index=3}

      setTotalDafulPendapatan(totalPendapatan);
      setTotalDafulTunggakan(totalTunggakan);
      setTotalDafulPotensi(potensi);
    } catch (e) {
      console.error('[AdminDashboard] reloadDaful error:', e);
    } finally {
      setLoadingDaful(false);
    }
  }, []);

  useEffect(() => { reloadDaful(); }, [reloadDaful]);

  // === Derive untuk progress bars & label (UI tetap)
  const quotaAvailable = Math.max(0, quotaTotal - quotaUsed);
  const percentVerified = totalPeserta > 0 ? Math.min(100, Math.round((verifiedCount / totalPeserta) * 100)) : 0;
  const percentPending  = totalPeserta > 0 ? Math.min(100, Math.round((pendingRegistrations / totalPeserta) * 100)) : 0;
  const percentRevenue  = totalTargetPayment > 0 ? Math.min(100, Math.round((totalPembayaran / totalTargetPayment) * 100)) : 0;

  const unpaidCount    = Math.max(0, totalPeserta - verifiedCount);
  const percentUnpaid  = totalPeserta > 0 ? Math.min(100, Math.round((unpaidCount / totalPeserta) * 100)) : 0;

  const moneyLabel = (() => {
    if (moneyCardMode === 'daful_pendapatan') return 'Pendapatan Daftar Ulang';
    if (moneyCardMode === 'daful_tunggakan')  return 'Tunggakan Daftar Ulang';
    return 'Total Pembayaran Pendaftaran';
  })();

  const moneyValue = (() => {
    if (loading || loadingDaful) return '…';
    if (moneyCardMode === 'daful_pendapatan') return formatCurrency(totalDafulPendapatan);
    if (moneyCardMode === 'daful_tunggakan')  return formatCurrency(totalDafulTunggakan);
    return formatCurrency(totalPembayaran);
  })();

  const dafulTotal = Math.max(0, totalDafulPendapatan + totalDafulTunggakan);
  const percentDafulPendapatan = dafulTotal > 0 ? Math.min(100, Math.round((totalDafulPendapatan / dafulTotal) * 100)) : 0;
  const percentDafulTunggakan  = dafulTotal > 0 ? Math.min(100, Math.round((totalDafulTunggakan  / dafulTotal) * 100)) : 0;

  const moneySub = (() => {
    if (loading || loadingDaful) return ' ';
    if (moneyCardMode === 'daful_pendapatan') return `Share: ${percentDafulPendapatan}% dari total Daful`;
    if (moneyCardMode === 'daful_tunggakan')  return `Share: ${percentDafulTunggakan}% dari total Daful`;
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
        progressPct: `${loading || loadingDaful ? 0 : percentDafulPendapatan}%`,
      };
    }
    if (moneyCardMode === 'daful_tunggakan') {
      return {
        border: 'border-yellow-500 hover:border-yellow-600',
        iconWrap: 'bg-yellow-100 group-hover:bg-yellow-500',
        icon: 'text-yellow-600 group-hover:text-white',
        gradient: 'from-yellow-50',
        bar: 'bg-yellow-500 group-hover:bg-yellow-600',
        progressPct: `${loading || loadingDaful ? 0 : percentDafulTunggakan}%`,
      };
    }
    return {
      border: 'border-purple-500 hover:border-purple-600',
      iconWrap: 'bg-purple-100 group-hover:bg-purple-500',
      icon: 'text-purple-600 group-hover:text-white',
      gradient: 'from-purple-50',
      bar: 'bg-purple-500 group-hover:bg-purple-600',
      progressPct: `${loading ? 0 : percentRevenue}%`,
    };
  })();

  return (
    <div className="min-h-dvh bg-slate-10 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Dashboard SPMB • Admin</h1>
        <div className="ml-auto" />
        <button
          type="button"
          onClick={() => { setLoading(true); setLoadingDaful(true); Promise.all([/* umum */ (async()=>{})(), reloadDaful()]).finally(()=>setLoading(false)); }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 text-black"
        >
          <RefreshCw className="h-4 w-4" /> Muat ulang
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
                style={{ width: loading || loadingDaful ? '0%' : modeStyles.progressPct }}
              />
            </div>

            {/* Hint kecil mode */}
            <div className="mt-2 text-[11px] text-slate-400">
              Klik untuk ganti: {moneyCardMode === 'pembayaran' ? 'Pendapatan Daful' : moneyCardMode === 'daful_pendapatan' ? 'Tunggakan Daful' : 'Total Pembayaran'}
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
