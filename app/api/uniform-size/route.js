import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Ambil NISN dari cookie ppdb_session (base64 JSON: { id })
function getNisnFromCookie(req) {
  const v = req.cookies.get?.("ppdb_session")?.value;
  if (!v) return null;
  try {
    const obj = JSON.parse(Buffer.from(decodeURIComponent(v), "base64").toString("utf8"));
    return obj?.id || null;
  } catch {
    return null;
  }
}

// Builder compat untuk topSize/bottomSize bila klien kirim skema baru
function buildCompatStrings({ registrationLevel, gamisSize, panjangBaju, panjangLengan, lingkarDada, lebarBahu, panjangCelana, lingkarPinggang, pCornes }) {
  const isPutra = /SMP Putra|SMA Putra/i.test(registrationLevel || "");
  const isPutri = /SMP Putri|SMA Putri/i.test(registrationLevel || "");

  if (isPutri && gamisSize) {
    return { topSize: `Gamis ${gamisSize}`, bottomSize: "" };
  }
  if (isPutra) {
    const all =
      [panjangBaju, panjangLengan, lingkarDada, lebarBahu, panjangCelana, lingkarPinggang, pCornes]
        .every((v) => v !== undefined && v !== null && String(v) !== "" && Number(v) > 0);
    if (all) {
      const top = `PB:${panjangBaju} PL:${panjangLengan} LD:${lingkarDada} LB:${lebarBahu}`;
      const bottom = `PC:${panjangCelana} LP:${lingkarPinggang} PCor:${pCornes}`;
      return { topSize: top, bottomSize: bottom };
    }
  }
  return { topSize: "", bottomSize: "" };
}

export async function GET(req) {
  try {
    const nisn = getNisnFromCookie(req);
    if (!nisn) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const db = getAdminDb();
    const snap = await db.collection("uniform_sizes").doc(nisn).get();
    return NextResponse.json({ data: snap.exists ? snap.data() : null });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "ERR" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const nisn = getNisnFromCookie(req);
    if (!nisn) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const body = await req.json();

    // Ambil data user (untuk mengetahui registrationLevel)
    const db = getAdminDb();
    const u = await db.collection("users_app").doc(nisn).get();
    const registrationLevel = u.exists ? (u.get("registrationLevel") || body.registrationLevel || "") : (body.registrationLevel || "");

    // Ekstrak field baru & lama
    const {
      // lama
      topSize: topSizeIn, bottomSize: bottomSizeIn, notes = "",
      // baru
      gamisSize,
      panjangBaju, panjangLengan, lingkarDada, lebarBahu,
      panjangCelana, lingkarPinggang, pCornes,
    } = body || {};

    // Bangun compat jika tidak diberikan
    const compat = buildCompatStrings({
      registrationLevel, gamisSize,
      panjangBaju, panjangLengan, lingkarDada, lebarBahu,
      panjangCelana, lingkarPinggang, pCornes
    });

    const topSize = (topSizeIn ?? compat.topSize ?? "").toString();
    const bottomSize = (bottomSizeIn ?? compat.bottomSize ?? "").toString();

    // Validasi baru: Putra = wajib 7 angka; Putri = wajib gamisSize
    const isPutra = /SMP Putra|SMA Putra/i.test(registrationLevel || "");
    const isPutri = /SMP Putri|SMA Putri/i.test(registrationLevel || "");

    let valid = false;
    if (isPutra) {
      valid = [panjangBaju, panjangLengan, lingkarDada, lebarBahu, panjangCelana, lingkarPinggang, pCornes]
        .every((v) => v !== undefined && v !== null && String(v) !== "" && Number(v) > 0);
      if (!valid) {
        return NextResponse.json({ error: "Lengkapi semua ukuran (cm) untuk Putra. Semua kolom wajib berisi angka > 0." }, { status: 400 });
      }
    } else if (isPutri) {
      valid = !!(gamisSize || "").trim();
      if (!valid) {
        return NextResponse.json({ error: "Pilih salah satu ukuran gamis (S/M/L/XL)." }, { status: 400 });
      }
    } else {
      // Selain SMP/SMA: untuk kompatibilitas lama, izinkan isi top/bottom saja (jika ada)
      valid = !!(topSize || bottomSize);
      if (!valid) {
        return NextResponse.json({ error: "Isi minimal satu ukuran" }, { status: 400 });
      }
    }

    // Tulis ukuran baju (simpan keduanya: detail baru + legacy)
    await db.collection("uniform_sizes").doc(nisn).set(
      {
        nisn,
        registrationLevel,
        // legacy
        topSize, bottomSize, notes: String(notes || ""),
        // detail baru
        gamisSize: gamisSize || "",
        panjangBaju: String(panjangBaju || ""),
        panjangLengan: String(panjangLengan || ""),
        lingkarDada: String(lingkarDada || ""),
        lebarBahu: String(lebarBahu || ""),
        panjangCelana: String(panjangCelana || ""),
        lingkarPinggang: String(lingkarPinggang || ""),
        pCornes: String(pCornes || ""),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "ERR" }, { status: 500 });
  }
}
