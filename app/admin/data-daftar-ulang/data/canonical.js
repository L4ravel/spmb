import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from "firebase/firestore";

function text(value) {
  return String(value || "").trim();
}

function normalizePaymentStatus(payment) {
  const raw = String(
    payment?.status ??
    payment?.paymentStatus ??
    payment?.reviewStatus ??
    (payment?.verified ? "VERIFIED" : "") ??
    (payment?.approved ? "APPROVED" : "") ??
    ""
  ).trim().toUpperCase();

  if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(raw)) return "approved";
  if (["REJECTED", "DENIED", "DECLINED"].includes(raw)) return "rejected";
  return "pending";
}

function isPpsLevel(level) {
  const value = text(level).toLowerCase();
  return (
    value.includes("pps ula putra") ||
    value.includes("pps ula putri") ||
    value.includes("pps wustho") ||
    value.includes("pps ulya")
  );
}

function feeTotal(fee) {
  const spp = Number(fee?.spp || 0) || 0;
  const components = fee?.uangPangkal && typeof fee.uangPangkal === "object"
    ? Object.values(fee.uangPangkal)
    : [];
  return spp + components.reduce((sum, value) => sum + (Number(value || 0) || 0), 0);
}

/**
 * Dataset kanonis daftar ulang.
 * Rumus dan ruang lingkupnya mengikuti /admin/data-daftar-ulang:
 * - peserta: users_app.finalDecision == LULUS
 * - tagihan: biaya resmi - diskon PTK/non-PTK
 * - PPS tanpa data penghasilan ayah: tagihan 0
 * - pembayaran: hanya dokumen payments berstatus approved
 */
export async function loadCanonicalDaftarUlang(db) {
  const [finalSnap, feesSnap, ppdbSnap, discountsSnap, paymentsSnap] = await Promise.all([
    getDocs(query(collection(db, "users_app"), where("finalDecision", "==", "LULUS"))),
    getDocs(collection(db, "re_registration_fees")),
    getDocs(collection(db, "ppdb")),
    getDocs(collectionGroup(db, "re_registration")),
    getDocs(collectionGroup(db, "payments")),
  ]);

  const feesByLabel = new Map();
  feesSnap.forEach((feeDoc) => {
    const data = feeDoc.data() || {};
    const label = text(data.label || data.key);
    if (label) feesByLabel.set(label, data);
  });

  const ppdbByNisn = new Map();
  ppdbSnap.forEach((ppdbDoc) => ppdbByNisn.set(ppdbDoc.id, ppdbDoc.data() || {}));

  const discountsByNisn = new Map();
  discountsSnap.forEach((discountDoc) => {
    if (discountDoc.id !== "ptk_discount" && discountDoc.id !== "nonptk_discount") return;
    const nisn = discountDoc.ref.parent?.parent?.id || "";
    const amount = Number(discountDoc.data()?.amount || 0);
    if (!nisn || !Number.isFinite(amount) || amount <= 0) return;
    const current = discountsByNisn.get(nisn) || { ptk: 0, nonptk: 0 };
    if (discountDoc.id === "ptk_discount") current.ptk += amount;
    else current.nonptk += amount;
    discountsByNisn.set(nisn, current);
  });

  const paymentsByNisn = new Map();
  const approvedPaymentDocs = [];
  paymentsSnap.forEach((paymentDoc) => {
    const data = paymentDoc.data() || {};
    const nisn = paymentDoc.ref.parent?.parent?.id || "";
    const amount = Number(data.amount || 0);
    if (!nisn || !Number.isFinite(amount) || amount <= 0) return;

    const current = paymentsByNisn.get(nisn) || { totalApproved: 0, count: 0 };
    current.count += 1;
    if (normalizePaymentStatus(data) === "approved") {
      current.totalApproved += amount;
      approvedPaymentDocs.push({
        ...data,
        id: `${nisn}/${paymentDoc.id}`,
        paymentId: paymentDoc.id,
        nisn,
        amount,
      });
    }
    paymentsByNisn.set(nisn, current);
  });

  const rows = finalSnap.docs.map((userDoc) => {
    const user = userDoc.data() || {};
    const nisn = text(user.nisn || userDoc.id);
    const level = text(user.registrationLevel || user.jenjangDiterima || user.jenjang);
    const name = text(user.fullName || user.nama || user.name || user.studentName) || nisn;
    const discounts = discountsByNisn.get(nisn) || { ptk: 0, nonptk: 0 };
    const discPTK = Number(discounts.ptk || 0);
    const discNonPTK = Number(discounts.nonptk || 0);
    const totalDisc = discPTK + discNonPTK;
    const totalAwal = feeTotal(feesByLabel.get(level));
    const ppdb = ppdbByNisn.get(nisn) || {};

    let netTagihan = Math.max(0, totalAwal - totalDisc);
    if (isPpsLevel(level) && !text(ppdb.ayahIncome)) netTagihan = 0;

    const payment = paymentsByNisn.get(nisn) || { totalApproved: 0, count: 0 };
    const totalPaid = Number(payment.totalApproved || 0);
    const sisa = Math.max(0, netTagihan - totalPaid);
    const jalur = discPTK > 0
      ? "PTK"
      : discNonPTK > 0
      ? "NON_PTK"
      : user.isPTK
      ? "PTK"
      : user.isNonPTK
      ? "NON_PTK"
      : "";

    return {
      nisn,
      name,
      level,
      jalur,
      totalAwal,
      discPTK,
      discNonPTK,
      totalDisc,
      netTagihan,
      totalPaid,
      sisa,
      buktiCount: payment.count,
      statusDaftarUlang: netTagihan === 0 || totalPaid >= netTagihan
        ? "LUNAS"
        : totalPaid > 0
        ? "SEBAGIAN"
        : "BELUM BAYAR",
    };
  });

  const userByNisn = new Map(rows.map((row) => [row.nisn, row]));
  const payments = approvedPaymentDocs
    .filter((payment) => userByNisn.has(payment.nisn))
    .map((payment) => {
      const user = userByNisn.get(payment.nisn);
      return {
        ...payment,
        userFullName: user.name,
        userRegistrationLevel: user.level,
      };
    });

  const stats = rows.reduce((summary, row) => ({
    totalParticipants: summary.totalParticipants + 1,
    totalTagihanNet: summary.totalTagihanNet + row.netTagihan,
    totalPaid: summary.totalPaid + row.totalPaid,
    totalSisa: summary.totalSisa + row.sisa,
    totalDiscountPTK: summary.totalDiscountPTK + row.discPTK,
    totalDiscountNonPTK: summary.totalDiscountNonPTK + row.discNonPTK,
  }), {
    totalParticipants: 0,
    totalTagihanNet: 0,
    totalPaid: 0,
    totalSisa: 0,
    totalDiscountPTK: 0,
    totalDiscountNonPTK: 0,
  });

  return { rows, payments, stats };
}
