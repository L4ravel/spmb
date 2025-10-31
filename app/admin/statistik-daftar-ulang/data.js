// app/admin/statistik-daftar-ulang/data.js
import {
  collection, collectionGroup, doc, getDoc, getDocs,
  limit, orderBy, query, startAfter, where,
} from "firebase/firestore";

/* ---------- Konstanta umum ---------- */
export const defaultSinceDays = 30;

/* ---------- Formatters ---------- */
export function fmtIDR(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}
export function fmtIDRShort(n = 0) {
  const v = Number(n) || 0;
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  if (v >= 1_000) return `Rp ${Math.round(v / 1_000)} rb`;
  return fmtIDR(v);
}

/* ---------- Helpers selaras PTK/Non-PTK ---------- */
function normalizeStatus(pLike) {
  try {
    const raw =
      (pLike?.status ??
        pLike?.paymentStatus ??
        pLike?.reviewStatus ??
        (pLike?.verified ? "VERIFIED" : "") ??
        (pLike?.approved ? "APPROVED" : "") ??
        "") + "";
    const s = raw.trim().toUpperCase();
    if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s)) return "approved";
    if (["REJECTED", "DENIED", "DECLINED"].includes(s)) return "rejected";
    return "pending";
  } catch { return "pending"; }
}

export async function jenjangListFromFees(db) {
  const labels = new Set();
  try {
    const snap = await getDocs(collection(db, "re_registration_fees"));
    snap.forEach(d => {
      const lbl = (d.data()?.label || "").toString().trim();
      if (lbl) labels.add(lbl);
    });
  } catch {}
  return Array.from(labels).sort();
}

const feeCache = new Map();
async function getFeeBreakdownByLabel(db, label) {
  if (!label) return { spp: 0, uangPangkalTotal: 0, total: 0 };
  if (feeCache.has(label)) return feeCache.get(label);
  let spp = 0, uangPangkalTotal = 0;
  try {
    const qref = query(collection(db, "re_registration_fees"), where("label", "==", label), limit(1));
    const snap = await getDocs(qref);
    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      spp = Number(data?.spp ?? 0);
      const up = data?.uangPangkal;
      if (typeof up === "number") uangPangkalTotal = Number(up) || 0;
      else if (up && typeof up === "object") uangPangkalTotal = Object.values(up).reduce((a, v) => a + (Number(v)||0), 0);
    }
  } catch {}
  const out = { spp, uangPangkalTotal, total: (Number(spp)||0) + (Number(uangPangkalTotal)||0) };
  feeCache.set(label, out);
  return out;
}

async function getPTKDiscount(db, nisn) {
  try {
    const dsnap = await getDoc(doc(db, "users_app", nisn, "re_registration", "ptk_discount"));
    if (!dsnap.exists()) return { amount: 0, sourceKey: "", type: "", note: "" };
    const x = dsnap.data() || {};
    return {
      amount: Number(x.amount ?? 0) || 0,
      sourceKey: (x.sourceKey || "").toString(),
      type: (x.type || "").toString(),
      note: (x.note || "").toString(),
    };
  } catch { return { amount: 0, sourceKey: "", type: "", note: "" }; }
}

async function getApprovedSumAndPending(db, nisn) {
  try {
    const snap = await getDocs(query(
      collection(db, "users_app", nisn, "payments"),
      orderBy("createdAt", "desc"), limit(500)
    ));
    let sum = 0, hasPending = false;
    for (const d of snap.docs) {
      const x = d.data() || {};
      const st = normalizeStatus(x);
      if (st === "approved") {
        const amt = Number(x.amount ?? x.nominal ?? x.jumlah ?? 0);
        if (Number.isFinite(amt)) sum += amt;
      } else if (st === "pending") hasPending = true;
    }
    return { sumApproved: sum, hasPending };
  } catch { return { sumApproved: 0, hasPending: false }; }
}

async function isPTKApproved(db, nisn) {
  try {
    const ptkDoc = await getDoc(doc(db, "users_app", nisn, "ptk_confirmation", "current"));
    if (!ptkDoc.exists()) return false;
    return normalizeStatus({ status: ptkDoc.data()?.status }) === "approved";
  } catch { return false; }
}

