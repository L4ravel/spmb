import { NextResponse } from "next/server";

// helper bikin Set-Cookie
function cookieHeader(name, value, { maxAge = 60 * 60 * 24 * 7, httpOnly = true, sameSite = "lax", path = "/", secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; SameSite=${sameSite}; ${httpOnly ? "HttpOnly; " : ""}${secure ? "Secure; " : ""}`;
}

// POST { nisn: "00123459" }
export async function POST(req) {
  try {
    const { nisn } = await req.json();
    if (!nisn) return NextResponse.json({ error: "nisn required" }, { status: 400 });

    // Simpan data minimal (base64 JSON). Kamu bisa tambah role/ts dsb.
    const payload = Buffer.from(JSON.stringify({ id: String(nisn) }), "utf8").toString("base64");

    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", cookieHeader("ppdb_session", payload));
    return res;
  } catch (e) {
    return NextResponse.json({ error: e?.message || "ERR" }, { status: 500 });
  }
}

// Hapus sesi (opsional)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", "ppdb_session=; Max-Age=0; Path=/; SameSite=Lax; HttpOnly; Secure");
  return res;
}
