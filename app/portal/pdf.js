"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  doc, getDoc, collection, query, where, limit, getDocs,
} from "firebase/firestore";
import { drawQRCodeOnPdf } from "./barcode";

/* ===== Utils ===== */
function fmtIDR(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));
}
function fmtDate(val) {
  try {
    const d = val?.toDate?.() ?? (val ? new Date(val) : new Date());
    return d.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
  } catch {
    return String(val || "");
  }
}
function formatTanggalSurat(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const tgl = dt.getDate(); // tanpa leading zero
  const bulan = dt.toLocaleDateString('id-ID', { month: 'long' });
  const tahun = dt.getFullYear();
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${tgl} ${cap(bulan)} ${tahun}`;
}

/** Ambil fee berdasarkan registrationLevel:
 * prioritas: label == level -> key == level -> docId == level
 */
async function getFeeByLevel(db, level) {
  const feesCol = collection(db, "fees");

  let snap = await getDocs(query(feesCol, where("label", "==", level), limit(1)));
  if (!snap.empty) {
    const d = snap.docs[0].data();
    return { amount: Number(d?.fee || 0), currency: d?.currency || "IDR" };
  }
  snap = await getDocs(query(feesCol, where("key", "==", level), limit(1)));
  if (!snap.empty) {
    const d = snap.docs[0].data();
    return { amount: Number(d?.fee || 0), currency: d?.currency || "IDR" };
  }
  const byId = await getDoc(doc(db, "fees", level));
  if (byId.exists()) {
    const d = byId.data();
    return { amount: Number(d?.fee || 0), currency: d?.currency || "IDR" };
  }
  return { amount: 0, currency: "IDR" };
}

/** Generate & download PDF (A5 + kop surat + QR ttd) di client */
export async function downloadBuktiPembayaran({ db, nisn }) {
  if (!db) throw new Error("Firestore db wajib di-pass.");
  if (!nisn) throw new Error("NISN tidak boleh kosong.");

  // 1) Ambil user dari users_app/{nisn}
  const usnap = await getDoc(doc(db, "users_app", nisn));
  if (!usnap.exists()) throw new Error(`Data peserta ${nisn} tidak ditemukan.`);
  const u = usnap.data() || {};

  const regId = String(u.registrationId || "-");
  const fullName = String(u.fullName || u.name || "-");
  const level = String(u.registrationLevel || "-");
  const paymentMethod = String(u.registrationPaymentMethod || "offline");
  const verifiedAt = u.registrationPaymentVerifiedAt ?? null;

  // 2) Cari fee berdasarkan level
  const { amount /* , currency */ } = await getFeeByLevel(db, level);
  if (!amount) {
    throw new Error(`Fee untuk level '${level}' tidak ditemukan di koleksi 'fees'.`);
  }

  // 3) Siapkan PDF A5 Portrait (≈ 419.53 × 595.28 pt)
  const A5W = 419.53;
  const A5H = 595.28;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A5W, A5H]);
  const { height: H, width: W } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 28;
  let y = H - margin;

  // 3a) Kop surat dari /public/pdf/kop-pembayaran.png
  try {
    const imgBytes = await fetch("/pdf/kop-pembayaran.png").then((r) => r.arrayBuffer());
    const kop = await pdf.embedPng(imgBytes);
    const kopW = W - margin * 2;
    const scale = kopW / kop.width;
    const kopH = kop.height * scale;
    page.drawImage(kop, { x: margin, y: y - kopH, width: kopW, height: kopH });
    y -= kopH + 6;

    // garis tebal di bawah kop
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: W - margin, y: y },
      thickness: 2,
      color: rgb(0.15, 0.15, 0.25),
    });
    y -= 18;
  } catch {
    // fallback tanpa kop
    page.drawText("BUKTI PEMBAYARAN PENDAFTARAN", {
      x: margin, y, size: 14, font: bold, color: rgb(0.15, 0.15, 0.25),
    });
    y -= 16;
    page.drawLine({
      start: { x: margin, y },
      end: { x: W - margin, y },
      thickness: 2,
      color: rgb(0.15, 0.15, 0.25),
    });
    y -= 18;
  }

  // 3b) Judul
  const title = "BUKTI PEMBAYARAN PENDAFTARAN";
  const titleSize = 13;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (W - titleWidth) / 2,
    y,
    size: titleSize,
    font: bold,
    color: rgb(0.1, 0.1, 0.2),
  });
  y -= 20;

  // 3c) Pembuka
  const pembuka =
    "Yang bertanda tangan di bawah ini menerangkan bahwa telah diterima pembayaran biaya pendaftaran dari:";
  drawParagraph(page, pembuka, { x: margin, y, size: 10.5, font, width: W - margin * 2, leading: 13 });
  y -= getParagraphHeight(pembuka, { size: 10.5, font, width: W - margin * 2, leading: 13 }) + 6;

  // 3d) Tabel data
  const rows = [
    ["ID Pendaftaran", regId],
    ["NISN", nisn],
    ["Nama", fullName],
    ["Jenjang", level],
    ["Metode Pembayaran", paymentMethod.toUpperCase()],
    ["Nominal", fmtIDR(amount)],
    ["Waktu Verifikasi", fmtDate(verifiedAt)],
  ];
  const labelW = 138;
  rows.forEach(([k, v]) => {
    page.drawText(k, { x: margin, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.15) });
    page.drawText(":", { x: margin + labelW - 6, y, size: 11, font, color: rgb(0.1, 0.1, 0.15) });
    page.drawText(String(v), { x: margin + labelW, y, size: 11, font, color: rgb(0.1, 0.1, 0.15) });
    y -= 16;
  });

  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: W - margin, y },
    thickness: 0.8,
    color: rgb(0.7, 0.7, 0.75),
  });
  y -= 10;

  // 3e) Penutup
  const penutup =
    "Demikian bukti pembayaran ini dibuat untuk dipergunakan sebagaimana mestinya.";
  drawParagraph(page, penutup, { x: margin, y, size: 10.5, font, width: W - margin * 2, leading: 13 });
  y -= getParagraphHeight(penutup, { size: 10.5, font, width: W - margin * 2, leading: 13 }) + 12;

  // ===== Tanda tangan: QR sebagai ttd =====
  // ===== Tanda tangan: QR kiri, teks kanan — disesuaikan agar benar-benar rata =====
const kotaTanggal = `Bagik Nyaka, ${formatTanggalSurat(new Date())}`;
const jab       = "Panitia SPMB";
const namaTTD   = "Lalu Wirasandi, S.Pd";

const textSize  = 10.5;
const textLine  = 14;   // jarak antar baris
const gapToName = 16;   // jarak baris jabatan → baris nama
const gapX      = 12;   // jarak QR ↔ teks

// area kolom tanda tangan (kanan)
const blockX = W - margin - 210;
const topY   = y;                         // baseline baris "Bagik Nyaka"

// hitung baseline nama (2 baris + gap)
const nameY  = topY - (textLine * 2 + gapToName);

// --- kompensasi visual (huruf punya ascender/descender) ---
const FUDGE_TOP = 6;     // tambah tinggi QR ke atas
const FUDGE_BTM = 4;     // tambah tinggi QR ke bawah

// QR harus menutup rentang dari sekitar top visual sampai bottom visual
const qrSize = (topY - nameY) + FUDGE_TOP + FUDGE_BTM;
const qrX    = blockX;
const qrY    = nameY - FUDGE_BTM; // geser sedikit ke bawah agar rata bawah

// 1) Gambar QR (kiri)
await drawQRCodeOnPdf({
  pdfDoc: pdf,
  page,
  nisn,
  x: qrX,
  y: qrY,
  size: qrSize,
});

// 2) Teks di kanan QR (sejajar)
const textX = qrX + qrSize + gapX;
page.drawText(kotaTanggal, { x: textX, y: topY,              size: textSize, font,  color: rgb(0.1,0.1,0.15) });
page.drawText(jab,         { x: textX, y: topY - textLine,   size: textSize, font: bold, color: rgb(0.1,0.1,0.15) });
page.drawText(namaTTD,     { x: textX, y: nameY,             size: textSize, font,  color: rgb(0.1,0.1,0.15) });

// 3) turunkan pointer Y global setelah blok tanda tangan
y = nameY - 24;


  // footer catatan
  const cat = "Catatan: Simpan bukti ini. Tidak dibubuhi tanda tangan basah karena tercatat pada sistem.";
  page.drawText(cat, { x: margin, y: 24, size: 8.5, font, color: rgb(0.35, 0.35, 0.38) });

  // 4) Unduh
  const pdfBytes = await pdf.save();
  const fname = `bukti-pembayaran_${nisn}_${regId}.pdf`;

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { ok: true };
}

/* ===== Helper paragraf ===== */
function getParagraphHeight(text, { size, font, width, leading }) {
  const words = String(text || "").split(/\s+/);
  let line = "", h = 0;
  const max = width;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    const w = font.widthOfTextAtSize(test, size);
    if (w > max && line) { h += leading; line = words[i]; } else { line = test; }
  }
  if (line) h += leading;
  return h;
}
function drawParagraph(page, text, { x, y, size, font, width, leading }) {
  const words = String(text || "").split(/\s+/);
  const max = width;
  let line = "", yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    const w = font.widthOfTextAtSize(test, size);
    if (w > max && line) { page.drawText(line, { x, y: yy, size, font, color: rgb(0.1, 0.1, 0.15) }); yy -= leading; line = words[i]; }
    else { line = test; }
  }
  if (line) page.drawText(line, { x, y: yy, size, font, color: rgb(0.1, 0.1, 0.15) });
}
