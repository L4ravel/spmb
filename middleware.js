// middleware.js
import { NextResponse } from "next/server";

const SESSION_COOKIE = "ppdb_session";
const UNLOCK_COOKIE = "spmb_unlock";

// === Target buka: 1 Nov 2025 06:00 WITA (+08:00) ===
// Dalam UTC = 2025-10-31T22:00:00Z
const TARGET_OPEN_UTC = "2025-10-31T22:00:00Z";

// ---------- Helper ----------
function readSession(cookieVal) {
  try {
    const json = atob(decodeURIComponent(cookieVal || ""));
    return JSON.parse(json || "{}");
  } catch {
    return null;
  }
}
function nowUTC() {
  try { return new Date(); } catch { return new Date(); }
}
function isAfterOpenWindow() {
  const now = nowUTC().getTime();
  const target = Date.parse(TARGET_OPEN_UTC);
  return Number.isFinite(target) ? now >= target : true;
}
function hasUnlock(req) {
  const c = req.cookies.get(UNLOCK_COOKIE)?.value || "";
  return String(c).toLowerCase() === "buka";
}
function urlHasUnlockParam(url) {
  const p = url.searchParams;
  const key = (p.get("key") || p.get("buka") || "").toLowerCase();
  return key === "buka" || key === "1" || key === "true";
}

// ---------- Rules yang sudah ada (dipertahankan) ----------
const LOGIN_ONLY = [
  /^\/ganti-password(?:\/|$)/,
  /^\/daftar-ulang(?:\/|$)/,
  /^\/portal\/ganti-password(?:\/|$)/,
  /^\/portal\/daftar-ulang(?:\/|$)/,
];

// ⬇️ TIMER dihapus dari PROTECTED agar publik (tidak perlu login)
const PROTECTED = [
  /^\/portal(?:\/|$)/,
  /^\/tes-ujian(?:\/|$)/,
  /^\/confirm-ujian(?:\/|$)/,
  /^\/hasil-ujian(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

function isLoginOnly(pathname) { return LOGIN_ONLY.some((rx) => rx.test(pathname)); }
function isProtected(pathname) { return PROTECTED.some((rx) => rx.test(pathname)); }

export function middleware(req) {
  const url = req.nextUrl;
  const { pathname } = url;

  const rawSession = req.cookies.get(SESSION_COOKIE)?.value;
  const session = rawSession ? readSession(rawSession) : null;
  const role = String(session?.role || "siswa").toLowerCase();
  const isAdmin = ["admin", "administrator"].includes(role);
  const status = String(session?.registrationPaymentStatus || "").toLowerCase();
  const verifiedPayment =
    session?.verifiedPayment === true ||
    status === "verified" ||
    session?.accountEnabled === true;

  // ====== Fitur "ketik: buka" di /timer → set cookie unlock ======
  if (/^\/timer(?:\/|$)/.test(pathname) && urlHasUnlockParam(url)) {
    const res = NextResponse.next();
    res.cookies.set(UNLOCK_COOKIE, "buka", { path: "/", httpOnly: false, sameSite: "Lax", maxAge: 60 * 60 * 4 }); // 4 jam
    const next = url.searchParams.get("next");
    if (next && next.startsWith("/")) {
      const to = url.clone();
      to.pathname = next;
      to.search = "";
      return NextResponse.redirect(to, { headers: res.headers });
    }
    return res;
  }

  // ====== Gate khusus /spmb → redirect ke /timer sebelum jam buka ======
  if (/^\/spmb(?:\/|$)/.test(pathname)) {
    const unlocked = isAfterOpenWindow() || hasUnlock(req) || urlHasUnlockParam(url);
    if (!unlocked) {
      const to = url.clone();
      to.pathname = "/timer";
      to.search = "";
      to.searchParams.set("next", pathname);
      return NextResponse.redirect(to);
    }
    if (urlHasUnlockParam(url)) {
      const res = NextResponse.next();
      res.cookies.set(UNLOCK_COOKIE, "buka", { path: "/", httpOnly: false, sameSite: "Lax", maxAge: 60 * 60 * 4 });
      return res;
    }
  }

  // ====== LOGIN-ONLY (tetap) ======
  if (isLoginOnly(pathname)) {
    if (!session) {
      const to = url.clone();
      to.pathname = "/login";
      to.searchParams.set("next", pathname + (url.search || ""));
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  // ====== PROTECTED (tetap) ======
  if (isProtected(pathname) && !session) {
    const to = url.clone();
    to.pathname = "/login";
    to.searchParams.set("next", pathname + (url.search || ""));
    return NextResponse.redirect(to);
  }

  // ====== ADMIN gate (tetap) ======
  if (/^\/admin(?:\/|$)/.test(pathname) && session && !isAdmin) {
    const to = url.clone();
    to.pathname = "/portal";
    to.search = "";
    return NextResponse.redirect(to);
  }

  // ====== Portal verified gate (tetap) ======
  if (/^\/portal(?:\/|$)/.test(pathname) && session && !isAdmin && !verifiedPayment) {
    const to = url.clone();
    to.pathname = "/pembayaran-pending";
    to.search = "";
    return NextResponse.redirect(to);
  }

  // ====== Sudah login tapi ke /login → arahkan ======
  if (pathname === "/login" && session) {
    const next = url.searchParams.get("next");
    const to = url.clone();
    to.pathname = next && next.startsWith("/") ? next : (isAdmin ? "/admin" : "/portal");
    to.search = "";
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

// Matcher (tetap): timer tetap dimonitor untuk menangkap key=buka, tapi tidak diproteksi login
export const config = {
  matcher: [
    "/ganti-password",
    "/ganti-password/:path*",
    "/daftar-ulang",
    "/daftar-ulang/:path*",
    "/portal/ganti-password",
    "/portal/ganti-password/:path*",
    "/portal/daftar-ulang",
    "/portal/daftar-ulang/:path*",

    "/portal/:path*",
    "/tes-ujian/:path*",
    "/confirm-ujian/:path*",
    "/hasil-ujian/:path*",
    "/admin/:path*",

    "/timer",
    "/timer/:path*",

    "/spmb",
    "/spmb/:path*",

    "/login",
  ],
};
