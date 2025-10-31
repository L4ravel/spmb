// app/api/ppdb/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import admin, { adminDb, FieldValue, adminBucket } from "@/lib/firebaseAdmin";
import { randomBytes } from "crypto";

/* ========== Helpers ========== */
const digits = (s) => String(s ?? "").replace(/\D+/g, "");
const isNISN = (s) => /^\d{8,12}$/.test(digits(s));
const isNIK = (s) => /^\d{16}$/.test(digits(s));

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
function getBucket() {
  try {
    if (adminBucket && adminBucket.name) return adminBucket;
  } catch {}
  const name = REQUIRED_BUCKET || "";
  if (!name) throw new Error("FIREBASE_STORAGE_BUCKET tidak diset");
  return admin.storage().bucket(name);
}

/* ===== Upload helper (jalur lama FormData) ===== */
async function uploadFieldFile(fd, key, identifier) {
  const f = fd.get(key);
  if (!f || typeof f === "string" || !(f?.size > 0)) return null;

  const ab = await f.arrayBuffer();
  const buffer = Buffer.from(ab);
  const ts = Date.now();
  const ext = getExt(f.name, "bin");
  const storagePath = `ppdb/${identifier}/${key}-${ts}.${ext}`;

  const bucket = getBucket();
  const gcsFile = bucket.file(storagePath);

  await gcsFile.save(buffer, {
    resumable: true,
    contentType: f.type || "application/octet-stream",
    validation: "crc32c",
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

/* ===== Unique reservations ===== */
async function reserveUniqueNISN(nisn) {
  if (!nisn) return null;
  const ref = adminDb.collection("unique_nisn").doc(nisn);
  await ref.create({ createdAt: FieldValue.serverTimestamp() });
  return ref;
}
async function releaseUniqueNISN(ref) {
  if (!ref) return;
  try { await ref.delete(); } catch {}
}

const ALPHANUM = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
  try { await ref.delete(); } catch {}
}

/* ===== Finalize writer (dipakai kedua mode) ===== */
async function finalizeWrite({ form, jenjang, identifier, registrationId, files, filesMeta }) {
  const isEarly = isEarlyEducation(jenjang);

  let docId = "";
  if (isEarly) {
    const nik = digits(form?.nik || "");
    docId = nik.slice(-8);
  } else {
    const nisn = digits(form?.nisn || "");
    docId = nisn;
  }

  const docRef = adminDb.collection("ppdb").doc(docId);
  const snap = await docRef.get();

  if (!snap.exists) {
    await docRef.create({
      ...form,
      registrationId,
      identifier,
      nik: form?.nik || "",
      nisn: form?.nisn || "",
      jenjang,
      files,
      filesMeta,
      status: "submitted",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await docRef.set(
      {
        ...form,
        registrationId,
        identifier,
        nik: form?.nik || "",
        nisn: form?.nisn || "",
        jenjang,
        files,
        filesMeta,
        status: "submitted",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { docId, uploadedKeys: Object.keys(filesMeta || {}) };
}

/* ========== Handler ========== */
export async function POST(req) {
  let uniqueNisnRef = null;
  let uniqueRegRef = null;

  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();

    /* ---- MODE BARU: JSON FINALIZE ---- */
    if (ct.includes("application/json")) {
      const body = await req.json();
      const op = String(body?.op || "").toLowerCase();
      if (op !== "finalize") {
        return NextResponse.json(
          { success: false, error: "op tidak dikenali. Gunakan 'finalize'." },
          { status: 400 }
        );
      }

      const form = body?.form || {};
      const jenjang = String(form?.jenjang || "");
      const isEarly = isEarlyEducation(jenjang);

      const identifier = digits(body?.identifier || "");
      if (!identifier) {
        return NextResponse.json({ success: false, error: "identifier kosong." }, { status: 400 });
      }

      if (isEarly) {
        const nik = digits(form?.nik || "");
        if (!isNIK(nik)) return NextResponse.json({ success: false, error: "NIK harus 16 digit." }, { status: 400 });
        if (identifier !== nik) return NextResponse.json({ success: false, error: "Identifier ≠ NIK." }, { status: 400 });
      } else {
        const nisn = digits(form?.nisn || "");
        if (!isNISN(nisn)) return NextResponse.json({ success: false, error: "NISN 8–12 digit." }, { status: 400 });
        if (identifier !== nisn) return NextResponse.json({ success: false, error: "Identifier ≠ NISN." }, { status: 400 });
      }

      const { id: registrationId, ref: regRef } = await reserveRegistrationId2026();
      uniqueRegRef = regRef;

      const nisnDigits = digits(form?.nisn || "");
      try {
        if (isNISN(nisnDigits)) uniqueNisnRef = await reserveUniqueNISN(nisnDigits);
      } catch {
        await releaseRegistrationId(uniqueRegRef);
        return NextResponse.json(
          { success: false, error: "NISN sudah terdaftar.", code: "NISN_EXISTS" },
          { status: 409 }
        );
      }

      // normalize files
      const rawMeta = body?.filesMeta || {};
      const files = {};
      const filesMeta = {};
      for (const [k, v] of Object.entries(rawMeta)) {
        if (v?.path) filesMeta[k] = v;
        if (v?.url) files[k] = String(v.url);
      }

      const { docId, uploadedKeys } = await finalizeWrite({
        form, jenjang, identifier, registrationId, files, filesMeta,
      });

      const bucketName = getBucket()?.name || "(unknown)";
      return NextResponse.json({
        success: true,
        id: docId,
        identifier,
        registrationId,
        bucket: bucketName,
        folder: `ppdb/${identifier}/`,
        uploadedKeys,
        filesMeta,
        status: "submitted",
        mode: "json-finalize",
      });
    }

    /* ---- MODE LAMA: multipart/form-data ---- */
    const fd = await req.formData();

    // text fields
    const form = {};
    fd.forEach((v, k) => { if (typeof v === "string") form[k] = v.trim(); });

    const jenjang = form.jenjang || "";
    const isEarly = isEarlyEducation(jenjang);

    const { id: registrationId, ref: regRef } = await reserveRegistrationId2026();
    uniqueRegRef = regRef;

    let identifier = "";
    let docId = "";

    if (isEarly) {
      const nik = digits(form.nik || "");
      if (!isNIK(nik)) {
        await releaseRegistrationId(uniqueRegRef);
        return NextResponse.json({ success: false, error: "NIK harus 16 digit." }, { status: 400 });
      }
      identifier = nik;
      docId = nik.slice(-8);
    } else {
      const nisn = digits(form.nisn || "");
      if (!isNISN(nisn)) {
        await releaseRegistrationId(uniqueRegRef);
        return NextResponse.json({ success: false, error: "NISN 8–12 digit." }, { status: 400 });
      }
      identifier = nisn;
      docId = nisn;
    }

    const nisnDigits = digits(form.nisn || "");
    try {
      if (isNISN(nisnDigits)) uniqueNisnRef = await reserveUniqueNISN(nisnDigits);
    } catch {
      await releaseRegistrationId(uniqueRegRef);
      return NextResponse.json(
        { success: false, error: "NISN sudah terdaftar.", code: "NISN_EXISTS" },
        { status: 409 }
      );
    }

    const docRef = adminDb.collection("ppdb").doc(docId);
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
    } catch {
      await releaseUniqueNISN(uniqueNisnRef);
      await releaseRegistrationId(uniqueRegRef);
      const msg = isEarly
        ? "NIK sudah terdaftar. Hubungi admin."
        : "NISN sudah terdaftar.";
      return NextResponse.json({ success: false, error: msg, code: "IDENTIFIER_EXISTS" }, { status: 409 });
    }

    const fileKeys = [
      "kk","akta","ijazah",
      "ktpWali","sktm","pkhDtks","suketMeninggalOrtu",
      "ktpMahasiswa",
      "foto","kip", // kompat lama (jika ada)
    ];

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

    if (uploadedCount === 0) {
      await docRef.delete().catch(() => {});
      await releaseUniqueNISN(uniqueNisnRef);
      await releaseRegistrationId(uniqueRegRef);
      const bucketName = getBucket()?.name || "(unknown)";
      return NextResponse.json(
        { success: false, error: `Tidak ada file diunggah. Bucket="${bucketName}".` },
        { status: 400 }
      );
    }

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
      mode: "multipart",
    });

  } catch (err) {
    try { await releaseUniqueNISN(uniqueNisnRef); } catch {}
    try { await releaseRegistrationId(uniqueRegRef); } catch {}
    console.error("PPDB API error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
