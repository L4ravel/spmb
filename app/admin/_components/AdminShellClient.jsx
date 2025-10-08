'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, Home, Users, CreditCard, UserCheck, Trophy, Calendar,
  FileText, BarChart3, MessageSquare, Bell, Search, Settings,
  LogOut, ChevronDown, ChevronRight, CheckCircle2, BookOpenCheck, Megaphone, 
} from 'lucide-react';
import { useMemo, useState } from 'react';

export default function AdminShellClient({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState({
    'data-master': true,
    'pembayaran': true, // perbaiki key agar konsisten dengan group id
  });

  const menuGroups = [
    {
      id: 'main',
      label: 'Main Menu',
      items: [
        { label: 'Dashboard', href: '/admin', icon: Home },
      ]
    },
    {
      id: 'data-master',
      label: 'Data Master',
      items: [
        { label: 'Data Peserta', href: '/admin/data-master', icon: Users },
        { label: 'Hasil Penilain Al-Quran', href: '/admin/hasil-tahfidz', icon: BarChart3 },
        { label: 'Hasil Final', href: '/admin/hasil-final', icon: Trophy },
        { label: 'Umumkan', href: '/admin/hasil-final/umumkan', icon: Megaphone },
      ]
    },
    {
      id: 'pembayaran',
      label: 'Pembayaran',
      items: [
        { label: 'Verifikasi Pembayaran', href: '/admin/pembayaran', icon: CreditCard },
        { label: 'Rekap Pembayaran', href: '/admin/data-peserta', icon: BarChart3 },
      ]
    },
    {
      id: 'builder',
      label: 'Pembuatan Soal',
      items: [
        { label: 'Pembuatan Soal Akademik', href: '/admin/soal-akademik', icon: FileText },
        { label: 'Pembuatan Soal Wawancara', href: '/admin/soal-wawancara', icon: FileText },
      ]
    },
    {
      id: 'ujian',
      label: 'Ujian Akademik',
      items: [
        { label: 'Pembuatan Jadwal', href: '/admin/jadwal-ujian', icon: Calendar },
        { label: 'Verifikasi Peserta', href: '/admin/verifikasi-ujian', icon: CheckCircle2 },
      ]
    },
    {
      id: 'penilaian',
      label: 'Form Penilaian',
      items: [
        { label: 'Bacaan Al-Quran', href: '/admin/nilai-tahfidz', icon: BookOpenCheck },
        { label: 'Tes Wawancara', href: '/admin/tes-wawancara', icon: MessageSquare },
      ]
    },
    {
      id: 'lainnya',
      label: 'Lainnya',
      items: [
        { label: 'Input Pembayaran', href: '/admin/input-pembayaran', icon: CreditCard },
        { label: 'Kuota', href: '/admin/kuota', icon: UserCheck },
        { label: 'WhatsApp', href: '/admin/whatshap', icon: MessageSquare },
        { label: 'Kelengkapan Berkas', href: '/admin/kelengkapan-berkas', icon: FileText },
      ]
    },
  ];

  const toggleGroup = (groupId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // ====== Single-active item (hindari double highlight) ======
  // Cari href terpanjang yang menjadi prefix dari pathname
  const activeHref = useMemo(() => {
    const flat = menuGroups.flatMap(g => g.items);
    let best = '';
    for (const it of flat) {
      const h = it.href;
      if (pathname === h || pathname?.startsWith(h + '/')) {
        if (h.length > best.length) best = h;
      }
    }
    // fallback: exact match sederhana
    if (!best) {
      const exact = flat.find(it => it.href === pathname);
      if (exact) best = exact.href;
    }
    return best;
  }, [pathname]);

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Sidebar */}
      <aside className={`${open ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl flex flex-col`}>
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-700/50 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm">
              P
            </div>
            <div>
              <div className="font-bold text-base">PPDB Admin</div>
              <div className="text-xs text-slate-400">Management System</div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            aria-label="Tutup sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {menuGroups.map((group) => {
            const isExpanded = expandedMenus[group.id];
            const hasSubmenu = group.items.length > 1;

            return (
              <div key={group.id} className="mb-4">
                {hasSubmenu ? (
                  <>
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
                    >
                      <span>{group.label}</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const active = item.href === activeHref; // hanya satu yang aktif
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                active
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                              }`}
                            >
                              <Icon size={18} />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.href === activeHref;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                            active
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                          }`}
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="h-16 border-t border-slate-700/50 px-4 flex items-center gap-3 bg-slate-900/50 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Administrator</div>
            <div className="text-xs text-slate-400">Super Admin</div>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-red-400" aria-label="Keluar">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm flex items-center gap-6 px-8 flex-shrink-0">
          <button
            onClick={() => setOpen(!open)}
            className="p-2.5 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all group"
            aria-label="Toggle sidebar"
          >
            <Menu size={22} className="text-slate-700 group-hover:text-blue-600 transition-colors" />
          </button>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl text-black">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Cari data peserta, NISN, pembayaran..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button className="relative p-2.5 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all group" aria-label="Notifikasi">
              <Bell size={20} className="text-slate-700 group-hover:text-blue-600 transition-colors" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <button className="p-2.5 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all group" aria-label="Pengaturan">
              <Settings size={20} className="text-slate-700 group-hover:text-blue-600 transition-colors" />
            </button>
            <div className="w-px h-8 bg-slate-200 mx-1" />
            <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all group" aria-label="Profil">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/30">
                A
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-sm font-semibold text-slate-800">Administrator</div>
                <div className="text-xs text-slate-500">Super Admin</div>
              </div>
              <ChevronDown size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>
        </header>

        {/* Content Area - Scrollable */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="px-8 py-8 min-h-[calc(100vh-5rem)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
