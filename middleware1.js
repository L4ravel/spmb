// middleware.js
import { NextResponse } from "next/server";

const SESSION_COOKIE = "ppdb_session";

// Regex route yang wajib login
const PROTECTED = [
  /^\/portal(?:\/|$)/,
  /^\/tes-ujian(?:\/|$)/,      // ganti dari /tes-akademik → /tes-ujian
  /^\/confirm-ujian(?:\/|$)/,
  /^\/hasil-ujian(?:\/|$)/,    // halaman hasil ujian
  /^\/admin(?:\/|$)/,          // <-- proteksi admin
];

// Helper: cek apakah path termasuk protected
function isProtected(pathname) {
  return PROTECTED.some((rx) => rx.test(pathname));
}

// Decode cookie base64 → object { id, role, ts }
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

  const rawSession = req.cookies.get(SESSION_COOKIE)?.value;
  const session = rawSession ? readSession(rawSession) : null;
  const role = session?.role || "siswa";

  // 1) Route protected tapi belum login → ke /login?next=...
  if (isProtected(pathname) && !session) {
    const to = url.clone();
    to.pathname = "/login";
    to.searchParams.set("next", pathname + (url.search || ""));
    return NextResponse.redirect(to);
  }

  // 2) Akses /admin tapi role bukan admin → tolak
const isAdmin = ["admin","administrator"].includes(String(role).toLowerCase());
if (/^\/admin(?:\/|$)/.test(pathname) && session && !isAdmin) {
  const to = url.clone();
  to.pathname = "/portal";
  to.search = "";
  return NextResponse.redirect(to);
}

  // 3) Sudah login tapi mengunjungi /login → kirim ke next (jika ada) atau default role
  if (pathname === "/login" && session) {
    const next = url.searchParams.get("next");
    const to = url.clone();

    if (next && next.startsWith("/")) {
      to.pathname = next;
    } else {
      to.pathname = role === "admin" ? "/admin" : "/portal";
    }
    to.search = "";
    return NextResponse.redirect(to);
  }

  // 4) Lolos (public, atau protected + punya sesi yang valid)
  return NextResponse.next();
}

// Matcher: hanya jalankan middleware pada rute yang relevan
export const config = {
  matcher: [
    "/portal/:path*",
    "/tes-ujian/:path*",
    "/confirm-ujian/:path*",
    "/hasil-ujian/:path*",
    "/admin/:path*",   // <-- tambahkan admin
    "/login",
  ],
};