/* ---------- Tren per tanggal (payments APPROVED) ---------- */
async function buildTrendFromPayments(db, { sinceDays = defaultSinceDays } = {}) {
  const bag = []; let cursor = null;
  const wantDays = Math.max(1, Number(sinceDays) || defaultSinceDays);
  for (let i = 0; i < 8; i++) {
    let qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), limit(500));
    if (cursor) qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), startAfter(cursor), limit(500));
    const snap = await getDocs(qref);
    if (snap.empty) break;
    bag.push(...snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (bag.length >= wantDays * 80) break;
  }
  const byDate = new Map();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - wantDays + 1);
  for (const d of bag) {
    const x = d.data() || {};
    if (normalizeStatus(x) !== "approved") continue;
    const createdAt = x.createdAt?.toDate?.() ?? (x.createdAt ? new Date(x.createdAt) : null);
    if (!createdAt || Number.isNaN(+createdAt) || createdAt < cutoff) continue;
    const iso = createdAt.toISOString().slice(0,10);
    const amt = Number(x.amount ?? x.nominal ?? x.jumlah ?? 0);
    if (!Number.isFinite(amt)) continue;
    byDate.set(iso, (byDate.get(iso) || 0) + amt);
  }
  const out = [];
  const today = new Date();
  for (let i = wantDays - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    out.push({ date: key, amount: byDate.get(key) || 0 });
  }
  return out;
}

/* ---------- Rekap per jenjang: split PTK / Non-PTK + Total ---------- */
async function buildByJenjangSplit(db) {
  // PTK (PENDING/APPROVED)
  const ptkNisn = new Set();
  {
    let cursor = null;
    for (let i = 0; i < 4; i++) {
      let qref = query(collectionGroup(db, "ptk_confirmation"),
        where("status", "in", ["PENDING", "APPROVED"]),
        orderBy("updatedAt", "desc"), limit(500));
      if (cursor) qref = query(collectionGroup(db, "ptk_confirmation"),
        where("status", "in", ["PENDING", "APPROVED"]),
        orderBy("updatedAt", "desc"), startAfter(cursor), limit(500));
      const snap = await getDocs(qref);
      if (snap.empty) break;
      snap.docs.forEach(d => {
        const nisn = d.ref.parent.parent?.id || "";
        if (nisn) ptkNisn.add(nisn);
      });
      cursor = snap.docs[snap.docs.length - 1];
    }
  }

  // Kandidat Non-PTK dari payments, lalu exclude PTK APPROVED
  const nonPtkCandidates = new Map();
  {
    let cursor = null;
    for (let i = 0; i < 6; i++) {
      let qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), limit(800));
      if (cursor) qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), startAfter(cursor), limit(800));
      const snap = await getDocs(qref);
      if (snap.empty) break;
      snap.docs.forEach(d => {
        const nisn = d.ref.parent.parent?.id || "";
        if (!nisn) return;
        if (!nonPtkCandidates.has(nisn)) {
          const ct = d.data()?.createdAt?.toMillis?.() ?? d.data()?.createdAt ?? 0;
          nonPtkCandidates.set(nisn, ct || 0);
        }
      });
      cursor = snap.docs[snap.docs.length - 1];
    }
  }

  // Susun daftar (group tag)
  const nisnList = [];
  for (const n of ptkNisn) nisnList.push({ nisn: n, group: "PTK" });
  for (const [n] of nonPtkCandidates) {
    const ok = !(await isPTKApproved(db, n)); // exclude PTK APPROVED
    if (ok) nisnList.push({ nisn: n, group: "NONPTK" });
  }

  // 3 agregator: total, ptk saja, nonptk saja
  const makeAgg = () => new Map(); // jenjang -> {pendapatan,tunggakan,lunas,nunggak,buktiPending}
  const aggTotal = makeAgg(), aggPTK = makeAgg(), aggNon = makeAgg();
  const sum = () => ({ pendapatan: 0, tunggakan: 0, lunas: 0, nunggak: 0, buktiPending: 0 });

  for (const { nisn, group } of nisnList) {
    // profil
    let u = {};
    try { const uDoc = await getDoc(doc(db, "users_app", nisn)); if (uDoc.exists()) u = uDoc.data() || {}; } catch {}
    const level = u?.registrationLevel || "-";

    // biaya + diskon
    const { spp, uangPangkalTotal, total } = await getFeeBreakdownByLabel(db, level);
    let effectiveTotal = total;
    if (group === "PTK") {
      const disc = await getPTKDiscount(db, nisn);
      if ((disc.amount || 0) > 0) {
        if (String(disc.sourceKey || "").toLowerCase() === "spp") {
          const sppAfter = Math.max((Number(spp) || 0) - disc.amount, 0);
          effectiveTotal = sppAfter + (Number(uangPangkalTotal) || 0);
        } else {
          effectiveTotal = Math.max(total - disc.amount, 0);
        }
      }
    }

    // pembayaran
    const { sumApproved, hasPending } = await getApprovedSumAndPending(db, nisn);

    // turunan
    const tunggakan = Math.max((Number(effectiveTotal)||0) - (Number(sumApproved)||0), 0);
    const isLunas = (Number(effectiveTotal)||0) > 0 && tunggakan === 0;

    // fungsi simpan ke map
    const bump = (map) => {
      const cur = map.get(level) || sum();
      cur.pendapatan += Number(sumApproved) || 0;
      cur.tunggakan += Number(tunggakan) || 0;
      cur.lunas += isLunas ? 1 : 0;
      cur.nunggak += tunggakan > 0 ? 1 : 0;
      cur.buktiPending += hasPending ? 1 : 0;
      map.set(level, cur);
    };

    bump(aggTotal);
    if (group === "PTK") bump(aggPTK);
    else bump(aggNon);
  }

  const toRows = (map) =>
    Array.from(map.entries())
      .sort((a,b) => String(a[0]).localeCompare(String(b[0])))
      .map(([jenjang, v]) => ({ jenjang, ...v }));

  const rowsTotal = toRows(aggTotal);
  const rowsPTK   = toRows(aggPTK);
  const rowsNon   = toRows(aggNon);

  const sumRows = (rows) => rows.reduce((acc, r) => ({
    pendapatan: acc.pendapatan + (r.pendapatan||0),
    tunggakan:  acc.tunggakan  + (r.tunggakan ||0),
    lunas:      acc.lunas      + (r.lunas     ||0),
    nunggak:    acc.nunggak    + (r.nunggak   ||0),
    buktiPending: acc.buktiPending + (r.buktiPending||0),
  }), {pendapatan:0,tunggakan:0,lunas:0,nunggak:0,buktiPending:0});

  const pushTotal = (rows) => {
    const t = sumRows(rows);
    rows.push({ jenjang: "TOTAL", ...t });
    return rows;
  };

  return {
    byJenjang:        pushTotal(rowsTotal),
    byJenjangPTK:     pushTotal(rowsPTK),
    byJenjangNonPTK:  pushTotal(rowsNon),
  };
}

