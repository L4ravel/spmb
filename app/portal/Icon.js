/* ===== Ikon inline ringkas (tanpa lib) ===== */
export default function Icon({ name, className = "h-5 w-5" }) {
  const d = {
    user: "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z",
    book: "M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 0-4-4V4z",
    quran: "M3 5h14a2 2 0 0 1 2 2v12H7a2 2 0 0 0-2 2H3V5zm9 4l-4 3 4 3",
    mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm-7 7a7 7 0 0 0 14 0M12 21v-4",
    score: "M3 12h18M7 12v7m5-7v7m5-7v7",
    announce: "M3 11h5l7-4v12l-7-4H3z",
    refresh: "M4 4v6h6M20 20v-6h-6M20 8a8 8 0 0 0-14-4M4 16a8 8 0 0 0 14 4",
    lock: "M6 10V8a6 6 0 1 1 12 0v2m-9 4h6a2 2 0 0 1 2 2v4H7v-4a2 2 0 0 1 2-2z",
    arrow: "M5 12h14M13 5l7 7-7 7",
    search: "M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[name]} />
    </svg>
  );
}