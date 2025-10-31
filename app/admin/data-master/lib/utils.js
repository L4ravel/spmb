"use client";

/* ===== Konstanta paging & batas baca ===== */
export const PAGE_SIZE = 20;
export const READ_CAP = 5;

/* ===== Utils umum ===== */
export const isEmpty = (v) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !v?.seconds && Object.keys(v || {}).length === 0);

export const toMs = (v) =>
  typeof v?.toMillis === "function"
    ? v.toMillis()
    : Number.isFinite(new Date(String(v)).getTime())
    ? new Date(String(v)).getTime()
    : 0;

export const fmtDate = (v) =>
  toMs(v)
    ? new Date(toMs(v)).toLocaleString("id-ID", { hour12: false })
    : "-";

/** durasi sejak pendaftaran (createdAt) sampai sekarang */
export function fmtDurationSince(v) {
  const ms = Date.now() - toMs(v);
  if (!Number.isFinite(ms) || ms <= 0) return "baru saja";
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const hh = h % 24;
  const mm = m % 60;

  if (d > 0) return `${d} h  ${hh} j`;
  if (h > 0) return `${h} j ${mm} m`;
  if (m > 0) return `${m} m`;
  return `${sec} detik`;
}

export const pickWhatsApp = (doc) => {
  const cands = [doc?.hpSiswa, doc?.waliWa, doc?.ibuWa, doc?.waliHP].map((x) =>
    typeof x === "string" ? x.trim() : ""
  );
  return cands.find((x) => x) || "-";
};

export const getAyahNama = (doc) => (doc?.ayahNama ? String(doc.ayahNama) : "-");

export const displayNisn = (r) => {
  const nisn = String(r?.nisn ?? "").trim();
  return nisn || "-";
};

// parser label penghasilan → angka rupiah (pakai titik tengah rentang)
export function parseIncomeLabel(v) {
  const s = String(v ?? "").toLowerCase().replaceAll(",", ".").replaceAll(/\s+/g, " ");
  if (!s) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*juta/);
  if (m) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return ((a + b) / 2) * 1_000_000;
  }
  const n = s.match(/(\d+(?:\.\d+)?)\s*juta/);
  if (n) {
    const x = parseFloat(n[1]);
    if (Number.isFinite(x)) return x * 1_000_000;
  }
  const only = s.match(/^\d+(?:\.\d+)?$/);
  if (only) return parseFloat(only[0]) * (s.includes("juta") ? 1_000_000 : 1);
  return 0;
}

// total penghasilan gabungan ayah+ibu (dari collection ppdb)
export const sumIncome = (r) => parseIncomeLabel(r?.ayahIncome) + parseIncomeLabel(r?.ibuIncome);

/** Status Orang Tua */
export const parentStatus = (r) => {
  const a = String(r?.ayahStatus || "").toLowerCase().trim();
  const i = String(r?.ibuStatus || "").toLowerCase().trim();
  const ayahM = a === "meninggal";
  const ibuM = i === "meninggal";
  if (ayahM && ibuM) return "MENINGGAL_KEDUANYA";
  if (ayahM) return "MENINGGAL_AYAH";
  if (ibuM) return "MENINGGAL_IBU";
  return "HIDUP_KEDUANYA";
};

/* ===== Files preview helper (ppdb folder) ===== */
export function buildFilesForNisn(doc) {
  const nisn = String(doc?.nisn || doc?._id || "").trim();
  const validSeg = nisn ? `/ppdb/${nisn}/` : null;
  const out = [];

  if (doc?.filesMeta && typeof doc.filesMeta === "object") {
    for (const [name, meta] of Object.entries(doc.filesMeta)) {
      const url = String(meta?.url || "");
      if (!url) continue;
      if (validSeg && !url.includes(validSeg)) continue;
      out.push({
        key: name.toUpperCase(),
        url,
        contentType: meta?.contentType || "",
        size: meta?.size || null,
      });
    }
  }

  if (out.length === 0 && doc?.files && typeof doc.files === "object") {
    for (const [name, urlRaw] of Object.entries(doc.files)) {
      const url = String(urlRaw || "");
      if (!url) continue;
      if (validSeg && !url.includes(validSeg)) continue;
      out.push({ key: name.toUpperCase(), url, contentType: "", size: null });
    }
  }

  const pref = ["KK", "IJAZAH", "AKTA", "FOTO", "KIP"];
  out.sort((a, b) => {
    const ia = pref.indexOf(a.key);
    const ib = pref.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.key.localeCompare(b.key);
  });

  return out;
}

/* ===== users_app as single source of truth ===== */
export function statusFromUsersApp(u) {
  const rps = u?.registrationPaymentStatus;
  const paid = typeof rps === "string" && rps.toLowerCase() === "verified";
  const unpaidEmpty = isEmpty(rps);
  return {
    _paid: !!paid,
    _unpaidEmpty: !!unpaidEmpty,
    _passed: String(u?.finalDecision || "").toLowerCase() === "lulus",
    _regLevel: u?.registrationLevel || null,
    _regPayStatus: rps ?? null,
  };
}
