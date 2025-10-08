"use client";

export default function HeroSection({ title = "Soal Akademik", onAdd }) {
  return (
    <section className="bg-white">
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Judul */}
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>

          {/* Tombol tambah soal */}
          <button
            type="button"
            onClick={() => onAdd?.()}
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5
                       text-sm md:text-base font-semibold text-white shadow-sm
                       hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300
                       active:scale-[0.98] transition"
            aria-label="Tambah Soal"
          >
            Tambah Soal +
          </button>
        </div>
      </div>
    </section>
  );
}
