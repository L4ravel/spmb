export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import admin, { adminDb, FieldValue, adminBucket } from "@/lib/firebaseAdmin";
import { randomBytes } from "crypto";
import { Readable } from "stream";

/* ===== Helpers & Bucket ===== */
const digits = (s) => String(s || "").replace(/\D+/g, "");
const isNISN = (s) => /^\d{8,12}$/.test(digits(s));
const isNIK = (s) => /^\d{16}$/.test(digits(s));

/** Early hanya: TK & SD (Putra/Putri) — selaras dengan page.js */
const isEarlyEducation = (jenjang) => {
  const norm = String(jenjang || "")
    .toLowerCase()
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (norm === "tk" || norm === "taman kanak kanak") return true;
  if (norm === "sd" || norm.startsWith("sd ")) return true;
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

// batas aman produksi (Vercel body limit ketat). Kamera > 9MB ditolak.
const MAX_FILE_BYTES = 9 * 1024 * 1024;

/**
 * Upload satu field file via STREAM (tanpa buffer).
 * - Tolak jika > MAX_FILE_BYTES (kembalikan error 413 yang rapi).
 */
async function uploadFieldFile(fd, key, identifier) {
  const f = fd.get(key);
  if (!f || typeof f === "string" || !f.size) return null;

  if (typeof f.size === "number" && f.size > MAX_FILE_BYTES) {
    const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
    const maxMB = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    const err = new Error(
      `Berkas "${key}" terlalu besar (${sizeMB}MB). Batas ${maxMB}MB.`
    );
    // tambahkan kode agar caller bisa balas 413
    err.name = "PAYLOAD_TOO_LARGE";
    throw err;
  }

  const ts = Date.now();
  const ext = getExt(f.name, "bin");
  const storagePath = `ppdb/${identifier}/${key}-${ts}.${ext}`;

  const bucket = getBucket();
  const gcsFile = bucket.file(storagePath);

  // stream: WebReadableStream -> Node Readable -> pipe ke GCS
  const nodeStream = Readable.fromWeb(f.stream());
  await new Promise((resolve, reject) => {
    const ws = gcsFile.createWriteStream({
      resumable: true,
      contentType: f.type || "application/octet-stream",
      validation: "crc32c",
      metadata: { cacheControl: "public,max-age=31536000" },
    });
    nodeStream.pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
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
  await ref.create({ createdAt: FieldValue.serverTimestamp() }); // fail if exists
  return ref;
}
async function releaseUniqueNISN(ref) {
  if (!ref) return;
  try {
    await ref.delete();
  } catch {}
}

/* ===== Registration ID: 2026 + 4 alfanumerik (unik) ===== */
const ALPHANUM =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randomToken4() {
  const buf = randomBytes(4);
  let out = "";
  for (let i = 0; i < 4; i++) out += ALPHANUM[buf[i] % ALPHANUM.length];
  return out;
}
async function reserveRegistrationId2026(maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidate = `2026${randomToken4()}`;
    const ref = adminDb.collection("unique_registration").doc(candidate);
    try {
      await ref.create({
        createdAt: FieldValue.serverTimestamp(),
        note: "registration id reservation",
        version: 1,
      });
      return { id: candidate, ref };
    } catch (err) {
      const msg = String(err?.message || "");
      if (err?.code === 6 || /ALREADY_EXISTS/i.test(msg)) continue;
      throw err;
    }
  }
  throw new Error("FAILED_GENERATE_UNIQUE_REGISTRATION_ID");
}
async function releaseRegistrationId(ref) {
  if (!ref) return;
  try {
    await ref.delete();
  } catch {}
}

/* ===== Handler ===== */
export async function POST(req) {
  let uniqueNisnRef = null;
  let uniqueRegRef = null;

  try {
    const fd = await req.formData();

    // kumpulkan field text
    const form = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") form[k] = v.trim();
    });

    const jenjang = form.jenjang || "";
    const isEarly = isEarlyEducation(jenjang);

    // === GENERATE & RESERVE registrationId unik: 2026xxxx ===
    const { id: registrationId, ref: regRef } =
      await reserveRegistrationId2026();
    uniqueRegRef = regRef;

    // === VALIDASI IDENTIFIER (docId) ===
    let identifier = "";
    let docId = "";

    if (isEarly) {
      // TK/SD: gunakan 8 digit terakhir NIK sebagai docId, folder memakai NIK 16 digit (identifier)
      const nik = digits(form.nik || "");
      if (!isNIK(nik)) {
        await releaseRegistrationId(uniqueRegRef);
        return NextResponse.json(
          { success: false, error: "NIK tidak valid (harus 16 digit)." },
          { status: 400 }
        );
      }
      identifier = nik; // 16 digit → folder & field identifier
      docId = nik.slice(-8); // ID dokumen
    } else {
      // SMP/SMA/Ma'had Aly: gunakan NISN
      const nisn = digits(form.nisn || "");
      if (!isNISN(nisn)) {
        await releaseRegistrationId(uniqueRegRef);
        return NextResponse.json(
          { success: false, error: "NISN tidak valid (harus 8-12 digit)." },
          { status: 400 }
        );
      }
      identifier = nisn;
      docId = nisn;
    }

    // === Reservasi NISN global (unik) — jika valid tersedia
    const nisnDigits = digits(form.nisn || "");
    try {
      if (isNISN(nisnDigits)) {
        uniqueNisnRef = await reserveUniqueNISN(nisnDigits);
      }
    } catch (e) {
      await releaseRegistrationId(uniqueRegRef);
      return NextResponse.json(
        {
          success: false,
          error: "NISN sudah terdaftar. Gunakan NISN lain atau hubungi admin.",
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
        registrationId,
        identifier,
        nik: form.nik || "",
        nisn: form.nisn || "",
        jenjang,
        status: "uploading",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      await releaseUniqueNISN(uniqueNisnRef);
      await releaseRegistrationId(uniqueRegRef);
      const msg = isEarly
        ? "NIK sudah terdaftar. Gunakan NIK lain atau hubungi admin."
        : "NISN sudah terdaftar. Gunakan NISN lain.";
      return NextResponse.json(
        { success: false, error: msg, code: "IDENTIFIER_EXISTS" },
        { status: 409 }
      );
    }

    // === Upload berkas (stream) → selaras dengan komponen upload_dokumen ===
    const fileKeys = [
      "kk",
      "akta",
      "ijazah",
      // program keringanan:
      "ktpWali",
      "sktm",
      "pkhDtks",
      "suketMeninggalOrtu",
      // khusus Ma'had Aly:
      "ktpMahasiswa",
      // kompatibilitas lama:
      "foto",
      "kip",
    ];

    const files = {};
    const filesMeta = {};
    let uploadedCount = 0;

    for (const key of fileKeys) {
      try {
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
      } catch (e) {
        if (e?.name === "PAYLOAD_TOO_LARGE") {
          // Hapus dokumen & reservasi lalu balas 413 JSON (bukan HTML)
          await docRef.delete().catch(() => {});
          await releaseUniqueNISN(uniqueNisnRef);
          await releaseRegistrationId(uniqueRegRef);
          return NextResponse.json(
            { success: false, error: e.message, code: "PAYLOAD_TOO_LARGE" },
            { status: 413 }
          );
        }
        throw e;
      }
    }

    if (uploadedCount === 0) {
      await docRef.delete().catch(() => {});
      await releaseUniqueNISN(uniqueNisnRef);
      await releaseRegistrationId(uniqueRegRef);
      const bucketName = getBucket()?.name || "(unknown)";
      return NextResponse.json(
        { success: false, error: `Tidak ada file yang terunggah. Bucket="${bucketName}".` },
        { status: 400 }
      );
    }

    // === Finalize dokumen ===
    await docRef.set(
      {
        ...form,
        registrationId,
        identifier,
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
      identifier,
      registrationId,
      bucket: bucketName,
      folder: `ppdb/${identifier}/`,
      uploadedKeys: Object.keys(filesMeta),
      filesMeta,
      status: "submitted",
    });
  } catch (err) {
    try {
      await releaseUniqueNISN(uniqueNisnRef);
    } catch {}
    try {
      await releaseRegistrationId(uniqueRegRef);
    } catch {}
    console.error("PPDB API error:", err);
    const status =
      err?.name === "PAYLOAD_TOO_LARGE" ? 413 :
      typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status }
    );
  }
}
