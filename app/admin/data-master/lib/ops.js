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

/* =====================================================================================
 *  EDIT (BARU): Upsert atomik ke users_app & ppdb
 * ===================================================================================== */
const USER_EDITABLE = [
  "name",
  "fullName",          // ⬅️ ditambahkan
  "fullNameLower",     // ⬅️ ditambahkan
  "registrationLevel",
  "finalDecision",
  "registrationPaymentStatus",
  "examAccessStatus",
  "examAllowed",
];

const PPDB_EDITABLE = [
  "nama",
  "jenjang",
  "ayahNama",
  "ibuNama",
  "hpSiswa",
  "waliWa",
  "ayahIncome",
  "ibuIncome",
  "alamat",
];

/**
 * Upsert kedua koleksi secara atomik (writeBatch).
 * - users_app/{nisn}
 * - ppdb/{ppdbDocId || nisn}
 *
 * Sinkronisasi otomatis:
 *  - Jika name/fullName berubah → set { name, fullName, fullNameLower } konsisten.
 */
export async function upsertUserAndPpdb({ nisn, userPatch = {}, ppdbPatch = {}, ppdbDocId }) {
  const id = String(nisn || "").trim();
  if (!id) throw new Error("NISN kosong.");

  // --- sanitize patch — hanya field yang diizinkan
  const safeUser = {};
  for (const k of USER_EDITABLE) if (k in userPatch) safeUser[k] = userPatch[k];

  // --- sinkron nama: name/fullName/fullNameLower selalu konsisten
  if ("name" in userPatch || "fullName" in userPatch) {
    const baseName = String(
      (userPatch.name ?? userPatch.fullName ?? "").toString()
    ).trim();

    // name & fullName disamakan
    safeUser.name = baseName;
    safeUser.fullName = baseName;

    // fullNameLower diturunkan otomatis (meski user tidak mengirim)
    safeUser.fullNameLower = baseName.toLowerCase();
  } else if ("fullNameLower" in userPatch && !("name" in userPatch) && !("fullName" in userPatch)) {
    // Jika user *hanya* mengirim fullNameLower (jarang), tetap hormati nilai itu.
    safeUser.fullNameLower = String(userPatch.fullNameLower ?? "").trim();
  }

  safeUser.updatedAt = serverTimestamp();

  const safePpdb = {};
  for (const k of PPDB_EDITABLE) if (k in ppdbPatch) safePpdb[k] = ppdbPatch[k];
  safePpdb.updatedAt = serverTimestamp();

  const batch = writeBatch(db);

  // users_app/{nisn}
  const userRef = doc(db, "users_app", id);
  batch.set(userRef, safeUser, { merge: true });

  // ppdb/{ppdbDocId || nisn}
  const ppdbId = String(ppdbDocId || id);
  const ppdbRef = doc(db, "ppdb", ppdbId);
  batch.set(ppdbRef, safePpdb, { merge: true });

  await batch.commit();
  return { ok: true };
}

/* =====================================================================================
 *  Lookup PPDB by daftar NISN
 * ===================================================================================== */
export async function loadPpdbByNisnMap(nisnList) {
  const map = new Map();
  const col = collection(db, "ppdb");
  const clean = (nisnList || [])
    .map((x) => String(x || "").trim())
    .filter((x) => x.length > 0);

  for (let i = 0; i < clean.length; i += 10) {
    const chunk = clean.slice(i, i + 10);
    const snap = await getDocs(query(col, where("nisn", "in", chunk)));
    snap.forEach((d) => {
      const data = d.data() || {};
      const key = String(data?.nisn || "").trim();
      if (key) map.set(key, { _id: d.id, ...data });
    });
  }
  return map;
}

/* =====================================================================================
 *  Hapus Storage rekursif
 * ===================================================================================== */
