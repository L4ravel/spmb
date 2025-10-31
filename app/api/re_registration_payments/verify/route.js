// app/api/re_registration/payments/verify/route.js
import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

/** (Opsional) pakai admin key jika ingin tambahan proteksi */
function checkAdminKey(req) {
  const required = process.env.PPDB_ADMIN_KEY;
  if (!required) return true;
  const got = req.headers.get("x-ppdb-admin-key") || "";
  return got === required;
}

export async function POST(req) {
  try {
    // Samakan origin check dengan route upload-mu (kalau dipakai)
    const allowed = process.env.NEXT_PUBLIC_APP_ORIGIN;
    const origin = req.headers.get("origin") || "";
    if (allowed && origin && origin !== allowed) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    if (!checkAdminKey(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nisn, paymentId, action, reason } = await req.json();

    const id = String(nisn || "").trim();
    const pid = String(paymentId || "").trim();
    const act = String(action || "").toLowerCase().trim();

    if (!id || !pid) {
      return NextResponse.json({ error: "nisn/paymentId wajib diisi" }, { status: 400 });
    }
    if (!["approve", "reject"].includes(act)) {
      return NextResponse.json({ error: "action harus 'approve' atau 'reject'" }, { status: 400 });
    }

    const db = getAdminDb();
    // ⚠️ Rujuk path yang kamu pakai: users_app/{nisn}/payments/{docId}
    const payRef = db.collection("users_app").doc(id).collection("payments").doc(pid);
    const snap = await payRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Dokumen pembayaran tidak ditemukan." }, { status: 404 });
    }

    const now = FieldValue.serverTimestamp();
    const base = { updatedAt: now, reviewedAt: now, reviewer: "admin" };

    const update =
      act === "approve"
        ? { ...base, verified: true, status: "APPROVED", rejectedReason: FieldValue.delete() }
        : {
            ...base,
            verified: false,
            status: "REJECTED",
            rejectedReason: String(reason || "Ditolak oleh admin"),
          };

    await payRef.set(update, { merge: true });

    // (opsional) log kecil
    await payRef.collection("_audit").add({
      action: act,
      reason: reason || null,
      at: now,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "ERR" }, { status: 500 });
  }
}
