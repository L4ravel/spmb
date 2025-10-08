// app/api/tmp-account/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebaseAdmin"; // pastikan sudah ada file ini (sesuai yang kita buat sebelumnya)

function validNISN(v) {
  return /^\d{8,12}$/.test(String(v || "").trim());
}

async function sha256Hex(str) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(str, "utf8").digest("hex");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim().toLowerCase(); // gunakan NISN
    const role = (body?.role || "siswa").toLowerCase();

    if (!validNISN(username)) {
      return NextResponse.json({ ok: false, error: "Username harus NISN (8—12 digit)." }, { status: 400 });
    }

    // sementara: password = NISN
    const passwordHash = await sha256Hex(username);

    await adminDb.collection("users_app").doc(username).set(
      {
        username,           // ex: "0067xxxxxx"
        role,               // "siswa" | "guru" | "admin"
        isActive: true,
        passwordHash,       // hash dari NISN
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, username });
  } catch (e) {
    console.error("tmp-account error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
