import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";

function toSafeUpperSnake(value) {
  return String(value || "LAINNYA")
    .trim()
    .toUpperCase()
    .replace(/[^\w-]/g, "_");
}

function toQuota(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

export async function GET() {
  try {
    const snapshot = await adminDb.collection("quotas").get();
    const items = snapshot.docs.map((document) => ({
      key: document.id,
      ...document.data(),
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memuat kuota peserta." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const label = String(body?.label || "").trim();

    if (!label) {
      return NextResponse.json(
        { success: false, error: "Jenjang wajib diisi." },
        { status: 400 }
      );
    }

    const key = toSafeUpperSnake(label);
    const item = {
      key,
      label,
      limit: toQuota(body?.limit),
      open: body?.open !== false,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("quotas").doc(key).set(item, { merge: true });

    return NextResponse.json({ success: true, item: { ...item, updatedAt: null } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal menyimpan kuota peserta." },
      { status: 500 }
    );
  }
}
