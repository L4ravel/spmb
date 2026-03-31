'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, ChevronRight, Settings, LogOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import AdminGuard from './AdminGuard';
import { useAuthEmail } from './useAuthEmail';
import { BASE_MENU_GROUPS, filterMenuByAllowed, getMobileItems } from './menuConfig';
import { getAllowedRoutes } from './getAllowedRoutes';

export default function AdminShellClient({ children }) {
  const pathname = usePathname();
  const email = useAuthEmail();

  const [open, setOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  const allowed = useMemo(() => getAllowedRoutes(email), [email]);
  const filteredMenuGroups = useMemo(
    () => filterMenuByAllowed(BASE_MENU_GROUPS, allowed),
    [allowed]
  );

  const toggleGroup = (groupId) =>
    setExpandedMenus((p) => ({ ...p, [groupId]: !p[groupId] }));

  const activeHref = useMemo(() => {
    const flat = filteredMenuGroups.flatMap((g) => g.items);
    let best = '';
    for (const it of flat) {
      const h = it.href;
      if (pathname === h || (pathname && pathname.startsWith(h + '/'))) {
        if (h.length > best.length) best = h;
      }
    }
    return best || '/admin';
  }, [pathname, filteredMenuGroups]);

  const mobileItems = useMemo(() => getMobileItems(filteredMenuGroups), [filteredMenuGroups]);

  // Logout
  const handleLogout = () => {
    try {
      localStorage.removeItem('appUser');
      sessionStorage.clear();
    } catch {}
    try {
      document.cookie = 'ppdb_session=; Max-Age=0; Path=/; SameSite=Lax';
      document.cookie = 'admin_session=; Max-Age=0; Path=/; SameSite=Lax';
    } catch {}
    window.location.href = '/login';
  };

  // Close settings on outside/ESC
  useEffect(() => {
    function onDocClick(e) {
      if (!settingsOpen) return;
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === 'Escape') setSettingsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [settingsOpen]);

  return (
    <AdminGuard>
      <div className="h-screen flex bg-white overflow-hidden">
        {/* Sidebar (desktop) */}
        <aside
          className={`hidden md:flex ${open ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl flex-col`}
        >
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-700/50 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm">S</div>
              <div>
                <div className="font-bold text-base">SPMB Admin</div>
                <div className="text-xs text-slate-400">Management System</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-700/50" aria-label="Tutup sidebar">
              <X size={18} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 overflow-y-auto">
            {filteredMenuGroups.map((group) => {
              const isExpanded = expandedMenus[group.id] ?? true;
              const hasSubmenu = group.items.length > 1;

              return (
                <div key={group.id} className="mb-4">
                  {hasSubmenu ? (
                    <>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white"
                      >
                        <span>{group.label}</span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isExpanded && (
                        <div className="mt-1 space-y-0.5">
                          {group.items.map((item) => {
                            const active = item.href === activeHref;
                            const Icon = item.icon;
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
                        const active = item.href === activeHref;
                        const Icon = item.icon;
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

          {/* Profile + Logout */}
          <div className="h-16 border-t border-slate-700/50 px-4 flex items-center gap-3 bg-slate-900/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
              {email ? (email[0] || 'A').toUpperCase() : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{email ?? 'Administrator'}</div>
              <div className="text-xs text-slate-400">Admin</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-red-400"
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
          {/* Header: tombol Pengaturan berada di tengah shape bulat ungu */}
          <header className="h-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm flex items-center gap-6 px-4 md:px-8">
            <button
              onClick={() => setOpen(!open)}
              className="hidden md:inline-flex p-2.5 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50"
              aria-label="Toggle sidebar"
            >
              <Menu size={22} className="text-slate-700" />
            </button>

            <div className="flex-1">
              <div className="text-sm text-slate-500">SPMB Admin</div>
              <div className="text-base font-semibold text-slate-800">
                {activeHref === '/admin'
                  ? 'Dashboard'
                  : activeHref.replace('/admin/', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>

            {/* Tombol Pengaturan: shape bulat ungu, icon di tengah */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="grid place-items-center rounded-full w-11 h-11 bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                aria-label="Pengaturan"
                title="Pengaturan"
              >
                <Settings size={20} />
              </button>

              {/* Dropdown pengaturan */}
              {settingsOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden z-50"
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Pengaturan</div>
                  </div>
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <LogOut size={16} />
                    <span>Keluar</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="px-4 md:px-8 py-8 min-h-[calc(100vh-5rem)] pb-24 md:pb-8">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile bottom bar (ikon scrollable) */}
        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Menu bawah"
        >
          <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent" />

          <div
            className="flex items-stretch overflow-x-auto gap-1 px-2 py-2 scroll-px-2 snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {mobileItems.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href || (pathname && pathname.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center px-3"
                  aria-label={item.shortLabel || item.label}
                >
                  <div
                    className={`flex items-center justify-center rounded-xl w-12 h-10 snap-start shrink-0 transition-all ${
                      active ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-transparent'
                    }`}
                  >
                    <Icon size={22} className={active ? 'text-blue-600' : 'text-slate-500'} />
                  </div>
                  <span className="sr-only">{item.shortLabel || item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </AdminGuard>
  );
}
