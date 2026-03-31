// app/admin/pembayaran/wa-konfirm.js
"use client";

import {
  doc, getDoc, serverTimestamp, setDoc,
  collection, query, where, getDocs, limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------- Utils ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onlyDigits = (s = "") => String(s).replace(/[^\d]/g, "");

function normalizeWa(raw) {
  // Input: "0812...", "+62...", "62812...", "62..."
  const d = onlyDigits(raw || "");
  if (!d) return null;
  if (d.startsWith("62")) return d;            // ✅ jika sudah 62, biarkan
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  return d; // fallback internasional tanpa plus
}

const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(Number(n || 0));

// ---------- Ambil fee + level + username berdasarkan NISN ----------
async function resolveUserMetaByNisn(nisn) {
  // 1) Ambil registrationLevel & username dari users_app/{nisn}
  const userRef = doc(db, "users_app", String(nisn));
  const userSnap = await getDoc(userRef);
  let registrationLevel = "-";
  let username = String(nisn || "").trim();

  if (userSnap.exists()) {
    const u = userSnap.data() || {};
    registrationLevel = u.registrationLevel || "-";
    // Prioritas field username; fallback ke nisn
    username = (u.username && String(u.username).trim()) || username;
  }

  // 2) Cari fees where label == registrationLevel
  const feesCol = collection(db, "fees");
  const q = query(feesCol, where("label", "==", registrationLevel), limit(1));
  const feesSnap = await getDocs(q);

  const amount = feesSnap.empty ? 0 : Number(feesSnap.docs[0].data()?.fee || 0);
  return { amount, registrationLevel, username };
}

// ---------- Template pesan WA ----------
function buildMessage({ fullName, registrationId, registrationLevel, amount, method, username, nisn }) {
  const NAME = String(fullName || "").toUpperCase();
  const loginUrl = `${location.origin}/login`; // otomatis localhost/prod

  return [
    "Bismillah.",
    "",
    `Pembayaran pendaftaran *${registrationLevel}* atas nama *${NAME}* (ID: ${registrationId}) telah *DISETUJUI*.`,
    `Metode: ${String(method || "-").toUpperCase()}`,
    `Jumlah: ${fmtIDR(amount)}`,
    "",
    `Username: *${username || "-"}*`,
    `NISN: *${nisn || "-"}*`,
    `Login: ${loginUrl}`,
    "",
    "Butuh Bantuan : 0877 2024 2025",
    "— Panitia SPMB",
  ].join("\n");
}

// ---------- Kirim ke provider ----------
async function sendViaFonnte({ to62, text }) {
  const url = process.env.NEXT_PUBLIC_WA_GATEWAY_URL || process.env.WA_GATEWAY_URL || "https://api.fonnte.com/send";
  const token = process.env.NEXT_PUBLIC_WA_TOKEN || process.env.WA_TOKEN;
  if (!token) throw new Error("WA_TOKEN tidak diset.");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: token },
    body: new URLSearchParams({ target: to62, message: text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.status !== true && data?.status !== "true" && data?.detail?.status !== "sent")) {
    throw new Error(`Fonnte gagal: ${res.status} ${JSON.stringify(data)}`);
  }
  return { provider: "fonnte", ok: true, data };
}

