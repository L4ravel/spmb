import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { getStorage } from "firebase-admin/storage";

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

function safeFileName(name = "") {
  // buang karakter berisiko di nama file
  return String(name).replace(/[^\w.\-()]/g, "_").slice(0, 120);
}

export async function POST(req) {
  try {
    // (opsional) origin check sederhana
    const origin = req.headers.get("origin") || "";
    const allowed = process.env.NEXT_PUBLIC_APP_ORIGIN;
    if (allowed && origin && origin !== allowed) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const nisn = getNisnFromCookie(req);
    if (!nisn) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const form = await req.formData();
    const amountStr = form.get("amount");
    const note = String(form.get("note") || "");
    const files = form.getAll("files");

    const amount = Number(String(amountStr || "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Jumlah pembayaran tidak valid." }, { status: 400 });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "Minimal sertakan satu bukti." }, { status: 400 });
    }

    const db = getAdminDb();
    const uSnap = await db.collection("users_app").doc(nisn).get();
    if (!uSnap.exists) {
      return NextResponse.json({ error: "Data peserta tidak ditemukan." }, { status: 404 });
    }

    const bucket = getStorage().bucket(); // Admin SDK Storage (bypass rules)
    const uploadedItems = [];

    for (const file of files) {
      if (!file || typeof file.name !== "string") continue;
      const contentType = file.type || "application/octet-stream";
      // Pembatasan tipe/ukuran di server (opsional kuatkan sesuai kebutuhan)
      if (
        !(contentType.startsWith("image/") || contentType === "application/pdf")
      ) {
        return NextResponse.json({ error: "Tipe file tidak didukung." }, { status: 400 });
      }
      // contoh batas 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "File terlalu besar (>10MB)." }, { status: 400 });
      }

      const stamp = Date.now();
      const cleanName = safeFileName(file.name || "bukti");
      const dest = `re_registration_payments/${nisn}/${stamp}_${cleanName}`;

      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const gcsFile = bucket.file(dest);
      await gcsFile.save(buffer, {
        contentType,
        resumable: false,
        metadata: { contentType },
      });

      // Karena rules read:true, kita bisa bentuk direct media URL:
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        dest
      )}?alt=media`;

      uploadedItems.push({
        fileName: cleanName,
        storagePath: dest,
        downloadURL,
      });
    }

    // Tulis payment docs (server-side)
    const batch = db.batch();
    const col = db.collection("users_app").doc(nisn).collection("payments");
    for (const it of uploadedItems) {
      const ref = col.doc();
      batch.set(ref, {
        amount,
        note,
        fileName: it.fileName,
        storagePath: it.storagePath,
        downloadURL: it.downloadURL,
        createdAt: FieldValue.serverTimestamp(),
        type: "re_registration",
        verified: false, // siap diverifikasi admin
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, count: uploadedItems.length });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "ERR" }, { status: 500 });
  }
}
