// components/ppdb/Jenjang.js
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Award,
  School,
  Building2,
  X,
  ChevronRight,
  Sparkles
} from "lucide-react";

/* Konfigurasi level (top-level) dengan icon */
const LEVELS = [
  { 
    key: "TK", 
    label: "TK", 
    type: "single",
    icon: Users,
    desc: "Taman Kanak-Kanak",
    color: "from-pink-500 to-rose-500"
  },
  { 
    key: "SD", 
    label: "SD", 
    type: "split",
    icon: BookOpen,
    desc: "Sekolah Dasar",
    color: "from-blue-500 to-cyan-500"
  },
  { 
    key: "SMP", 
    label: "SMP", 
    type: "split",
    icon: School,
    desc: "Sekolah Menengah Pertama",
    color: "from-green-500 to-emerald-500"
  },
  { 
    key: "SMA", 
    label: "SMA", 
    type: "split",
    icon: GraduationCap,
    desc: "Sekolah Menengah Atas",
    color: "from-orange-500 to-amber-500"
  },
  { 
    key: "LKSA", 
    label: "LKSA", 
    type: "lksa",
    icon: Award,
    desc: "Lembaga Kesejahteraan Sosial Anak",
    color: "from-purple-500 to-violet-500"
  },
  { 
    key: "MAHAD", 
    label: "MA'HAD ALY / STIT", 
    type: "mahad",
    icon: Building2,
    desc: "Pendidikan Tinggi Islam",
    color: "from-indigo-500 to-blue-600"
  },
];

// Mapping pilihan ke folder
const FOLDER_MAPPING = {
  "TK": "TKDetail",
  "SD Putra": "SDPutraDetail",
  "SD Putri": "SDPutriDetail",
  "SMP Putra": "SMPPutraDetail",
  "SMP Putri": "SMPPutriDetail",
  "SMA Putra": "SMAPutraDetail",
  "SMA Putri": "SMAPutriDetail",
  "PPS ULA": "PPSULA",
  "PPS WUSTHO": "PPSWUSTHO",
  "PPS ULYA": "PPSULYA",
  "PGMI PUTRA (S1) --- Non Asrama": "PGMIPutraDetail",
  "MPI PUTRA (S1) --- Non Asrama": "MPIPutraDetail",
  "PIAUD PUTRA (S1) --- Non Asrama": "PIAUDPutraDetail",
  "PGMI PUTRI (S1)": "PGMIPutriDetail",
  "MPI PUTRI (S1)": "MPIPutriDetail",
  "PIAUD PUTRI (S1)": "PIAUDPutriDetail",
};

