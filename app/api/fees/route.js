import { NextResponse } from "next/server";

// ⚠️ Pastikan modul admin ini tersedia. Di proyekmu sebelumnya sudah ada adminDb.
// Jika berbeda, sesuaikan import-nya.
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// konsisten dengan helper lain
function toSafeUpperSnake(s) {
  return (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");
}

/** GET: daftar semua fee */
export async function GET() {
  try {
    const snap = await adminDb.collection("fees").get();
    const items = snap.docs
      .map((d) => ({ key: d.id, ...d.data() }))
      // urutkan alfabetis label
      .sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || "Gagal mengambil data." }, { status: 500 });
  }
}

/** POST: upsert fee { jenjangLabel, fee } */
export async function POST(req) {
  try {
    const body = await req.json();
    const jenjangLabel = String(body?.jenjangLabel || "").trim();
    const fee = Number(body?.fee);

    if (!jenjangLabel) {
      return NextResponse.json({ success: false, error: "jenjangLabel wajib diisi." }, { status: 400 });
    }
    if (!Number.isFinite(fee) || fee < 0) {
      return NextResponse.json({ success: false, error: "fee tidak valid." }, { status: 400 });
    }

    const key = toSafeUpperSnake(jenjangLabel);
    await adminDb.collection("fees").doc(key).set(
      {
        key,
        label: jenjangLabel,
        fee,
        currency: "IDR",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, key });
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || "Gagal menyimpan data." }, { status: 500 });
  }
}
