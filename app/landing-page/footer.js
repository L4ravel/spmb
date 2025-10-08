// ./landing-page/footer.js
"use client";

import { 
  Facebook, 
  Instagram, 
  Youtube, 
  MapPin, 
  Phone, 
  Mail,
  Sparkles
} from "lucide-react";

const socials = [
  { name: "Facebook", href: "https://web.facebook.com/ponpesassunnahlombok?_rdc=1&_rdr#", Icon: Facebook, color: "hover:bg-blue-600" },
  { name: "Instagram", href: "https://www.instagram.com/pontren_assunnah/", Icon: Instagram, color: "hover:bg-pink-600" },
  { name: "Youtube", href: "https://www.youtube.com/@AdmissionPonpesAssunnah", Icon: Youtube, color: "hover:bg-red-600" },
];

const navLinks = [
  {
    label: "Beranda",
    href: "/",
    action: () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.location.href = "/";
        }
      }
      // opsional: tutup menu mobile kalau ada
      setIsMobileMenuOpen?.(false);
    },
  },
  { label: "Jenjang", href: "/#jenjang", action: () => scrollToSection?.("jenjang") },
  { label: "Cara Daftar", href: "/#cara-daftar", action: () => scrollToSection?.("cara-daftar") },

  // ✅ Revisi Galery
  {
    label: "Galery",
    href: "/landing-page/galery",
    action: () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/landing-page/galery") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.location.href = "/landing-page/galery";
        }
      }
      setIsMobileMenuOpen?.(false);
    },
  },
];


const contactInfo = [
  { 
    Icon: MapPin, 
    text: "Jln. TGH. Jamaluddin Bagik Nyaka Santri, Aikmel, Lombok Timur, NTB",
    href: "https://maps.google.com/?q=Pondok+Pesantren+Assunnah+lombok"
  },
  { 
    Icon: Phone, 
    text: "(+62) 878 5777 1623",
    href: "https://wa.me/6287857771623"
  },
  // { 
  //   Icon: Mail, 
  //   text: "-",
  //   href: "#"
  // },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative w-full overflow-hidden">
      {/* ===== Divider Line ===== */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-300 to-transparent" />

      {/* ===== Animated Background ===== */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-violet-50/50 to-indigo-50/30" />
        
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-multiply"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(139,92,246,.3) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        
        {/* Animated gradient blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl animate-blob-slow" />
        <div className="pointer-events-none absolute -right-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-indigo-300/20 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-300/15 blur-3xl animate-blob-fast" />
      </div>

      {/* ===== Main Footer Content ===== */}
      <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          
          {/* Brand Section */}
          <div className="lg:col-span-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1">
              <Sparkles className="h-3 w-3 text-violet-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                Pondok Pesantren
              </span>
            </div>
            
            <h2 className="mb-4 text-3xl font-black text-slate-900 md:text-4xl">
              Assunnah
            </h2>
            
            <p className="mb-6 text-base leading-relaxed text-slate-700 md:text-lg">
              Bersama Membina Generasi Qur&apos;ani yang Berakhlak Mulia dan Berilmu
            </p>

            {/* Social Media */}
            <div className="mb-6">
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">
                Ikuti Kami
              </p>
              <div className="flex flex-wrap gap-3">
                {socials.map(({ name, href, Icon, color }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={name}
                    className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-3 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${color}`}
                  >
                    <Icon className="relative z-10 h-5 w-5 text-white transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-white opacity-0 transition-opacity group-hover:opacity-20" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3">
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              Navigasi Cepat
            </h3>
            <ul className="space-y-3">
              {navLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="group inline-flex items-center text-slate-700 transition-colors hover:text-violet-600"
                  >
                    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-violet-400 transition-all group-hover:w-6" />
                    <span className="font-medium">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-4">
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              Hubungi Kami
            </h3>
            <div className="space-y-4">
              {contactInfo.map(({ Icon, text, href }, idx) => (
                <a
                  key={idx}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 transition-transform hover:translate-x-1"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 transition-colors group-hover:bg-violet-200">
                    <Icon className="h-5 w-5 text-violet-600" />
                  </div>
                  <span className="text-sm leading-relaxed text-slate-700 transition-colors group-hover:text-violet-600">
                    {text}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

        {/* Bottom Section */}
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex flex-col items-center gap-2 text-center md:flex-row md:text-left">
            <p className="text-sm text-slate-600">
              © {year} Pondok Pesantren Assunnah. All rights reserved.
            </p>
          </div>
        </div>

      </div>

      {/* ===== Animations ===== */}
      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes blob-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, 30px) scale(1.15); }
        }
        @keyframes blob-fast {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, -20px) scale(1.05); }
          66% { transform: translate(30px, 40px) scale(0.95); }
        }
        .animate-blob { animation: blob 20s ease-in-out infinite; }
        .animate-blob-slow { animation: blob-slow 25s ease-in-out infinite; }
        .animate-blob-fast { animation: blob-fast 15s ease-in-out infinite; }
      `}</style>
    </footer>
  );
}