export async function deleteAllFilesUnder(path) {
  const root = storageRef(storage, path);
  async function recurse(folderRef) {
    const listing = await listAll(folderRef);
    await Promise.all(listing.items.map((it) => deleteObject(it).catch(() => {})));
    await Promise.all(listing.prefixes.map((pf) => recurse(pf)));
  }
  try {
    await recurse(root);
  } catch {
    // abaikan jika folder tidak ada / no permission
  }
}

/* =====================================================================================
 *  Hapus users_app by NISN
 * ===================================================================================== */
export async function deleteUsersAppByNisn(nisn) {
  const id = String(nisn || "").trim();
  if (!id) return { ok: false, reason: "nisn-empty" };
  try {
    await deleteDoc(doc(db, "users_app", id));
    return { ok: true, via: "docId" };
  } catch {}
  try {
    const qSnap = await getDocs(query(collection(db, "users_app"), where("nisn", "==", id)));
    const dels = await Promise.allSettled(
      qSnap.docs.map((d) => deleteDoc(doc(db, "users_app", d.id)))
    );
    const anyOk = dels.some((r) => r.status === "fulfilled");
    return { ok: anyOk, via: "query" };
  } catch {
    return { ok: false, reason: "query-failed" };
  }
}

/* =====================================================================================
 *  Export .XLS (dari semua dokumen PPDB)
 * ===================================================================================== */
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
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isZeroLeadingNumericString(v) {
  const s = String(v ?? "");
  return /^0\d+$/g.test(s);
}

function normalizeCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v?.seconds) return new Date(toMs(v)).toISOString();
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export async function exportAllToXls(setExporting) {
  try {
    setExporting?.(true);
    const all = await fetchAllDocsPpdb();
    if (all.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const skipKeys = new Set(["files", "filesMeta"]);
    const headersSet = new Set(["_id"]);
    for (const r of all) {
      for (const k of Object.keys(r)) {
        if (k.startsWith("_")) continue;
        if (skipKeys.has(k)) continue;
        headersSet.add(k);
      }
    }
    const headers = Array.from(headersSet);

    let html = `
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="UTF-8" />
</head>
<body>
<table border="1">
  <thead>
    <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
  </thead>
  <tbody>
`;

    for (const r of all) {
      html += "    <tr>";
      for (const h of headers) {
        const raw = h in r ? r[h] : (h === "_id" ? r._id : "");
        const val = normalizeCell(raw);
        const needsText =
          isZeroLeadingNumericString(val) || h.toLowerCase() === "nisn" || h === "_id";
        const tdStyle = needsText ? " style=\"mso-number-format:'\\@';\"" : "";
        html += `<td${tdStyle}>${escapeHtml(val)}</td>`;
      }
      html += "</tr>\n";
    }

    html += `  </tbody>
</table>
</body>
</html>`.trim();

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `ppdb-export-${ts}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("exportAllToXls()", e);
    alert("Gagal membuat file .xls. Coba lagi.");
  } finally {
    setExporting?.(false);
  }
}

/* =====================================================================================
 *  Hapus total (PPDB + users_app + Storage)
 * ===================================================================================== */
export async function deleteParticipant(rec) {
  const nisn = String(rec?.nisn || rec?._id || "").trim();
  if (!rec?._id && !nisn) throw new Error("Data tidak lengkap untuk dihapus.");

  // 1) Hapus Storage: /ppdb/{nisn}/**
  if (nisn) await deleteAllFilesUnder(`ppdb/${nisn}`);

  // 2) Hapus Firestore: ppdb/{_id?} + users_app/{nisn}
  const ops = [];
  if (rec?._id) ops.push(deleteDoc(doc(db, "ppdb", String(rec._id))));
  if (nisn) ops.push(deleteUsersAppByNisn(nisn));

  const res = await Promise.allSettled(ops);
  const allFail = res.every((r) => r.status === "rejected");
  if (allFail) throw new Error("Gagal menghapus dokumen Firestore (ppdb/users_app).");
}
