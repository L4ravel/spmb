"use client";

import { useRouter } from "next/navigation";

export default function HeroSection({ nisn = "", nama = "Peserta" }) {
  const router = useRouter();
  const canStart = /^\d{8,12}$/.test(String(nisn || "").trim());

  const handleStart = () => {
    if (!canStart) return;
    router.push(`/confirm-ujian`);
  };

  return (
    <section className="relative overflow-hidden h-[400px]">
      {/* blob ungu gradasi */}
      <div
        className={[
          "absolute inset-y-0 left-0 w-[88%] md:w-[62%]",
          "bg-gradient-to-br from-[#6a11cb] via-[#5b22c7] to-[#3b1e8f]",
          "[clip-path:ellipse(110%_78%_at_8%_46%)] md:[clip-path:ellipse(100%_80%_at_6%_48%)]",
        ].join(" ")}
      />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 h-full items-center">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-3 py-1 text-xs font-semibold ring-1 ring-white/30">
              PPDB <span className="inline-block h-1 w-1 rounded-full bg-white/60" /> Tes Akademik
            </div>
            <h1 className="mt-3 text-3xl md:text-5xl font-extrabold leading-tight drop-shadow-sm">
              Portal Ujian
            </h1>
            <p className="mt-3 text-white/90 max-w-xl">
              Dimohon kepada seluruh peserta untuk mengerjakan Tes Akademik dengan penuh kesungguhan, disiplin, dan kejujuran. Pastikan membaca setiap soal dengan cermat sebelum menjawab.
            </p>

            <div className="mt-6">
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="rounded-full bg-white text-violet-700 px-6 py-2.5 font-semibold shadow hover:bg-violet-50 disabled:opacity-60"
              >
                Mulai Tes
              </button>
              {!canStart && (
                <div className="mt-2 text-xs text-white/80">
                  NISN belum terbaca dari sesi. Silakan login ulang.
                </div>
              )}
            </div>
          </div>
          {/* kanan: optional ilustrasi */}
        </div>
      </div>
    </section>
  );
}