/* ---------- Hitung jumlah dokumen payment APPROVED di rentang ---------- */
async function countApprovedPaymentsInRange(db, { sinceDays = defaultSinceDays } = {}) {
  const bag = []; let cursor = null;
  const wantDays = Math.max(1, Number(sinceDays) || defaultSinceDays);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - wantDays + 1);
  for (let i = 0; i < 8; i++) {
    let qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), limit(500));
    if (cursor) qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), startAfter(cursor), limit(500));
    const snap = await getDocs(qref);
    if (snap.empty) break;
    bag.push(...snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (bag.length >= wantDays * 80) break;
  }
  let approved = 0;
  for (const d of bag) {
    const x = d.data() || {};
    const st = normalizeStatus(x);
    const createdAt = x.createdAt?.toDate?.() ?? (x.createdAt ? new Date(x.createdAt) : null);
    if (st !== "approved" || !createdAt || Number.isNaN(+createdAt)) continue;
    if (createdAt >= cutoff) approved++;
  }
  return approved;
}

/* ---------- API utama ---------- */
export async function fetchStatistikDaful(db, { sinceDays = defaultSinceDays } = {}) {
  const allJenjang = await jenjangListFromFees(db);
  const trend30 = await buildTrendFromPayments(db, { sinceDays });

  // ⬇️ Perubahan utama: kirim split PTK/NonPTK + total
  const { byJenjang, byJenjangPTK, byJenjangNonPTK } = await buildByJenjangSplit(db);

  const totalPendapatan = byJenjang.reduce((a, r) => a + (Number(r.pendapatan)||0), 0);
  const totalTunggakan  = byJenjang.reduce((a, r) => a + (Number(r.tunggakan)||0), 0);
  const countLunas      = byJenjang.reduce((a, r) => a + (Number(r.lunas)||0), 0);
  const countNunggak    = byJenjang.reduce((a, r) => a + (Number(r.nunggak)||0), 0);
  const countBuktiPending = byJenjang.reduce((a, r) => a + (Number(r.buktiPending)||0), 0);
  const countBuktiApproved = await countApprovedPaymentsInRange(db, { sinceDays });

  return {
    trend30,
    byJenjang,
    byJenjangPTK,
    byJenjangNonPTK,
    cards: {
      totalPendapatan, totalTunggakan,
      countLunas, countNunggak,
      countBuktiPending, countBuktiApproved,
    },
    meta: { sinceDays, allJenjang },
  };
}
