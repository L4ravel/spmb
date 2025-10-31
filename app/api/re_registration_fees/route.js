import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function toSafeUpperSnake(s) {
  return (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");
}
function n(x) {
  const v = Number(x);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

/** GET: list semua biaya daftar ulang */
export async function GET() {
  try {
    const snap = await adminDb.collection("re_registration_fees").get();
    const items = snap.docs
      .map((d) => ({ key: d.id, ...d.data() }))
      .sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key), "id"));
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || "Gagal mengambil data." },
      { status: 500 }
    );
  }
}

/** POST: upsert { jenjangLabel, spp, uangPangkal:{pakaian,sarpras,kasur,kitab,bp3} } */
export async function POST(req) {
  try {
    const body = await req.json();
    const label = String(body?.jenjangLabel || "").trim();
    if (!label) {
      return NextResponse.json({ success: false, error: "jenjangLabel wajib diisi." }, { status: 400 });
    }

    const spp = n(body?.spp);
    const up = body?.uangPangkal || {};
    const doc = {
      key: toSafeUpperSnake(label),
      label,
      currency: "IDR",
      spp: n(spp),
      uangPangkal: {
        pakaian: n(up.pakaian),
        sarpras: n(up.sarpras),
        kasur: n(up.kasur),
        kitab: n(up.kitab),
        bp3: n(up.bp3),
      },
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("re_registration_fees").doc(doc.key).set(doc, { merge: true });

    return NextResponse.json({ success: true, key: doc.key });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || "Gagal menyimpan data." },
      { status: 500 }
    );
  }
}
