// middleware.js
import { NextResponse } from "next/server";

/* ========================= PPDB COUNTDOWN GATE (TOGGLE) ========================= */
const COUNTDOWN_ENABLED = true; // <<=== TOGGLE UTAMA
// 1 Nov 2025 08:00 WITA (UTC+08) == 1 Nov 2025 00:00:00 UTC (Z)
const COUNTDOWN_TARGET_ISO = "2025-11-01T00:00:00Z";
const COUNTDOWN_TIMER_PATH = "/timer";

// Prefix yang tidak di-redirect saat gate aktif (biar aset & API tetap jalan)
const COUNTDOWN_BYPASS_PREFIX = [
  "/_next",
  "/api",
  "/favicon",
  "/robots",
  "/sitemap",
  "/manifest",
  "/public", // antisipasi
  "/logo",   // <<— folder logo di /public/logo → /logo/...
];

// helper: deteksi file aset statis (khusus gambar & icon)
function isStaticAsset(pathname) {
  return /\.(png|jpe?g|webp|svg|gif|ico)$/i.test(pathname);
}

/* =============================== AUTH MIDDLEWARE =============================== */
const SESSION_COOKIE = "ppdb_session";

// Regex route yang wajib login
const PROTECTED = [
  /^\/portal(?:\/|$)/,
  /^\/tes-ujian(?:\/|$)/,
  /^\/confirm-ujian(?:\/|$)/,
  /^\/hasil-ujian(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

function isProtected(pathname) {
  return PROTECTED.some((rx) => rx.test(pathname));
}

function readSession(cookieVal) {
  try {
    const json = atob(decodeURIComponent(cookieVal || ""));
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

export function middleware(req) {
  const url = req.nextUrl;
  const { pathname } = url;

  /* =========================== PPDB COUNTDOWN GATE =========================== */
  if (COUNTDOWN_ENABLED) {
    // robust: handle NaN jika parsing gagal
    const openAt = Date.parse(COUNTDOWN_TARGET_ISO);
    const now = Date.now();

    // jika ISO invalid, lewati gate agar tidak “ngunci” situs
    if (!Number.isNaN(openAt)) {
      // bypass aset & API saat gate aktif
      const isBypassedPrefix = COUNTDOWN_BYPASS_PREFIX.some((p) =>
        pathname.startsWith(p)
      );
      const isBypassedAsset = isStaticAsset(pathname);

      // SEBELUM buka: paksa semua route ke /timer (kecuali bypass & /timer sendiri)
      if (
        now < openAt &&
        !isBypassedPrefix &&
        !isBypassedAsset &&
        !pathname.startsWith(COUNTDOWN_TIMER_PATH)
      ) {
        const to = url.clone();
        to.pathname = COUNTDOWN_TIMER_PATH;
        to.search = ""; // bersihkan query
        return NextResponse.redirect(to);
      }

      // SESUDAH buka: jika user masih di /timer, kembalikan ke halaman utama
      if (now >= openAt && pathname === COUNTDOWN_TIMER_PATH) {
        const to = url.clone();
        to.pathname = "/";
        to.search = "";
        return NextResponse.redirect(to);
      }
    } else {
      console.warn("[COUNTDOWN] ISO invalid:", COUNTDOWN_TARGET_ISO);
    }
  }
  /* ======================== END: PPDB COUNTDOWN GATE ========================= */

  // ====== AUTH FLOW ======
  const rawSession = req.cookies.get(SESSION_COOKIE)?.value;
  const session = rawSession ? readSession(rawSession) : null;
  const role = session?.role || "siswa";

  if (isProtected(pathname) && !session) {
    const to = url.clone();
    to.pathname = "/login";
    to.searchParams.set("next", pathname + (url.search || ""));
    return NextResponse.redirect(to);
  }

  const isAdmin = ["admin", "administrator"].includes(String(role).toLowerCase());
  if (/^\/admin(?:\/|$)/.test(pathname) && session && !isAdmin) {
    const to = url.clone();
    to.pathname = "/portal";
    to.search = "";
    return NextResponse.redirect(to);
  }

  if (pathname === "/login" && session) {
    const next = url.searchParams.get("next");
    const to = url.clone();
    to.pathname = next && next.startsWith("/") ? next : (isAdmin ? "/admin" : "/portal");
    to.search = "";
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
