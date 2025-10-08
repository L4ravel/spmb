export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import admin, { adminDb, FieldValue, adminBucket } from "@/lib/firebaseAdmin";

/* ===== Helpers & Bucket ===== */
const digits = (s) => String(s || "").replace(/\D+/g, "");
const isNISN = (s) => /^\d{8,12}$/.test(digits(s));
const isNIK = (s) => /^\d{16}$/.test(digits(s));

// Early hanya: TK, SD, PPS Ula (bukan karena mengandung kata putra/putri)
const isEarlyEducation = (jenjang) => {
  const norm = String(jenjang || "")
    .toLowerCase()
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (norm === "tk" || norm === "taman kanak kanak") return true;
  if (norm === "sd" || norm.startsWith("sd ")) return true;
  if (norm.includes("pps ula")) return true;

  return false;
};

function getExt(name, fallback = "bin") {
  const n = String(name || "");
  const i = n.lastIndexOf(".");
  const ext = i >= 0 ? n.slice(i + 1) : "";
  return (ext || fallback).toLowerCase();
}

const REQUIRED_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;
const getBucket = () => {
  try {
    if (adminBucket?.name) return adminBucket;
  } catch {}
  const name = REQUIRED_BUCKET || "";
  if (!name) throw new Error("FIREBASE_STORAGE_BUCKET tidak diset");
  return admin.storage().bucket(name);
};

async function uploadFieldFile(fd, key, identifier) {
  const f = fd.get(key);
  if (!f || typeof f === "string" || !f.size) return null;

  const ab = await f.arrayBuffer();
  const buffer = Buffer.from(ab);
  const ts = Date.now();
  const ext = getExt(f.name, "bin");
  const storagePath = `ppdb/${identifier}/${key}-${ts}.${ext}`;

  const bucket = getBucket();
  const gcsFile = bucket.file(storagePath);

  await gcsFile.save(buffer, {
    resumable: false,
    contentType: f.type || "application/octet-stream",
    metadata: { cacheControl: "public,max-age=31536000" },
  });

  const [url] = await gcsFile.getSignedUrl({
    action: "read",
    expires: new Date(ts + 1000 * 60 * 60 * 24 * 365), // 1 tahun
  });

  return {
    key,
    storagePath,
    url,
    contentType: f.type || null,
    size: f.size || null,
  };
}

/* ===== Unique NISN Reservation ===== */
async function reserveUniqueNISN(nisn) {
  if (!nisn) return null; // skip jika kosong
  const ref = adminDb.collection("unique_nisn").doc(nisn);
  // create() akan gagal jika sudah ada → guard unik
  await ref.create({
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref;
}

async function releaseUniqueNISN(ref) {
  if (!ref) return;
  try {
    await ref.delete();
  } catch {}
}

/* ===== Handler ===== */
export async function POST(req) {
  // untuk rollback jika error tak terduga
  let uniqueNisnRef = null;

  try {
    const fd = await req.formData();

    // kumpulkan field text
    const form = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") form[k] = v.trim();
    });

    const jenjang = form.jenjang || "";
    const isEarly = isEarlyEducation(jenjang);

    // === VALIDASI IDENTIFIER ===
    let identifier = "";
    let docId = "";

    if (isEarly) {
      // TK/SD/PPS Ula: gunakan 8 digit terakhir NIK sebagai docId
      const nikRaw = form.nik || "";
      const nik = digits(nikRaw);

      if (!isNIK(nik)) {
        return NextResponse.json(
          { success: false, error: "NIK tidak valid (harus 16 digit)." },
          { status: 400 }
        );
      }

      identifier = nik;
      docId = nik.slice(-8); // 8 digit terakhir sebagai doc ID
    } else {
      // SMP/SMA/Universitas: gunakan NISN sebagai docId
      const nisnRaw = form.nisn || "";
      const nisn = digits(nisnRaw);

      if (!isNISN(nisn)) {
        return NextResponse.json(
          { success: false, error: "NISN tidak valid (harus 8-12 digit)." },
          { status: 400 }
        );
      }

      identifier = nisn;
      docId = nisn;
    }

    // === Reservasi NISN global (unik untuk semua jenjang) ===
    // Catatan: untuk early, NISN tetap wajib unik bila diisi & valid.
    const nisnDigits = digits(form.nisn || "");
    try {
      if (isNISN(nisnDigits)) {
        uniqueNisnRef = await reserveUniqueNISN(nisnDigits);
      }
    } catch (e) {
      // Sudah ada NISN yang sama
      return NextResponse.json(
        {
          success: false,
          error:
            "NISN sudah terdaftar. Gunakan NISN lain atau hubungi admin.",
          code: "NISN_EXISTS",
        },
        { status: 409 }
      );
    }

    const docRef = adminDb.collection("ppdb").doc(docId);

    // === CEGAH DUPLIKAT docId (atomic create) ===
    try {
      await docRef.create({
        ...form,
        identifier: docId,
        nik: form.nik || "",
        nisn: form.nisn || "",
        jenjang,
        status: "uploading",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // rollback reservasi NISN karena docId gagal dibuat
      await releaseUniqueNISN(uniqueNisnRef);
      const msg = isEarly
        ? "NIK sudah terdaftar. Gunakan NIK lain atau hubungi admin."
        : "NISN sudah terdaftar. Gunakan NISN lain.";
      return NextResponse.json(
        { success: false, error: msg, code: "IDENTIFIER_EXISTS" },
        { status: 409 }
      );
    }

    // === Upload berkas ke ppdb/{identifier}/... ===
    const fileKeys = ["kk", "akta", "ijazah", "foto", "kip"];
    const files = {};
    const filesMeta = {};
    let uploadedCount = 0;

    for (const key of fileKeys) {
      const up = await uploadFieldFile(fd, key, identifier);
      if (up) {
        uploadedCount++;
        files[key] = up.url;
        filesMeta[key] = {
          path: up.storagePath,
          url: up.url,
          contentType: up.contentType,
          size: up.size,
          uploadedAt: FieldValue.serverTimestamp(),
        };
      }
    }

    // Jika tak ada file, rollback dokumen & reservasi NISN biar bersih
    if (uploadedCount === 0) {
      await docRef.delete().catch(() => {});
      await releaseUniqueNISN(uniqueNisnRef); // rollback reservasi NISN
      const bucketName = getBucket()?.name || "(unknown)";
      return NextResponse.json(
        {
          success: false,
          error: `Tidak ada file yang terunggah. Cek name field (kk/akta/ijazah/foto/kip) & ukuran file. Bucket="${bucketName}".`,
        },
        { status: 400 }
      );
    }

    // === Finalize dokumen ===
    await docRef.set(
      {
        ...form,
        identifier: docId,
        nik: form.nik || "",
        nisn: form.nisn || "",
        jenjang,
        files,
        filesMeta,
        status: "submitted",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const bucketName = getBucket()?.name || "(unknown)";
    return NextResponse.json({
      success: true,
      id: docId,
      identifier: docId,
      bucket: bucketName,
      folder: `ppdb/${identifier}/`,
      uploadedKeys: Object.keys(filesMeta),
      filesMeta,
      status: "submitted",
    });
  } catch (err) {
    // upaya terakhir: bila ada reservasi NISN yang sempat dibuat, lepas
    try {
      await releaseUniqueNISN(uniqueNisnRef);
    } catch {}
    console.error("PPDB API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}
