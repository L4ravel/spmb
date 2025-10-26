/* ========================= PPDB COUNTDOWN GATE (TOGGLE) ========================= */
const COUNTDOWN_ENABLED = true; // <<=== TOGGLE UTAMA
// 1 Nov 2025 08:00 WITA (UTC+08) == 1 Nov 2025 00:00:00 UTC (Z)
const COUNTDOWN_TARGET_ISO = "2025-11-01T00:00:00Z";
const COUNTDOWN_TIMER_PATH = "/timer";

// ...

export function middleware(req) {
  const url = req.nextUrl;
  const { pathname } = url;

  /* =========================== PPDB COUNTDOWN GATE =========================== */
  if (COUNTDOWN_ENABLED) {
    // robust: handle NaN jika parsing gagal
    const openAt = Date.parse(COUNTDOWN_TARGET_ISO);
    const now = Date.now();

    // jika ISO invalid, lewati gate agar tidak “ngunci” situs
    if (Number.isNaN(openAt)) {
      console.warn("[COUNTDOWN] ISO invalid:", COUNTDOWN_TARGET_ISO);
    } else {
      const isBypassedPrefix = COUNTDOWN_BYPASS_PREFIX.some((p) =>
        pathname.startsWith(p)
      );
      const isBypassedAsset = isStaticAsset(pathname);

      // SEBELUM buka: paksa ke /timer
      if (now < openAt && !isBypassedPrefix && !isBypassedAsset && !pathname.startsWith(COUNTDOWN_TIMER_PATH)) {
        const to = url.clone();
        to.pathname = COUNTDOWN_TIMER_PATH;
        to.search = "";
        return NextResponse.redirect(to);
      }

      // SESUDAH buka: keluarkan dari /timer
      if (now >= openAt && pathname === COUNTDOWN_TIMER_PATH) {
        const to = url.clone();
        to.pathname = "/";
        to.search = "";
        return NextResponse.redirect(to);
      }
    }
  }
  /* ======================== END: PPDB COUNTDOWN GATE ========================= */

  // ... (auth middleware kamu tanpa perubahan)
}
