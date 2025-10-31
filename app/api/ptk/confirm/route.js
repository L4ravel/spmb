// app/api/ptk/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminDb, FieldValue } from "@/lib/firebaseAdmin";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function mustUserExists(nisn) {
  const snap = await adminDb.doc(`users_app/${nisn}`).get();
  return snap.exists ? snap.data() : null;
}

// ===== Revisi: hapus kewajiban NIK; tambah dukungan saudara & instansi =====
function validatePayload(b) {
  const errs = [];
  const ne = (s) => typeof s === "string" && s.trim().length > 0;
  if (!ne(b?.nisn)) errs.push("nisn wajib.");
  if (!ne(b?.parentName)) errs.push("Nama orang tua/wali wajib.");
  if (!ne(b?.jenjang)) errs.push("Jenjang wajib.");
  if (!ne(b?.jabatan)) errs.push("Jabatan/Profesi orang tua wajib.");
  // NIK tidak lagi divalidasi/diwajibkan
  // Validasi ringan untuk siblings (opsional)
  if (Array.isArray(b?.siblings)) {
    for (const s of b.siblings) {
      if (s && typeof s === "object") {
        if (("class" in s) && typeof s.class !== "string") errs.push("Format kelas saudara tidak valid.");
        if (("jenjang" in s) && typeof s.jenjang !== "string") errs.push("Format jenjang saudara tidak valid.");
        if (("name" in s) && typeof s.name !== "string") errs.push("Format nama saudara tidak valid.");
      }
    }
  }
  return errs;
}

/* GET (tetap) */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const nisn = searchParams.get("nisn");
  if (!nisn) return bad("nisn query wajib.");

  const userDoc = await mustUserExists(nisn);
  if (!userDoc) return bad("users_app tidak ditemukan.", 404);

  const ref = adminDb.doc(`users_app/${nisn}/ptk_confirmation/current`);
  const snap = await ref.get();

  return ok({
    exists: snap.exists,
    data: snap.exists ? snap.data() : null,
    student: {
      nisn,
      name: userDoc?.fullName || userDoc?.nama || userDoc?.name || "",
    },
  });
}

/* POST (revisi: tanpa NIK, simpan data saudara & instansi) */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const errs = validatePayload(body);
  if (errs.length) return bad(errs.join(" "));

  const userDoc = await mustUserExists(body.nisn);
  if (!userDoc) return bad("users_app tidak ditemukan.", 404);

  // Normalisasi data saudara:
  // - format baru: siblings[] = { name, jenjang, class }
  // - fallback lama: siblingName / siblingJenjang / siblingClass
  const siblings = Array.isArray(body.siblings)
    ? body.siblings.map((s) => ({
        name: String(s?.name || "").trim(),
        jenjang: String(s?.jenjang || ""),
        class: String(s?.class || ""),
      }))
    : [];

  const first =
    siblings[0] || {
      name: String(body.siblingName || "").trim(),
      jenjang: String(body.siblingJenjang || ""),
      class: String(body.siblingClass || ""),
    };

  const siblingsCount =
    body.siblingsCount === null || body.siblingsCount === undefined || body.siblingsCount === ""
      ? null
      : Math.max(0, Number(body.siblingsCount) || 0);

  const payload = {
    // Required
    nisn: String(body.nisn),
    parentName: String(body.parentName).trim(),
    jenjang: String(body.jenjang).trim(),
    jabatan: String(body.jabatan).trim(),

    // Revisi: NIK dihapus dari penyimpanan
    // nik: FieldValue.delete(),

    // Tambahan (opsional)
    parentInstitution: String(body.parentInstitution || ""),
    siblingsCount,               // jumlah saudara (bisa null)
    siblings,                    // format baru (array)
    siblingName: first.name,     // fallback lama — tetap diisi agar kompatibel
    siblingJenjang: first.jenjang,
    siblingClass: first.class,

    status: "PENDING", // pertahankan alur lama
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = adminDb.doc(`users_app/${body.nisn}/ptk_confirmation/current`);
  await ref.set(payload, { merge: true });

  return ok({ ok: true });
}

/* PATCH (admin) — tidak diubah */
function isAdminByKey(request) {
  const key = request.headers.get("x-admin-key");
  const expected = process.env.ADMIN_API_KEY || "";
  return expected && key && key === expected;
}

export async function PATCH(request) {
  if (!isAdminByKey(request)) return bad("Forbidden", 403);

  const { nisn, status, note } = await request.json().catch(() => ({}));
  if (!nisn || !["APPROVED", "REJECTED"].includes(status)) {
    return bad("nisn & status invalid", 400);
  }
  const userDoc = await mustUserExists(nisn);
  if (!userDoc) return bad("users_app tidak ditemukan.", 404);

  const ref = adminDb.doc(`users_app/${nisn}/ptk_confirmation/current`);
  await ref.set(
    {
      status,
      note: typeof note === "string" ? note.slice(0, 500) : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return ok({ ok: true });
}
