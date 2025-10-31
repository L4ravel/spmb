export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import admin, { adminDb, FieldValue, adminBucket } from "@/lib/firebaseAdmin";
import { randomBytes } from "crypto";
import { Readable } from "stream";

/* ========= Helpers ========= */
const digits = (s) => String(s || "").replace(/\D+/g, "");
const isNISN = (s) => /^\d{8,12}$/.test(digits(s));
const isNIK  = (s) => /^\d{16}$/.test(digits(s));

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
  try { if (adminBucket?.name) return adminBucket; } catch {}
  const name = REQUIRED_BUCKET || "";
  if (!name) throw new Error("FIREBASE_STORAGE_BUCKET tidak diset");
  return admin.storage().bucket(name);
};

/* ===== Unique reservations ===== */
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
async function releaseRegistrationId(ref) { if (!ref) return; try { await ref.delete(); } catch {} }

async function reserveUniqueNISN(nisn) {
  if (!nisn) return null;
  const ref = adminDb.collection("unique_nisn").doc(nisn);
  await ref.create({ createdAt: FieldValue.serverTimestamp() }); // fail if exists
  return ref;
}
async function releaseUniqueNISN(ref) { if (!ref) return; try { await ref.delete(); } catch {} }

/* ========= Upload helpers ========= */
/** Streaming FormData kecil (legacy). NOTE: tidak akan bisa menembus limit proxy bila >~5MB. */
async function uploadFieldFile(fd, key, identifier) {
  const f = fd.get(key);
  if (!f || typeof f === "string" || !f.size) return null;

  const ts = Date.now();
  const ext = getExt(f.name, "bin");
  const storagePath = `ppdb/${identifier}/${key}-${ts}.${ext}`;

  const bucket = getBucket();
  const gcsFile = bucket.file(storagePath);

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
    expires: new Date(ts + 1000 * 60 * 60 * 24 * 365),
  });

  return { key, storagePath, url, contentType: f.type || null, size: f.size || null };
}

/** Buat resumable upload session URL (untuk file besar, di-upload langsung dari client). */
async function createResumableSession(identifier, key, filename, contentType) {
  const ts = Date.now();
  const ext = getExt(filename || key, "bin");
  const storagePath = `ppdb/${identifier}/${key}-${ts}.${ext}`;

  const bucket = getBucket();
  const file = bucket.file(storagePath);

  // URL untuk memulai sesi resumable
  const [uploadURL] = await file.createResumableUpload({ contentType: contentType || "application/octet-stream" });

  return { key, path: storagePath, uploadURL };
}

