"use client";

import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
  where,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import {
  getStorage,
  ref as storageRef,
  listAll,
  deleteObject,
} from "firebase/storage";

import { PAGE_SIZE, toMs } from "../lib/utils";

const storage = getStorage();

/* ========================= Upsert (tidak diubah) ========================= */
const USER_EDITABLE = [
  "name","fullName","fullNameLower",
  "registrationLevel","finalDecision","registrationPaymentStatus",
  "examAccessStatus","examAllowed",
];

const PPDB_EDITABLE = [
  "nama","jenjang","ayahNama","ibuNama","hpSiswa","waliWa",
  "ayahIncome","ibuIncome","alamat",
];

export async function upsertUserAndPpdb({ nisn, userPatch = {}, ppdbPatch = {}, ppdbDocId }) {
  const id = String(nisn || "").trim();
  if (!id) throw new Error("NISN kosong.");

  const safeUser = {};
  for (const k of USER_EDITABLE) if (k in userPatch) safeUser[k] = userPatch[k];
  if ("name" in userPatch || "fullName" in userPatch) {
    const baseName = String((userPatch.name ?? userPatch.fullName ?? "")).trim();
    safeUser.name = baseName;
    safeUser.fullName = baseName;
    safeUser.fullNameLower = baseName.toLowerCase();
  } else if ("fullNameLower" in userPatch) {
    safeUser.fullNameLower = String(userPatch.fullNameLower ?? "").trim();
  }
  safeUser.updatedAt = serverTimestamp();

  const safePpdb = {};
  for (const k of PPDB_EDITABLE) if (k in ppdbPatch) safePpdb[k] = ppdbPatch[k];
  safePpdb.updatedAt = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(doc(db, "users_app", id), safeUser, { merge: true });
  batch.set(doc(db, "ppdb", String(ppdbDocId || id)), safePpdb, { merge: true });
  await batch.commit();
  return { ok: true };
}

/* ========================= Loader PPDB (revisi) ========================= */
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const NIK_ALIASES = ["nik", "NIK", "nikSiswa", "nik_siswa", "noKTP", "noKtp", "ktp"];

/**
 * keys: kandidat kunci campuran (nisn/nik/docId)
 * return: Map bisa diakses dengan nisn, nik maupun docId.
 */
export async function loadPpdbByNisnMap(keys) {
  const map = new Map();
  const clean = (keys || []).map(x => String(x || "").trim()).filter(Boolean);
  if (clean.length === 0) return map;

  const col = collection(db, "ppdb");

  // 1) Query by NISN
  for (const ck of chunk(clean, 10)) {
    try {
      const snap = await getDocs(query(col, where("nisn", "in", ck)));
      snap.forEach((d) => {
        const data = d.data() || {};
        const docId = d.id;
        const nisn = String(data?.nisn || "").trim();
        const nik = resolveNik(data);
        const payload = { _id: docId, ...data };
        if (nisn) map.set(nisn, payload);
        if (nik)  map.set(nik,  payload);
        map.set(docId, payload);
      });
    } catch {}
  }

  // 2) Query by each NIK alias
  for (const field of NIK_ALIASES) {
    for (const ck of chunk(clean, 10)) {
      try {
        const snap = await getDocs(query(col, where(field, "in", ck)));
        snap.forEach((d) => {
          const data = d.data() || {};
          const docId = d.id;
          const nisn = String(data?.nisn || "").trim();
          const nik = resolveNik(data);
          const payload = { _id: docId, ...data };
          if (nik)  map.set(nik,  payload);
          if (nisn) map.set(nisn, payload);
          map.set(docId, payload);
        });
      } catch {}
    }
  }

  // 3) Fallback by docId
  for (const key of clean) {
    if (map.has(key)) continue;
    try {
      const got = await getDoc(doc(db, "ppdb", key));
      if (got.exists()) {
        const data = got.data() || {};
        const docId = got.id;
        const nisn = String(data?.nisn || "").trim();
        const nik  = resolveNik(data);
        const payload = { _id: docId, ...data };
        if (nisn) map.set(nisn, payload);
        if (nik)  map.set(nik,  payload);
        map.set(docId, payload);
      }
    } catch {}
  }

  return map;
}

