/* FOOTER */
export default function Footer({
  className = "",
  stickToBottom = false, // set true jika parent pakai flex-col
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`border-t border-violet-100/60 ${stickToBottom ? "mt-auto" : ""} ${className}`}
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 text-center text-xs text-slate-500">
        © {year} PPDB Portal • White—Purple Theme
      </div>
    </footer>
  );
}