/* ========= Finalize writer ========= */
async function finalizeDoc({ form, identifier, registrationId, files, filesMeta }) {
  const jenjang = form.jenjang || "";
  const isEarly = isEarlyEducation(jenjang);

  // Validasi identifier (docId)
  let docId = "";
  if (isEarly) {
    const nik = digits(form.nik || "");
    if (!isNIK(nik)) throw new Error("NIK tidak valid (harus 16 digit).");
    if (identifier !== nik) throw new Error("Identifier tidak konsisten dengan NIK.");
    docId = nik.slice(-8);
  } else {
    const nisn = digits(form.nisn || "");
    if (!isNISN(nisn)) throw new Error("NISN tidak valid (harus 8-12 digit).");
    if (identifier !== nisn) throw new Error("Identifier tidak konsisten dengan NISN.");
    docId = nisn;
  }

  const docRef = adminDb.collection("ppdb").doc(docId);

  // Jika dokumen belum ada (mode init→finalize), buat dulu; jika sudah ada (legacy), cukup merge.
  const snap = await docRef.get();
  if (!snap.exists) {
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
  }

  await docRef.set(
    {
      ...form,
      registrationId,
      identifier,
      nik: form.nik || "",
      nisn: form.nisn || "",
      jenjang,
      files: files || {},
      filesMeta: filesMeta || {},
      status: "submitted",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { id: docId, identifier, registrationId, uploadedKeys: Object.keys(filesMeta || {}) };
}

/* ========= POST handler ========= */
export async function POST(req) {
  let uniqueNisnRef = null;
  let uniqueRegRef = null;

  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();

    /* ---------- JSON mode: op init/finalize (SAFE for big files) ---------- */
    if (ct.includes("application/json")) {
      const body = await req.json();
      const op = String(body?.op || "").toLowerCase();

      if (op === "init") {
        // body: { identifier, files:[{key, filename, contentType}] }
        const identifier = digits(body?.identifier || "");
        if (!identifier) {
          return NextResponse.json({ success: false, error: "identifier kosong." }, { status: 400 });
        }
        const files = Array.isArray(body?.files) ? body.files : [];
        if (!files.length) {
          return NextResponse.json({ success: false, error: "files kosong." }, { status: 400 });
        }
        const sessions = {};
        for (const it of files) {
          const key = String(it?.key || "").trim();
          if (!key) continue;
          const ses = await createResumableSession(identifier, key, it?.filename || key, it?.contentType || "");
          sessions[key] = ses; // { key, path, uploadURL }
        }
        return NextResponse.json({ success: true, uploads: sessions }, { status: 200 });
      }

      if (op === "finalize") {
        // body: { form:{...}, identifier, filesMeta:{ key:{ path,url,size,contentType } } }
        const form = body?.form || {};
        const jenjang = form.jenjang || "";
        const isEarly = isEarlyEducation(jenjang);

        // Reserve registrationId
        const { id: registrationId, ref: regRef } = await reserveRegistrationId2026();
        uniqueRegRef = regRef;

        // Reserve unique NISN (optional, jika ada)
        const nisnDigits = digits(form.nisn || "");
        try {
          if (isNISN(nisnDigits)) uniqueNisnRef = await reserveUniqueNISN(nisnDigits);
        } catch {
          await releaseRegistrationId(uniqueRegRef);
          return NextResponse.json(
            { success: false, error: "NISN sudah terdaftar. Gunakan NISN lain atau hubungi admin.", code: "NISN_EXISTS" },
            { status: 409 }
          );
        }

        // Finalize
        const out = await finalizeDoc({
          form,
          identifier: digits(body?.identifier || ""),
          registrationId,
          files: Object.fromEntries(
            Object.entries(body?.filesMeta || {}).map(([k, v]) => [k, v?.url]).filter(([,u]) => !!u)
          ),
          filesMeta: body?.filesMeta || {},
        });

        return NextResponse.json({ success: true, ...out }, { status: 200 });
      }

      return NextResponse.json({ success: false, error: "op tidak dikenali (gunakan 'init' atau 'finalize')." }, { status: 400 });
    }

    /* ---------- Legacy multipart/form-data (kecil saja) ---------- */
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();

      // Kumpulkan field text
      const form = {};
      fd.forEach((v, k) => { if (typeof v === "string") form[k] = v.trim(); });

      const jenjang = form.jenjang || "";
      const isEarly = isEarlyEducation(jenjang);

      // Reserve registrationId
      const { id: registrationId, ref: regRef } = await reserveRegistrationId2026();
      uniqueRegRef = regRef;

      // Validasi identifier & docId
      let identifier = "";
      let docId = "";

      if (isEarly) {
        const nik = digits(form.nik || "");
        if (!isNIK(nik)) {
          await releaseRegistrationId(uniqueRegRef);
          return NextResponse.json({ success: false, error: "NIK tidak valid (harus 16 digit)." }, { status: 400 });
        }
        identifier = nik;
        docId = nik.slice(-8);
      } else {
        const nisn = digits(form.nisn || "");
        if (!isNISN(nisn)) {
          await releaseRegistrationId(uniqueRegRef);
          return NextResponse.json({ success: false, error: "NISN tidak valid (harus 8-12 digit)." }, { status: 400 });
        }
        identifier = nisn;
        docId = nisn;
      }

      // Reserve NISN global (opsional jika ada)
      const nisnDigits = digits(form.nisn || "");
      try {
        if (isNISN(nisnDigits)) uniqueNisnRef = await reserveUniqueNISN(nisnDigits);
      } catch {
        await releaseRegistrationId(uniqueRegRef);
        return NextResponse.json(
          { success: false, error: "NISN sudah terdaftar. Gunakan NISN lain atau hubungi admin.", code: "NISN_EXISTS" },
          { status: 409 }
        );
      }

      const docRef = adminDb.collection("ppdb").doc(docId);

      // Cegah duplikat docId
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
        const msg = isEarly ? "NIK sudah terdaftar. Gunakan NIK lain atau hubungi admin."
                            : "NISN sudah terdaftar. Gunakan NISN lain.";
        return NextResponse.json({ success: false, error: msg, code: "IDENTIFIER_EXISTS" }, { status: 409 });
      }

      // Upload keys (kecil saja — besar akan ditolak oleh proxy sebelum masuk handler)
      const fileKeys = ["kk","akta","ijazah","ktpWali","sktm","pkhDtks","suketMeninggalOrtu","ktpMahasiswa","foto","kip"];

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
          { success: false, error: `Tidak ada file yang terunggah. Bucket="${bucketName}".` },
          { status: 400 }
        );
      }

      // Finalize dokumen
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
    }

    // Unsupported content-type
    return NextResponse.json({ success: false, error: "Content-Type tidak didukung." }, { status: 415 });

  } catch (err) {
    // Bersihkan reservasi
    try { await releaseUniqueNISN(uniqueNisnRef); } catch {}
    try { await releaseRegistrationId(uniqueRegRef); } catch {}

    console.error("PPDB API error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: typeof err?.status === "number" ? err.status : 500 }
    );
  }
}
