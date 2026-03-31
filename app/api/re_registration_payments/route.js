import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

/** Ambil NISN dari cookie ppdb_session (base64 JSON: { id }) */
function getNisnFromCookie(req) {
  const v = req.cookies.get?.("ppdb_session")?.value;
  if (!v) return null;
  try {
    const obj = JSON.parse(Buffer.from(decodeURIComponent(v), "base64").toString("utf8"));
    return obj?.id || null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const nisn = getNisnFromCookie(req);
    if (!nisn) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount || 0);
    const note = String(body?.note || "");
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Jumlah pembayaran tidak valid." }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: "Minimal sertakan satu bukti." }, { status: 400 });
    }

    // Validasi struktur item
    for (const it of items) {
      if (!it || typeof it.storagePath !== "string" || !it.storagePath) {
        return NextResponse.json({ error: "storagePath tidak valid." }, { status: 400 });
      }
    }

    const db = getAdminDb();

    // (Opsional) verifikasi peserta ada
    const uSnap = await db.collection("users_app").doc(nisn).get();
    if (!uSnap.exists) {
      return NextResponse.json({ error: "Data peserta tidak ditemukan." }, { status: 404 });
    }

    const batch = db.batch();
    const col = db.collection("users_app").doc(nisn).collection("payments");

    for (const it of items) {
      const ref = col.doc();
      batch.set(ref, {
        amount,
        note,
        fileName: String(it.fileName || ""),
        storagePath: String(it.storagePath || ""),
        downloadURL: it.downloadURL ? String(it.downloadURL) : null,
        createdAt: FieldValue.serverTimestamp(),
        type: "re_registration",
      });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "ERR" }, { status: 500 });
  }
}
