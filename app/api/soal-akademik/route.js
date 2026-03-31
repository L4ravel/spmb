// /app/api/soal-akademik/route.js
export const runtime = "nodejs"; // penting: admin sdk & crypto butuh Node

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import crypto from "crypto";

const COL = "soal_akademik";

function validate(body) {
  const errors = [];
  if (!body || typeof body !== "object") errors.push("Body tidak valid.");
  if (!body.paketId) errors.push("paketId wajib.");
  if (!body.pertanyaan || String(body.pertanyaan).trim().length < 6) errors.push("pertanyaan terlalu pendek.");
  if (!Array.isArray(body.opsi) || body.opsi.length < 2) errors.push("opsi minimal 2.");
  if (typeof body.jawabanIndex !== "number" || body.jawabanIndex < 0 || body.jawabanIndex >= body.opsi.length) errors.push("jawabanIndex tidak valid.");
  if (body.bobot != null && Number(body.bobot) <= 0) errors.push("bobot harus > 0.");
  return errors;
}

function computeId({ paketId, pertanyaan, opsi }) {
  const h = crypto.createHash("sha256").update(`${paketId}|${pertanyaan}|${(opsi || []).join("|")}`).digest("hex");
  return h.slice(0, 20);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const errors = validate(body);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

    const db = getAdminDb();
    const id = body.id || computeId(body);
    const docRef = db.collection(COL).doc(id);
    const snap = await docRef.get();
    const now = new Date();

    await docRef.set(
      {
        paketId: String(body.paketId),
        mapel: String(body.mapel || "Umum"),
        tingkat: String(body.tingkat || "Umum"),
        pertanyaan: String(body.pertanyaan),
        opsi: body.opsi.map(String),
        jawabanIndex: Number(body.jawabanIndex),
        bobot: Number(body.bobot || 1),
        aktif: Boolean(body.aktif ?? true),
        updatedAt: now,
        ...(snap.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan soal." }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const paketId = (searchParams.get("paketId") || "").trim();
    const limit = Number(searchParams.get("limit") || 50);
    const db = getAdminDb();

    let snap;
    if (paketId) {
      // HINDARI composite index: where saja, tanpa orderBy
      snap = await db.collection(COL).where("paketId", "==", paketId).limit(limit).get();
    } else {
      snap = await db.collection(COL).orderBy("createdAt", "desc").limit(limit).get();
    }

    // urutkan manual (desc) pakai updatedAt || createdAt
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = (a.updatedAt || a.createdAt || 0);
        const tb = (b.updatedAt || b.createdAt || 0);
        return (tb?.seconds || +new Date(tb)) - (ta?.seconds || +new Date(ta));
      });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /soal-akademik error:", e);
    return NextResponse.json({ error: "Gagal mengambil soal." }, { status: 500 });
  }
}