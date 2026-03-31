// app/api/ptk/confirm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminDb, FieldValue } from "@/lib/firebaseAdmin";

const ok  = (data, status = 200) => NextResponse.json(data, { status });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function mustUserExists(nisn) {
  const snap = await adminDb.doc(`users_app/${nisn}`).get();
  return snap.exists ? snap.data() : null;
}

// ===== Validasi lama (PTK confirm) =====
function validatePayloadPTK(b) {
  const errs = [];
  const ne = (s) => typeof s === "string" && s.trim().length > 0;

  // Hanya NISN yang benar-benar wajib
  if (!ne(b?.nisn)) errs.push("nisn wajib.");

  // parentName, jenjang, jabatan TIDAK lagi wajib.
  // Kalau mau, kita hanya cek kalau diisi tipenya harus string:
  if (b?.parentName != null && typeof b.parentName !== "string") {
    errs.push("Format nama orang tua/wali tidak valid.");
  }
  if (b?.jenjang != null && typeof b.jenjang !== "string") {
    errs.push("Format jenjang tidak valid.");
  }
  if (b?.jabatan != null && typeof b.jabatan !== "string") {
    errs.push("Format jabatan/profesi orang tua tidak valid.");
  }

  // Validasi ringan untuk siblings (opsional)
  if (Array.isArray(b?.siblings)) {
    for (const s of b.siblings) {
      if (s && typeof s === "object") {
        if (("class" in s)   && typeof s.class   !== "string") errs.push("Format kelas saudara tidak valid.");
        if (("jenjang" in s) && typeof s.jenjang !== "string") errs.push("Format jenjang saudara tidak valid.");
        if (("name" in s)    && typeof s.name    !== "string") errs.push("Format nama saudara tidak valid.");
      }
    }
  }
  return errs;
}


// ===== Validasi baru (Non-PTK: simpan saudara saja) =====
function validatePayloadSiblings(b) {
  const errs = [];
  const ne = (s) => typeof s === "string" && s.trim().length > 0;

  if (!ne(b?.nisn)) errs.push("nisn wajib.");
  if (!Array.isArray(b?.siblings)) errs.push("siblings harus berupa array.");
  else if (b.siblings.length > 20) errs.push("siblings maksimal 20 entri.");

  if (Array.isArray(b?.siblings)) {
    for (const s of b.siblings) {
      if (s && typeof s === "object") {
        const name  = "name"  in s ? s.name  : s.nama;
        const level = "level" in s ? s.level : s.jenjang;
        const kelas = "class" in s ? s.class : s.kelas;

        if (name  != null && typeof name  !== "string")
          errs.push("name harus string.");
        if (level != null && typeof level !== "string")
          errs.push("level/jenjang harus string.");
        if (kelas != null && typeof kelas !== "string")
          errs.push("kelas harus string.");
      } else if (s != null) {
        errs.push("Setiap item siblings harus object.");
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

/* POST
   - mode default: tetap proses konfirmasi PTK (payload lama)
   - mode Non-PTK siblings: { action: "save_siblings", nisn, siblings: [{name, level}], siblingsCount? }
*/
export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  // === Cabang khusus Non-PTK: simpan saudara via server ===
  if (body?.action === "save_siblings") {
    const errs = validatePayloadSiblings(body);
    if (errs.length) return bad(errs.join(" "));

    const userDoc = await mustUserExists(body.nisn);
    if (!userDoc) return bad("users_app tidak ditemukan.", 404);
    
    // Normalisasi & bersihkan
    const cleaned = (body.siblings || [])
      .map((s) => ({
        name:  String((s?.name  ?? s?.nama)   || "").trim(),
        level: String((s?.level ?? s?.jenjang) || "").trim(),
        class: String((s?.class ?? s?.kelas)   || "").trim(),
      }))
      .filter((s) => s.name || s.level || s.class); // buang baris kosong

    const count = Number.isFinite(+body?.siblingsCount)
      ? Math.max(0, +body.siblingsCount)
      : cleaned.length;

    // Back-compat: isi field tunggal dari entri pertama
    const first = cleaned[0] || { name: "", level: "", class: "" };

    await adminDb.doc(`users_app/${body.nisn}`).set(
      {
        siblings: cleaned,                 // array baru (dengan class)
        siblingsCount: count,              // angka
        jumlahSaudara: count,              // fallback angka
        saudaraNama: first.name || "",     // legacy
        saudaraJenjang: first.level || "", // legacy
        saudaraKelas: first.class || "",   // legacy kelas (opsional, untuk prefill lama)
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );


    return ok({ ok: true, saved: "siblings" });
  }

  // === Default: alur lama konfirmasi PTK (tanpa NIK) ===
  const errs = validatePayloadPTK(body);
  if (errs.length) return bad(errs.join(" "));

  const userDoc = await mustUserExists(body.nisn);
  if (!userDoc) return bad("users_app tidak ditemukan.", 404);

  // Normalisasi data saudara (opsional) untuk catatan di ptk_confirmation
  const siblings = Array.isArray(body.siblings)
    ? body.siblings.map((s) => ({
        name:   String(s?.name || "").trim(),
        jenjang:String(s?.jenjang || ""),
        class:  String(s?.class || ""),
      }))
    : [];

  const first =
    siblings[0] || {
      name:   String(body.siblingName || "").trim(),
      jenjang:String(body.siblingJenjang || ""),
      class:  String(body.siblingClass || ""),
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

  return ok({ ok: true, saved: "ptk_confirmation" });
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
