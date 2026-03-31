"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  GraduationCap, 
  Menu, 
  X,
  Phone,
  MapPin,
  LogIn
} from "lucide-react";
import Image from "next/image";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Detect scroll for header effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  // Smooth scroll function
  const scrollToSection = (sectionId) => {
    // Check if we're on the home page
    if (window.location.pathname !== '/') {
      // If not on home page, navigate to home with hash
      window.location.href = `/#${sectionId}`;
      return;
    }
    
    const element = document.getElementById(sectionId);
    if (element) {
      const headerHeight = 100; // Adjusted height
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
    setIsMobileMenuOpen(false);
  };

  // Handle scroll on page load if there's a hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        const sectionId = hash.replace('#', '');
        scrollToSection(sectionId);
      }, 100);
    }
  }, []);

const navLinks = [
  { label: "BERANDA", href: "/", action: () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname === '/') {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.location.href = '/';
        }
      }
      setIsMobileMenuOpen(false);
    }
  },
  { label: "JENJANG", href: "/#jenjang", action: () => scrollToSection("jenjang") },
  { label: "CARA DAFTAR", href: "/#cara-daftar", action: () => scrollToSection("cara-daftar") },

  // === Revisi di bawah ini ===
  { label: "GALERY", href: "/galery", action: () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname === '/galery') {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.location.href = '/landing-page/galery';
        }
      }
      setIsMobileMenuOpen(false);
    }
  },
];


  return (
    <>
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          isScrolled
            ? "border-b border-slate-200/80 bg-white/95 shadow-lg backdrop-blur-xl"
            : "border-b border-transparent bg-white/90 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex h-20 items-center justify-between">
            {/* Logo & Brand */}
            <Link href="/" className="group flex items-center gap-3">
              <div className="relative">
                {/* Icon background with gradient */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-10 blur-md transition-opacity group-hover:opacity-20" />
                <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-white shadow-lg ring-1 ring-green-700/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <Image
                    src="/logo/pondok-assunnah.png"
                    alt="Logo Pondok Assunnah"
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                    priority={false}
                  />
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-lg font-bold uppercase tracking-wider text-green-700">
                  Pondok Pesantren
                </p>
                <p className="text-sm font-black text-slate-900">ASSUNNAH</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="rounded-lg px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* CTA Buttons - Desktop */}
            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-xl border-2 border-violet-200 bg-white px-5 py-2.5 font-semibold text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-50"
              >
                <LogIn className="h-4 w-4 transition-transform group-hover:scale-110" />
                Login
              </Link>
              <Link
                href="/spmb"
                className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                <span className="relative z-10">Daftar Sekarang</span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-indigo-700 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Top Info Bar (Optional - shows on desktop only) */}
        <div className="hidden border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 py-2 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-6 text-sm">
              <a
                href="tel:+6287720242025"
                className="flex items-center gap-2 text-slate-600 transition-colors hover:text-violet-600"
              >
                <Phone className="h-4 w-4" />
                <span className="font-medium">(+62) 877 2024 2025</span>
              </a>
              <a
                href="https://maps.google.com/?q=Pondok+Pesantren+Assunnah+lombok"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-slate-600 transition-colors hover:text-violet-600"
              >
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Bagik Nyaka, Lombok Timur</span>
              </a>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-600">
                Pendaftaran Dibuka
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Menu Header */}
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                      Pondok Pesantren
                    </p>
                    <p className="text-lg font-black text-slate-900">Assunnah</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="p-6">
              <div className="space-y-2">
                {navLinks.map((link) => (
                  <button
                    key={link.label}
                    onClick={link.action}
                    className="block w-full rounded-xl px-4 py-3 text-left font-semibold text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              {/* Mobile CTA Buttons */}
              <div className="mt-6 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-white px-5 py-3 font-semibold text-violet-700 transition-colors hover:bg-violet-50"
                >
                  <LogIn className="h-5 w-5" />
                  Login
                </Link>
                <Link
                  href="/spmb"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-bold text-white shadow-lg"
                >
                  Daftar Sekarang
                </Link>
              </div>

              {/* Mobile Contact Info */}
              <div className="mt-8 space-y-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
                <p className="text-sm font-bold uppercase tracking-wider text-violet-700">
                  Hubungi Kami
                </p>
                <a
                  href="tel:+6287720242025"
                  className="flex items-center gap-3 text-slate-700"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Phone className="h-5 w-5 text-violet-600" />
                  </div>
                  <span className="font-medium">(+62) 877 2024 2025</span>
                </a>
                <a
                  href="https://maps.google.com/?q=Pondok+Pesantren+Assunnah+lombok"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-slate-700"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <MapPin className="h-5 w-5 text-violet-600" />
                  </div>
                  <span className="font-medium">Bagik Nyaka, Lombok Timur</span>
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Spacer to prevent content jump */}
      <div className="h-20 lg:h-[88px]" />
    </>
  );
}