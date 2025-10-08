// app/tes/akademik/[sessionId]/components/HeroSection.js
import Link from "next/link";

/* HERO ala portal + box kanan ukuran tetap (tidak terpengaruh teks) */
export default function HeroSection({ statusPendaftaran = "TES AKADEMIK" }) {
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
          {/* kiri: judul + CTA */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-3 py-1 text-xs font-semibold ring-1 ring-white/30">
              PPDB <span className="inline-block h-1 w-1 rounded-full bg-white/60" /> Tes Akademik
            </div>
            <h1 className="mt-3 text-3xl md:text-5xl font-extrabold leading-tight drop-shadow-sm">
              Kerjakan Soal Akademik dengan Nyaman
            </h1>
            <p className="mt-3 text-white/90 max-w-xl">
              Untuk memulai ujian, peserta harus memasukkan token yang diberikan panitia terlebih dahulu.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link href="#mulai" className="rounded-full bg-white text-violet-700 px-5 py-2 font-semibold shadow hover:bg-violet-50">
                Minta Token
              </Link>
              <Link href="/ppdb/panduan" className="rounded-full border border-white/60 text-white px-5 py-2 backdrop-blur hover:bg-white/10">
                Panduan
              </Link>
            </div>
          </div>   
          
          {/* end kanan */}
        </div>
      </div>
    </section>
  );
}