// Ambil NIK dari berbagai alias & kembalikan hanya digit
function resolveNik(obj) {
  for (const f of NIK_ALIASES) {
    if (obj && obj[f]) {
      const digits = String(obj[f]).replace(/\D/g, "");
      if (digits) return digits;
    }
  }
  return "";
}

/* ========================= Storage & delete (tetap) ========================= */
export async function deleteAllFilesUnder(path) {
  const root = storageRef(storage, path);
  async function recurse(folderRef) {
    const listing = await listAll(folderRef);
    await Promise.all(listing.items.map((it) => deleteObject(it).catch(() => {})));
    await Promise.all(listing.prefixes.map((pf) => recurse(pf)));
  }
  try { await recurse(root); } catch {}
}

export async function deleteUsersAppByNisn(nisn) {
  const id = String(nisn || "").trim();
  if (!id) return { ok: false, reason: "nisn-empty" };
  try { await deleteDoc(doc(db, "users_app", id)); return { ok: true, via: "docId" }; } catch {}
  try {
    const qSnap = await getDocs(query(collection(db, "users_app"), where("nisn", "==", id)));
    const dels = await Promise.allSettled(qSnap.docs.map((d) => deleteDoc(doc(db, "users_app", d.id))));
    return { ok: dels.some((r) => r.status === "fulfilled"), via: "query" };
  } catch { return { ok: false, reason: "query-failed" }; }
}

/* ========================= Export (tetap) ========================= */
async function fetchAllDocsPpdb() {
  const col = collection(db, "ppdb");
  const all = [];
  let last = null;
  while (true) {
    const clauses = [orderBy("createdAt", "desc"), limit(500)];
    if (last) clauses.push(startAfter(last));
    const snap = await getDocs(query(col, ...clauses));
    if (snap.empty) break;
    snap.forEach((d) => all.push({ _id: d.id, ...(d.data() || {}) }));
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  return all;
}

function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function isZeroLeadingNumericString(v){ return /^0\d+$/g.test(String(v ?? "")); }
function normalizeCell(v){
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v?.seconds) return new Date(toMs(v)).toISOString();
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

export async function exportAllToXls(setExporting) {
  try {
    setExporting?.(true);
    const all = await fetchAllDocsPpdb();
    if (all.length === 0) { alert("Tidak ada data untuk diekspor."); return; }

    const skipKeys = new Set(["files","filesMeta"]);
    const headersSet = new Set(["_id"]);
    for (const r of all) for (const k of Object.keys(r)) {
      if (!k.startsWith("_") && !skipKeys.has(k)) headersSet.add(k);
    }
    const headers = Array.from(headersSet);

    let html = `
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8" /></head>
<body>
<table border="1">
  <thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>
`;
    for (const r of all) {
      html += "    <tr>";
      for (const h of headers) {
        const raw = h in r ? r[h] : (h === "_id" ? r._id : "");
        const val = normalizeCell(raw);
        const needsText = isZeroLeadingNumericString(val) || h.toLowerCase() === "nisn" || h === "_id";
        const tdStyle = needsText ? " style=\"mso-number-format:'\\@';\"" : "";
        html += `<td${tdStyle}>${escapeHtml(val)}</td>`;
      }
      html += "</tr>\n";
    }
    html += `  </tbody></table></body></html>`.trim();

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ppdb-export-${new Date().toISOString().replace(/[:.]/g,"-")}.xls`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (e) {
    console.error("exportAllToXls()", e);
    alert("Gagal membuat file .xls. Coba lagi.");
  } finally {
    setExporting?.(false);
  }
}

/* ========================= Delete participant (tetap) ========================= */
export async function deleteParticipant(rec) {
  const nisn = String(rec?.nisn || rec?._id || "").trim();
  if (!rec?._id && !nisn) throw new Error("Data tidak lengkap untuk dihapus.");
  if (nisn) await deleteAllFilesUnder(`ppdb/${nisn}`);
  const ops = [];
  if (rec?._id) ops.push(deleteDoc(doc(db, "ppdb", String(rec._id))));
  if (nisn) ops.push(deleteUsersAppByNisn(nisn));
  const res = await Promise.allSettled(ops);
  if (res.every(r => r.status === "rejected")) throw new Error("Gagal menghapus dokumen Firestore (ppdb/users_app).");
}