async function sendViaTwilio({ to62, text }) {
  const sid = process.env.TWILIO_SID;
  const token = process.env.WA_TOKEN || process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM; // "whatsapp:+1415...."
  if (!sid || !token || !from) throw new Error("TWILIO_SID/WA_TOKEN/TWILIO_FROM belum diset.");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({
    From: from,
    To: `whatsapp:+${to62}`,
    Body: text,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.sid) throw new Error(`Twilio gagal: ${res.status} ${JSON.stringify(data)}`);
  return { provider: "twilio", ok: true, data };
}

async function deliverWhatsApp({ to62, text }) {
  const provider = (process.env.NEXT_PUBLIC_WA_PROVIDER || process.env.WA_PROVIDER || "fonnte").toLowerCase();
  if (provider === "twilio") return sendViaTwilio({ to62, text });
  return sendViaFonnte({ to62, text });
}

// ---------- Public API ----------
/**
 * Kirim WA konfirmasi pembayaran.
 * - Ambil nomor dari ppdb/{nisn} (ayahWa/waliWa/ayahTelp/waliTelp)
 * - Ambil fee & username otomatis dari users_app/{nisn}
 * @param {Object} args
 * @param {string} args.nisn - id dokumen di /ppdb/{nisn}
 * @param {string} args.registrationId
 * @param {string} args.fullName
 * @param {string} [args.registrationLevel] - opsional; jika kosong akan di-resolve dari users_app/{nisn}
 * @param {number} [args.amount] - opsional; jika tidak ada akan di-resolve dari koleksi fees
 * @param {string} args.method - "online" | "offline"
 * @param {string} [args.eventId] - idempotent key
 */
export async function sendWaKonfirmasi(args) {
  const {
    nisn,
    registrationId,
    fullName,
    registrationLevel,
    amount,
    method,
    eventId = `${args?.nisn || "N"}-${args?.registrationId || "R"}-approved`,
  } = args || {};

  if (!nisn) return { ok: false, reason: "NISN kosong." };

  try {
    // Idempotency check
    const logRef = doc(db, "wa_logs", eventId);
    const existing = await getDoc(logRef);
    if (existing.exists() && existing.data()?.status === "SENT") {
      return { ok: true, info: { skipped: "already_sent", eventId } };
    }

    // Ambil nomor wali
    const pRef = doc(db, "ppdb", String(nisn));
    const snap = await getDoc(pRef);
    if (!snap.exists()) return { ok: false, reason: `ppdb/${nisn} tidak ditemukan.` };

    const data = snap.data() || {};
    const rawWa = data.ayahWa || data.waliWa || data.ayahTelp || data.waliTelp || "";
    const to62 = normalizeWa(rawWa);
    if (!to62) {
      await setDoc(
        logRef,
        { eventId, nisn, to: rawWa || null, provider: null, status: "NO_NUMBER", createdAt: serverTimestamp() },
        { merge: true }
      );
      return { ok: false, reason: "Nomor WA wali kosong/invalid pada dokumen ppdb." };
    }

    // Resolve fee, level, dan username jika belum diberikan oleh caller
    let finalAmount = Number(amount ?? NaN);
    let finalLevel = registrationLevel;
    let finalUsername = null;

    if (!(finalAmount > 0) || !finalLevel || !finalUsername) {
      const meta = await resolveUserMetaByNisn(nisn);
      if (!(finalAmount > 0)) finalAmount = meta.amount;
      if (!finalLevel) finalLevel = meta.registrationLevel;
      finalUsername = meta.username; // selalu diisi (fallback ke nisn)
    }

    // Bangun pesan (sekarang menyertakan Username & NISN)
    const text = buildMessage({
      fullName,
      registrationId,
      registrationLevel: finalLevel,
      amount: finalAmount,
      method,
      username: finalUsername,
      nisn,
    });

    // Kirim
    const result = await deliverWhatsApp({ to62, text });

    // Log sukses
    await setDoc(
      logRef,
      {
        eventId,
        nisn,
        to: `+${to62}`,
        provider: result?.provider || null,
        raw: result?.data || null,
        status: "SENT",
        createdAt: serverTimestamp(),
        meta: {
          type: "payment:new",
          status: "approved",
          registrationId,
          registrationLevel: finalLevel,
          amount: Number(finalAmount || 0),
          method: method || null,
          username: finalUsername,
        },
      },
      { merge: true }
    );

    await sleep(150);
    return { ok: true, info: { provider: result?.provider, eventId } };
  } catch (e) {
    const logRef = doc(db, "wa_logs", eventId);
    await setDoc(
      logRef,
      { eventId, nisn, status: "FAILED", error: String(e?.message || e), createdAt: serverTimestamp() },
      { merge: true }
    );
    return { ok: false, reason: e?.message || "Gagal kirim WA." };
  }
}

export default sendWaKonfirmasi;
