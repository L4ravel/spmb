// app/api/public/cek-daftar-ulang/route.js
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getValue(obj, key) {
  if (!obj || typeof obj !== "object") return "";
  return obj[key];
}

function normalizeStatus(data) {
  try {
    let raw = "";

    if (data && data.status) {
      raw = data.status;
    } else if (data && data.paymentStatus) {
      raw = data.paymentStatus;
    } else if (data && data.reviewStatus) {
      raw = data.reviewStatus;
    } else if (data && data.verified) {
      raw = "VERIFIED";
    } else if (data && data.approved) {
      raw = "APPROVED";
    }

    const s = String(raw || "").trim().toUpperCase();

    if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s)) {
      return "approved";
    }

    if (["REJECTED", "DENIED", "DECLINED"].includes(s)) {
      return "rejected";
    }

    return "pending";
  } catch (error) {
    return "pending";
  }
}

function isPpsJenjang(jenjang) {
  const j = String(jenjang || "").toLowerCase();

  return (
    j.includes("pps ula putra") ||
    j.includes("pps ula putri") ||
    j.includes("pps wustho") ||
    j.includes("pps ulya")
  );
}

function getStudentLevel(data) {
  return normalizeText(
    getValue(data, "registrationLevel") ||
      getValue(data, "jenjangDiterima") ||
      getValue(data, "jenjang") ||
      ""
  );
}

function getStudentName(data, fallback) {
  return normalizeText(
    getValue(data, "fullName") ||
      getValue(data, "nama") ||
      getValue(data, "name") ||
      getValue(data, "studentName") ||
      fallback
  );
}

async function getLevels() {
  const snap = await adminDb.collection("re_registration_fees").get();
  const levels = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const label = normalizeText(data.label || data.key || doc.id);

    if (label) {
      levels.push(label);
    }
  });

  levels.sort((a, b) => a.localeCompare(b, "id"));

  return levels;
}

async function getFeesByLabel() {
  const snap = await adminDb.collection("re_registration_fees").get();
  const feesByLabel = {};

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const label = normalizeText(data.label || data.key || doc.id);

    if (!label) return;

    feesByLabel[label] = {
      spp: toNumber(data.spp),
      uangPangkal:
        data.uangPangkal && typeof data.uangPangkal === "object"
          ? data.uangPangkal
          : {},
    };
  });

  return feesByLabel;
}

async function getDiscount(nisn) {
  const result = {
    discPTK: 0,
    discNonPTK: 0,
  };

  const baseRef = adminDb
    .collection("users_app")
    .doc(nisn)
    .collection("re_registration");

  const ptkDoc = await baseRef.doc("ptk_discount").get();
  const nonPtkDoc = await baseRef.doc("nonptk_discount").get();

  if (ptkDoc.exists) {
    const data = ptkDoc.data() || {};
    result.discPTK = toNumber(data.amount);
  }

  if (nonPtkDoc.exists) {
    const data = nonPtkDoc.data() || {};
    result.discNonPTK = toNumber(data.amount);
  }

  return result;
}

async function getPaymentAgg(nisn) {
  const snap = await adminDb
    .collection("users_app")
    .doc(nisn)
    .collection("payments")
    .get();

  let totalApproved = 0;
  let buktiCount = 0;

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const amount = toNumber(data.amount);

    if (amount <= 0) return;

    buktiCount += 1;

    if (normalizeStatus(data) === "approved") {
      totalApproved += amount;
    }
  });

  return {
    totalPaid: totalApproved,
    buktiCount,
  };
}

async function getPpdbData(nisn) {
  const doc = await adminDb.collection("ppdb").doc(nisn).get();

  if (!doc.exists) return {};

  return doc.data() || {};
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const mode = normalizeText(searchParams.get("mode"));
    const jenjang = normalizeText(searchParams.get("jenjang"));
    const keyword = normalizeSearch(searchParams.get("q"));

    if (mode === "levels") {
      const levels = await getLevels();

      return NextResponse.json({
        ok: true,
        levels,
      });
    }

    if (!jenjang) {
      return NextResponse.json(
        {
          ok: false,
          message: "Jenjang wajib dipilih.",
        },
        { status: 400 }
      );
    }

    if (!keyword || keyword.length < 3) {
      return NextResponse.json(
        {
          ok: false,
          message: "Kata pencarian minimal 3 karakter.",
        },
        { status: 400 }
      );
    }

    const feesByLabel = await getFeesByLabel();

    const finalSnap = await adminDb
      .collection("users_app")
      .where("finalDecision", "==", "LULUS")
      .get();

    const candidates = [];

    finalSnap.forEach((doc) => {
      const data = doc.data() || {};
      const nisn = normalizeText(data.nisn || doc.id);
      const level = getStudentLevel(data);
      const name = getStudentName(data, nisn);
      const searchable = String(nisn + " " + name + " " + level).toLowerCase();

      if (!nisn) return;
      if (level !== jenjang) return;
      if (!searchable.includes(keyword)) return;

      candidates.push({
        nisn,
        name,
        level,
      });
    });

    const limitedCandidates = candidates
      .sort((a, b) => a.name.localeCompare(b.name, "id"))
      .slice(0, 10);

    const results = [];

    for (const student of limitedCandidates) {
      const fee = feesByLabel[student.level] || null;
      const baseSPP = toNumber(fee && fee.spp);

      let totalPangkal = 0;

      if (fee && fee.uangPangkal && typeof fee.uangPangkal === "object") {
        Object.values(fee.uangPangkal).forEach((value) => {
          totalPangkal += toNumber(value);
        });
      }

      const totalAwal = baseSPP + totalPangkal;

      const discount = await getDiscount(student.nisn);
      const paymentAgg = await getPaymentAgg(student.nisn);
      const ppdbData = await getPpdbData(student.nisn);

      const discPTK = toNumber(discount.discPTK);
      const discNonPTK = toNumber(discount.discNonPTK);
      const totalDisc = discPTK + discNonPTK;

      const ayahIncomeRaw = normalizeText(ppdbData.ayahIncome);

      let netTagihan = Math.max(0, totalAwal - totalDisc);

      if (isPpsJenjang(student.level) && !ayahIncomeRaw) {
        netTagihan = 0;
      }

      const totalPaid = toNumber(paymentAgg.totalPaid);
      const sisa = Math.max(0, netTagihan - totalPaid);

      let status = "BELUM BAYAR";

      if (netTagihan === 0) {
        status = "LUNAS";
      } else if (totalPaid <= 0) {
        status = "BELUM BAYAR";
      } else if (totalPaid < netTagihan) {
        status = "SEBAGIAN";
      } else {
        status = "LUNAS";
      }

      results.push({
        nisn: student.nisn,
        nama: student.name,
        jenjang: student.level,
        status,
        tagihanAwal: totalAwal,
        potongan: totalDisc,
        tagihanNet: netTagihan,
        terbayar: totalPaid,
        sisa,
        buktiCount: paymentAgg.buktiCount || 0,
      });
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error && error.message
            ? error.message
            : "Gagal mengecek status daftar ulang.",
      },
      { status: 500 }
    );
  }
}