export default function Jenjang({ onPick }) {
  const router = useRouter();
  const [modal, setModal] = useState({
    open: false,
    type: null,
    title: "",
    options: [],
    color: "",
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ESC untuk tutup modal
  useEffect(() => {
    if (!modal.open) return;
    const onEsc = (e) => e.key === "Escape" && setModal((m) => ({ ...m, open: false }));
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [modal.open]);

  function openFor(item) {
    if (item.type === "single") {
      setModal({ 
        open: true, 
        type: "single", 
        title: "TK", 
        options: [],
        color: item.color 
      });
    } else if (item.type === "split") {
      setModal({
        open: true,
        type: "split",
        title: item.label,
        options: [`${item.label} Putra`, `${item.label} Putri`],
        color: item.color,
      });
    } else if (item.type === "lksa") {
      setModal({
        open: true,
        type: "list",
        title: "LKSA",
        options: ["PPS ULA", "PPS WUSTHO", "PPS ULYA"],
        color: item.color,
      });
    } else if (item.type === "mahad") {
      setModal({
        open: true,
        type: "list",
        title: "MA&apos;HAD ALY / STIT",
        options: [
          "PGMI PUTRA (S1) --- Non Asrama",
          "MPI PUTRA (S1) --- Non Asrama",
          "PIAUD PUTRA (S1) --- Non Asrama",
          "PGMI PUTRI (S1)",
          "MPI PUTRI (S1)",
          "PIAUD PUTRI (S1)",
        ],
        color: item.color,
      });
    }
  }

  function closeModal() {
    setModal({ open: false, type: null, title: "", options: [], color: "" });
  }

  function choose(val) {
    // Panggil callback jika ada
    onPick?.(val);
    
    // Dapatkan nama folder dari mapping
    const folderName = FOLDER_MAPPING[val];
    
    if (folderName) {
      // Navigate ke folder yang sesuai - modal akan tertutup otomatis saat pindah halaman
      router.push(`/landing-page/jenjang/${folderName}`);
    } else {
      console.warn(`Folder mapping not found for: ${val}`);
      closeModal();
    }
  }

  return (
    <section className="relative mx-auto max-w-7xl">
      <div className="relative px-4 py-8 md:py-12">
        {/* Header Section */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-bold uppercase tracking-wider text-violet-700">
              Pilihan Program
            </span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 md:text-5xl">
            Jenjang Pendidikan
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Pilih jenjang pendidikan yang sesuai untuk melanjutkan pendaftaran
          </p>
        </div>

        {/* Grid pilihan jenjang dengan design card premium */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                onClick={() => openFor(it)}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 text-left shadow-lg ring-1 ring-slate-200/50 transition-all duration-300
                           hover:-translate-y-2 hover:shadow-2xl hover:ring-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
              >
                {/* Decorative gradient background */}
                <div className={`absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-gradient-to-br ${it.color} opacity-10 blur-2xl transition-all duration-300 group-hover:scale-150 group-hover:opacity-20`} />
                
                {/* Icon badge */}
                <div className="relative mb-4">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${it.color} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                </div>

                {/* Content */}
                <div className="relative">
                  <h3 className="mb-2 text-2xl font-black text-slate-900">
                    {it.label}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {it.desc}
                  </p>
                </div>

                {/* Arrow indicator */}
                <div className="relative mt-4 flex items-center justify-end">
                  <ChevronRight className="h-5 w-5 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-violet-600" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal via PORTAL dengan design premium */}
      {mounted && modal.open &&
        createPortal(
          <div
            className="fixed inset-0 bottom-0 left-0 right-0 top-0 z-[9999] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={closeModal}
          >
            <div
              className="relative w-full max-w-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal card */}
              <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-violet-200/50">
                {/* Decorative header gradient */}
                <div className={`h-2 bg-gradient-to-r ${modal.color || 'from-violet-500 to-indigo-600'}`} />
                
                <div className="p-8">
                  {/* Close button */}
                  <button
                    onClick={closeModal}
                    aria-label="Tutup"
                    className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  {/* TK (single) */}
                  {modal.type === "single" && (
                    <div className="py-8 text-center">
                      <div className={`mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${modal.color} shadow-xl`}>
                        <Users className="h-10 w-10 text-white" />
                      </div>
                      <h3 className="text-4xl font-black text-slate-900">
                        Taman Kanak-Kanak
                      </h3>
                      <p className="mt-3 text-slate-600">
                        Program pendidikan usia dini untuk mempersiapkan anak memasuki jenjang SD
                      </p>
                      <button
                        onClick={() => choose(modal.title)}
                        className={`mt-8 rounded-xl bg-gradient-to-r ${modal.color} px-8 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105`}
                      >
                        Pilih Program Ini
                      </button>
                    </div>
                  )}

                  {/* SD/SMP/SMA (split Putra/Putri) */}
                  {modal.type === "split" && (
                    <div>
                      <h3 className="mb-6 text-center text-3xl font-black text-slate-900">
                        Pilih Program
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {modal.options.map((op, idx) => (
                          <button
                            key={op}
                            onClick={() => choose(op)}
                            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-violet-50/30 p-6 shadow-lg ring-1 ring-violet-100 transition-all duration-300
                                       hover:-translate-y-1 hover:shadow-xl hover:ring-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                          >
                            <div className={`absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br ${modal.color} opacity-10 blur-2xl transition-all duration-300 group-hover:scale-150`} />
                            <div className="relative">
                              <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${modal.color} shadow-md`}>
                                <span className="text-xl font-black text-white">
                                  {idx === 0 ? '♂' : '♀'}
                                </span>
                              </div>
                              <p className="text-xl font-bold text-slate-900">
                                {op}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LKSA / MA&apos;HAD (list) */}
                  {modal.type === "list" && (
                    <div>
                      <h3 className="mb-2 text-center text-3xl font-black text-slate-900">
                        {modal.title}
                      </h3>
                      <p className="mb-6 text-center text-slate-600">
                        Pilih program yang sesuai dengan minat Anda
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {modal.options.map((op) => (
                          <button
                            key={op}
                            onClick={() => choose(op)}
                            className="group flex items-center justify-between rounded-xl bg-gradient-to-r from-white to-violet-50/30 px-5 py-4 text-left shadow-md ring-1 ring-violet-100 transition-all duration-200
                                       hover:-translate-x-1 hover:shadow-lg hover:ring-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                          >
                            <span className="font-bold text-slate-900">
                              {op}
                            </span>
                            <ChevronRight className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-violet-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </section>
  );
}