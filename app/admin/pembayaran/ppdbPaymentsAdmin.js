// lib/ppdbPaymentsAdmin.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, doc, getDocs, limit, orderBy, query,
  startAfter, where, updateDoc, serverTimestamp
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/** small util */
const cx = (...a) => a.filter(Boolean).join(" ");

/** ENV password konfirmasi (fallback '123' saat dev) */
const CONFIRM_PW =
  process.env.NEXT_PUBLIC_ADMIN_CONFIRM_PASSWORD ||
  process.env.NEXT_PUBLIC_CONFIRM_PASSWORD ||
  "123";

/** Tentukan metode awal dari data */
function inferMethod(row) {
  if (row.registrationPaymentMethod === "online" || row.registrationPaymentMethod === "offline") {
    return row.registrationPaymentMethod;
  }
  if (row.paymentMethod === "wa" || row.paymentMethod === "transfer") return "online";
  if (row.registrationPaymentProof) return "online";
  return "offline";
}

/** Hook utama admin pembayaran */
export function useAdminPayments() {
  // controls
  const [adminName, setAdminName] = useState("admin001");
  const [pageSize, setPageSize]   = useState(25); // number saja (10/25/50/100)
  const [search, setSearch]       = useState("");

  // filters
  const [statusFilter, setStatusFilter] = useState("pending"); // "pending" | "verified" | "all"
  const [filterMethod, setFilterMethod] = useState("all");     // all|online|offline
  const [filterProof, setFilterProof]   = useState("all");     // all|with|without
  const [filterLevel, setFilterLevel]   = useState("all");     // all|TK|SD|SMP|SMA|UNIVERSITAS
  // NEW: filter tanggal (YYYY-MM-DD)
  const [startDate, setStartDate] = useState(""); // inclusive
  const [endDate, setEndDate]     = useState(""); // inclusive (akhir hari)

  // data
  const [rowsRaw, setRowsRaw]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState("");
  const [ok, setOk]               = useState("");
  const [hasMore, setHasMore]     = useState(false);
  const lastDocRef = useRef(null);

  // rekap sesi
  const [recap, setRecap] = useState({ online: 0, offline: 0 });

  // modal konfirmasi
  const [askPwOpen, setAskPwOpen]   = useState(false);
  const [askPwForId, setAskPwForId] = useState(null);
  const [askPwValue, setAskPwValue] = useState("");
  const [askPwErr, setAskPwErr]     = useState("");

  // upload progress
  const [uploading, setUploading] = useState({}); // { [id]: {busy,progress} }

  /** Query builder (irit read) */
  function buildQuery({ after } = {}) {
    const coll = collection(db, "users_app");
    const parts = [];

    if (statusFilter === "pending") {
      parts.push(where("verifiedPayment", "==", false));
    } else if (statusFilter === "verified") {
      parts.push(where("verifiedPayment", "==", true));
    }

    if (filterLevel !== "all") {
      parts.push(where("registrationLevel", "==", filterLevel));
    }

    // Order tetap by username (netral untuk semua status),
    // filter tanggal kita lakukan di client agar tidak butuh composite index tambahan.
    parts.push(orderBy("username"));
    parts.push(limit(pageSize));
    if (after) parts.push(startAfter(after));

    return query(coll, ...parts);
  }

  /** Load pertama */
  async function loadFirst() {
    setErr(""); setOk(""); setLoading(true);
    lastDocRef.current = null;
    try {
      const q = buildQuery();
      const snap = await getDocs(q);
      const items = snap.docs.map(d => {
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

  /** Load berikutnya */
  async function loadMore() {
    if (!hasMore || !lastDocRef.current) return;
    setLoading(true); setErr("");
    try {
      const q = buildQuery({ after: lastDocRef.current });
      const snap = await getDocs(q);
      const items = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, _ref: d, ...data, _method: inferMethod(data) };
      });

      setRowsRaw(prev => [...prev, ...items]);
      setHasMore(snap.docs.length === pageSize);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
    } catch (e) {
      console.error(e);
      setErr("Gagal memuat halaman berikutnya.");
    } finally {
      setLoading(false);
    }
  }

  // 🔒 DEPENDENCY ARRAY STABIL: selalu 3 elemen tetap (irit read)
  useEffect(() => {
    loadFirst();
  }, [pageSize, statusFilter, filterLevel]);

  /** Set metode per-baris */
  function setRowMethod(id, val) {
    setRowsRaw(prev => prev.map(r => (r.id === id ? { ...r, _method: val } : r)));
  }

  /** Upload bukti untuk ONLINE */
  async function handleUploadProof(id, file) {
    if (!file) return;
    try {
      setUploading(prev => ({ ...prev, [id]: { busy: true, progress: 0 } }));

      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `ppdb/payment_proofs/${id}-${Date.now()}.${ext}`;
      const task = uploadBytesResumable(sRef(storage, path), file, {
        cacheControl: "public,max-age=31536000",
      });

      task.on("state_changed", (snap) => {
        const prog = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploading(prev => ({ ...prev, [id]: { busy: true, progress: prog } }));
      });

      await task;
      const url = await getDownloadURL(task.snapshot.ref);

      await updateDoc(doc(db, "users_app", id), {
        registrationPaymentProof: url,
        registrationPaymentProofAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setRowsRaw(prev => prev.map(r => (r.id === id ? { ...r, registrationPaymentProof: url } : r)));
      setOk("Bukti pembayaran berhasil diunggah.");
    } catch (e) {
      console.error(e);
      setErr("Gagal mengunggah bukti. Coba file lain atau periksa koneksi.");
    } finally {
      setUploading(prev => ({ ...prev, [id]: { busy: false, progress: 0 } }));
    }
  }

  /** Update verified (dipanggil setelah konfirmasi) */
  async function updateStatusVerified(id) {
    setErr(""); setOk("");
    try {
      const row = rowsRaw.find(r => r.id === id);
      const method = row?._method || "offline";

      const payload = {
        registrationPaymentStatus: "verified",
        registrationPaymentMethod: method,
        verifiedPayment: true,
        registrationPaymentVerifiedBy: adminName || "admin",
        registrationPaymentVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        accountEnabled: true,
      };

      await updateDoc(doc(db, "users_app", id), payload);

      setRecap(prev => ({ ...prev, [method]: (prev[method] || 0) + 1 }));
      setRowsRaw(prev => prev.filter(r => r.id !== id));
      setOk(`${row?.fullName || id} → Terverifikasi (${method}).`);
    } catch (e) {
      console.error(e);
      setErr("Gagal memperbarui status.");
    }
  }

  // ==== Modal helpers ====
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

  /** Helper waktu dari row untuk filter tanggal */
  function getRowDateMs(r) {
    // Kalau sudah diverifikasi → gunakan tanggal verifikasi.
    // Kalau belum → pakai createdAt (fallback updatedAt).
    const ts =
      r.verifiedPayment
        ? (r.registrationPaymentVerifiedAt || r.updatedAt || r.createdAt)
        : (r.createdAt || r.updatedAt);

    if (!ts) return null;
    // dukung Firestore Timestamp atau Date/string
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  /** Rows ter-filter (CLIENT-SIDE, irit read) */
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();

    // rentang ms
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endMs   = endDate   ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    const filtered = rowsRaw.filter(r => {
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

      return true;
    });

    // === SORTING SESUAI PERMINTAAN ===
    return filtered.sort((a, b) => {
      const aHas = !!a.registrationPaymentProof;
      const bHas = !!b.registrationPaymentProof;
      if (aHas !== bHas) return aHas ? -1 : 1; // bukti di atas

      const ams = getRowDateMs(a) ?? 0;
      const bms = getRowDateMs(b) ?? 0;
      return ams - bms; // tanggal lama → atas, terbaru → bawah
    });
  }, [rowsRaw, filterMethod, filterProof, filterLevel, search, startDate, endDate]);

  /** Total uang masuk (hanya verified) berdasarkan rows terfilter */
  const totalVerifiedAmount = useMemo(() => {
    const count = rows.filter(r => r.verifiedPayment === true).length;
    return count * 200_000; // Rp 200.000 per siswa
  }, [rows]);

  function canVerify(row) {
    if (row.verifiedPayment === true) return false;
    if (statusFilter === "verified") return false;
    return row._method === "offline" || !!row.registrationPaymentProof;
  }

  return {
    // data
    rows, rowsRaw, loading, err, ok, hasMore, recap, totalVerifiedAmount,

    // controls
    pageSize, setPageSize, search, setSearch, adminName, setAdminName,
    statusFilter, setStatusFilter,
    filterMethod, setFilterMethod, filterProof, setFilterProof,
    filterLevel, setFilterLevel,
    startDate, setStartDate, endDate, setEndDate,

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
