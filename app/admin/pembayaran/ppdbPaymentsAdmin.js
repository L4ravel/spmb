// lib/ppdbPaymentsAdmin.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// ===== Whitelist: hanya email berikut yang boleh pakai filter verifikator
const ALLOWED_VERIFIER_EMAILS = [
  "abdurrahman.man.88@gmail.com",
  "wirasandilalu12@gmail.com",
  "usmanirawan00@gmail.com",
].map((e) => e.toLowerCase());

/* ===== Utils ===== */
const cx = (...a) => a.filter(Boolean).join(" ");
const CONFIRM_PW =
  process.env.NEXT_PUBLIC_ADMIN_CONFIRM_PASSWORD ||
  process.env.NEXT_PUBLIC_CONFIRM_PASSWORD ||
  "123";

/** Ambil email admin yang login dari localStorage */
function readLoggedInEmail(fallback = "admin") {
  try {
    const raw = localStorage.getItem("appUser");
    if (raw) {
      const obj = JSON.parse(raw);
      return (
        obj?.email ||
        obj?.user?.email ||
        obj?.username ||
        obj?.name ||
        fallback
      );
    }
  } catch {}
  return fallback;
}

function inferMethod(row) {
  if (row.registrationPaymentMethod === "online" || row.registrationPaymentMethod === "offline") {
    return row.registrationPaymentMethod;
  }
  if (row.paymentMethod === "wa" || row.paymentMethod === "transfer") return "online";
  if (row.registrationPaymentProof) return "online";
  return "offline";
}

/**
 * Hook admin pembayaran (verifikator terkunci ke email login)
 * Mengembalikan adminEmail (read-only) + alias kompatibel adminName & setAdminName(no-op)
 */
export function useAdminPayments() {
  // email admin (read-only)
  const [adminEmail, setAdminEmail] = useState(() => readLoggedInEmail("admin"));

  // controls
  const [pageSize, setPageSize]   = useState(25);
  const [search, setSearch]       = useState("");

  // filters
  const [statusFilter, setStatusFilter] = useState("all"); // pending|verified|all
  const [filterMethod, setFilterMethod] = useState("all");     // all|online|offline
  const [filterProof, setFilterProof]   = useState("all");     // all|with|without
  const [filterLevel, setFilterLevel]   = useState("all");     // TK|SD|...|all
  const [startDate, setStartDate]       = useState("");        // YYYY-MM-DD inclusive
  const [endDate, setEndDate]           = useState("");        // YYYY-MM-DD inclusive

  // data
  const [rowsRaw, setRowsRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [ok, setOk]           = useState("");
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef(null);

  const [recap, setRecap] = useState({ online: 0, offline: 0 });

  // modal konfirmasi
  const [askPwOpen, setAskPwOpen]   = useState(false);
  const [askPwForId, setAskPwForId] = useState(null);
  const [askPwValue, setAskPwValue] = useState("");
  const [askPwErr, setAskPwErr]     = useState("");

  // upload progress
  const [uploading, setUploading] = useState({}); // { [id]: {busy,progress} }

  // ====== Filter verifikator (DINAMIS dari data users_app/<nisn>) ======
  const [verifierFilter, setVerifierFilter] = useState("all"); // dari dropdown
  const [verifierQuery, setVerifierQuery]   = useState("");    // override: input bebas
  const [totalRowsCount, setTotalRowsCount] = useState(0);
  const [totalVerifiedCount, setTotalVerifiedCount] = useState(0);
const [totalPendingCount, setTotalPendingCount]   = useState(0);

  function buildCountQuery() {
  const coll = collection(db, "users_app");
  const parts = [];

  if (statusFilter === "pending") {
    parts.push(where("registrationPaymentStatus", "==", "waiting_review"));
  } else if (statusFilter === "verified") {
    parts.push(where("verifiedPayment", "==", true));
  } else {
    // "all" → tanpa where status
  }

  if (filterLevel !== "all") {
    parts.push(where("registrationLevel", "==", filterLevel));
  }

  // urutan tidak diperlukan untuk count; cukup where*
  return query(coll, ...parts);
}

function buildVerifiedCountQuery() {
  const coll = collection(db, "users_app");
  const parts = [
    where("verifiedPayment", "==", true),
    where("registrationPaymentMethod", "in", ["online", "offline"]),
  ];
  if (filterLevel !== "all") parts.push(where("registrationLevel", "==", filterLevel));
  return query(coll, ...parts);
}

function buildPendingCountQuery() {
  const coll = collection(db, "users_app");
  const parts = [ where("registrationPaymentStatus", "==", "waiting_review") ];
  if (filterLevel !== "all") parts.push(where("registrationLevel", "==", filterLevel));
  return query(coll, ...parts);
}

async function refreshStatusCounts() {
  try {
    const [vSnap, pSnap] = await Promise.all([
      getCountFromServer(buildVerifiedCountQuery()),
      getCountFromServer(buildPendingCountQuery()),
    ]);
    setTotalVerifiedCount(vSnap.data().count || 0);
    setTotalPendingCount(pSnap.data().count || 0);
  } catch (e) {
    console.error("refreshStatusCounts failed", e);
    setTotalVerifiedCount(0);
    setTotalPendingCount(0);
  }
}


async function refreshCount() {
  try {
    const q = buildCountQuery();
    const snap = await getCountFromServer(q);
    setTotalRowsCount(snap.data().count || 0);
  } catch (e) {
    console.error("getCountFromServer failed", e);
    setTotalRowsCount(0);
  }
}

  // hanya 3 email ini yang boleh pakai filter verifikator
  const canUseVerifierFilter = useMemo(() => {
    return ALLOWED_VERIFIER_EMAILS.includes(String(adminEmail || "").toLowerCase());
  }, [adminEmail]);

  // opsi dropdown verifikator murni dari data (unique, lowercase)
  const verifierOptions = useMemo(() => {
    const s = new Set();
    rowsRaw.forEach((r) => {
      const by = String(r?.registrationPaymentVerifiedBy || "").trim().toLowerCase();
      if (by) s.add(by);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
  }, [rowsRaw]);

  /* Sinkronkan adminEmail saat tab/login berubah (read-only) */
  useEffect(() => {
    const sync = () => setAdminEmail(readLoggedInEmail("admin"));
    sync();
    const handler = (e) => {
      if (e.key === "appUser") sync();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /* Query builder (irit read) */
  function buildQuery({ after } = {}) {
    const coll = collection(db, "users_app");
    const parts = [];

    if (statusFilter === "pending") {
      // Ambil semua yang menunggu review
      parts.push(where("registrationPaymentStatus", "==", "waiting_review"));
    } else if (statusFilter === "verified") {
      parts.push(where("verifiedPayment", "==", true));
    } else if (statusFilter === "unapproved_all") {
      // tidak ada kondisi khusus (ambil semua yang belum approved pada UI)
    }

    if (filterLevel !== "all") {
      parts.push(where("registrationLevel", "==", filterLevel));
    }

    parts.push(orderBy("username"));
    parts.push(limit(pageSize));
    if (after) parts.push(startAfter(after));

    return query(coll, ...parts);
  }

  async function loadFirst() {
    setErr(""); setOk(""); setLoading(true);
    lastDocRef.current = null;
    try {
      const q = buildQuery();
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, _ref: d, ...data, _method: inferMethod(data) };
      });
      setRowsRaw(items);
      setHasMore(snap.docs.length === pageSize);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
    } catch (e) {
      console.error(e);
      setErr("Gagal memuat data. Cek index/rules Firestore.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || !lastDocRef.current) return;
    setLoading(true); setErr("");
    try {
      const q = buildQuery({ after: lastDocRef.current });
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, _ref: d, ...data, _method: inferMethod(data) };
      });
      setRowsRaw((prev) => [...prev, ...items]);
      setHasMore(snap.docs.length === pageSize);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
    } catch (e) {
      console.error(e);
      setErr("Gagal memuat halaman berikutnya.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirst();
    refreshCount();
    refreshStatusCounts();

  }, [pageSize, statusFilter, filterLevel]);

  function setRowMethod(id, val) {
    setRowsRaw((prev) => prev.map((r) => (r.id === id ? { ...r, _method: val } : r)));
  }

  async function handleUploadProof(id, file) {
    if (!file) return;
    try {
      setUploading((p) => ({ ...p, [id]: { busy: true, progress: 0 } }));
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `ppdb/payment_proofs/${id}-${Date.now()}.${ext}`;
      const task = uploadBytesResumable(sRef(storage, path), file, {
        cacheControl: "public,max-age=31536000",
      });
      task.on("state_changed", (snap) => {
        const prog = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploading((p) => ({ ...p, [id]: { busy: true, progress: prog } }));
      });
      await task;
      const url = await getDownloadURL(task.snapshot.ref);

      await updateDoc(doc(db, "users_app", id), {
        registrationPaymentProof: url,
        registrationPaymentProofAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setRowsRaw((prev) => prev.map((r) => (r.id === id ? { ...r, registrationPaymentProof: url } : r)));
      setOk("Bukti pembayaran berhasil diunggah.");
    } catch (e) {
      console.error(e);
      setErr("Gagal mengunggah bukti. Coba file lain atau periksa koneksi.");
    } finally {
      setUploading((p) => ({ ...p, [id]: { busy: false, progress: 0 } }));
    }
  }

  async function updateStatusVerified(id) {
    setErr(""); setOk("");
    try {
      const row = rowsRaw.find((r) => r.id === id);
      const method = row?._method || "offline";

      await updateDoc(doc(db, "users_app", id), {
        registrationPaymentStatus: "verified",
        registrationPaymentMethod: method,
        verifiedPayment: true,
        registrationPaymentVerifiedBy: adminEmail || "admin",
        registrationPaymentVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        accountEnabled: true,
      });

      // 🔔 Beritahu halaman agar buka WA
      try {
        window.dispatchEvent(new CustomEvent("spmb:payment:verified", {
          detail: {
            id,
            method,
            adminEmail,
            row: { ...row, _method: method }
          }
        }));
      } catch {}

      setRecap((p) => ({ ...p, [method]: (p[method] || 0) + 1 }));
      setRowsRaw((prev) => prev.filter((r) => r.id !== id));
      setOk(`${row?.fullName || id} → Terverifikasi (${method}).`);
    } catch (e) {
      console.error(e);
      setErr("Gagal memperbarui status.");
    }
  }

  function openConfirm(id) {
    setAskPwForId(id);
    setAskPwValue("");
    setAskPwErr("");
    setAskPwOpen(true);
  }
  function closeConfirm() {
    setAskPwOpen(false);
    setAskPwErr("");
    setAskPwForId(null);
    setAskPwValue("");
  }
  async function confirmAndVerify() {
    if (askPwValue !== String(CONFIRM_PW)) {
      setAskPwErr("Password konfirmasi salah.");
      return;
    }
    const id = askPwForId;
    closeConfirm();
    await updateStatusVerified(id);
  }

  function getRowDateMs(r) {
    const ts =
      r.verifiedPayment
        ? (r.registrationPaymentVerifiedAt || r.updatedAt || r.createdAt)
        : (r.createdAt || r.updatedAt);
    if (!ts) return null;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endMs   = endDate   ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    const filtered = rowsRaw.filter((r) => {
      if (statusFilter === "unapproved_all" && r.verifiedPayment === true) return false;
      if (filterMethod !== "all" && r._method !== filterMethod) return false;

      const hasProof = !!r.registrationPaymentProof;
      if (filterProof === "with" && !hasProof) return false;
      if (filterProof === "without" && hasProof) return false;

      if (filterLevel !== "all" && r.registrationLevel !== filterLevel) return false;

      if (s) {
        const uname = String(r.username || "").toLowerCase();
        const name  = String(r.fullName || "").toLowerCase();
        if (!uname.includes(s) && !name.includes(s)) return false;
      }

      if (startMs || endMs) {
        const ms = getRowDateMs(r);
        if (ms == null) return false;
        if (startMs && ms < startMs) return false;
        if (endMs && ms > endMs) return false;
      }

      // ===== Filter verifikator (hanya untuk 3 email privilege)
      if (canUseVerifierFilter) {
        const override = String(verifierQuery || "").trim().toLowerCase(); // input bebas
        const selected = verifierFilter !== "all" ? String(verifierFilter).toLowerCase() : ""; // dropdown
        const target = override || selected; // prioritas: input bebas > dropdown
        if (target) {
          const by = String(r?.registrationPaymentVerifiedBy || "").trim().toLowerCase();
          if (by !== target) return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const aHas = !!a.registrationPaymentProof;
      const bHas = !!b.registrationPaymentProof;
      if (aHas !== bHas) return aHas ? -1 : 1;

      const ams = getRowDateMs(a) ?? 0;
      const bms = getRowDateMs(b) ?? 0;
      return ams - bms;
    });
  // ⬇️ dependensi diperbarui agar filter verifikator bereaksi langsung
  }, [
    rowsRaw, filterMethod, filterProof, filterLevel,
    search, startDate, endDate,
    canUseVerifierFilter, verifierFilter, verifierQuery
  ]);

  // jumlah uang verified dummy lama (tidak dipakai untuk badge baru)
  const totalVerifiedAmount = useMemo(() => {
    const count = rows.filter((r) => r.verifiedPayment === true).length;
    return count * 200_000;
  }, [rows]);

  function canVerify(row) {
    // konsisten: verifikasi hanya bila SUDAH ADA BUKTI
    if (row.verifiedPayment === true) return false;
    if (!row.registrationPaymentProof) return false;
    if (statusFilter === "verified") return false;
    return true;
  }

  return {
    // data
    rows, rowsRaw, loading, err, ok, hasMore, recap, totalVerifiedAmount,
    totalRowsCount, totalVerifiedCount, totalPendingCount,

    // verifikator (dinamis & terproteksi)
    canUseVerifierFilter,
    verifierOptions,
    verifierFilter, setVerifierFilter,
    verifierQuery, setVerifierQuery,

    // controls
    pageSize, setPageSize, search, setSearch,
    statusFilter, setStatusFilter,
    filterMethod, setFilterMethod, filterProof, setFilterProof,
    filterLevel, setFilterLevel,
    startDate, setStartDate, endDate, setEndDate,

    // info (read-only)
    adminEmail,
    adminName: adminEmail,       // alias kompatibel
    setAdminName: () => {},      // no-op agar pemanggilan lama tidak error

    // actions
    loadFirst, loadMore, setRowMethod, handleUploadProof,
    openConfirm, closeConfirm, confirmAndVerify, canVerify,

    // modal state
    askPwOpen, askPwErr, askPwValue, setAskPwValue,

    // upload state
    uploading,

    // util
    cx,
  };
}
