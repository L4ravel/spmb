"use client";

/** =========================
 *  INIT FIREBASE + EXPORT DB
 *  ========================= */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, collection, getDocs,
  query, where, limit as qLimit
} from "firebase/firestore";
import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useAdminPayments } from "./ppdbPaymentsAdmin";
import { sendWaKonfirmasi } from "./wa-konfirm";

function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}
export const app = getFirebaseApp();
export const db = getFirestore(app);

/** =========================
 *  HELPERS FORMAT & UTIL
 *  ========================= */
export const looksLikePdfUrl = (url = "") => /\.pdf(\?|#|$)/i.test(url);
export const classify = (meta) => {
  const ct = (meta?.contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.includes("pdf")) return "pdf";
  return "other";
};
export const getDocLabel = (k = "") =>
  String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toUpperCase();
export const toDateStr = (ts) => {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    if (!d) return "—";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch { return "—"; }
};
export function fmtIDR(n) {
  try { return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n); }
  catch { return `Rp ${String(n||0).replace(/\B(?=(\d{3})+(?!\d))/g,".")}`;}
}
const onlyDigits = (s = "") => String(s).replace(/[^\d]/g, "");
export function normalizeWa(raw) {
  const d = onlyDigits(raw || "");
  if (!d) return null;
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  return d;
}

/* ====== REVISI: tambahkan username & nisn (opsional) ke pesan ====== */
export function buildWaMessage({
  fullName,
  registrationId,
  registrationLevel,
  amount,
  method,
  username,   // NEW (opsional)
  nisn,       // NEW (opsional)
}) {
  const NAME = String(fullName || "").toUpperCase();
  const loginUrl = `${location.origin}/login`;
  const lines = [
    "Bismillah.",
    "",
    `Pembayaran pendaftaran *${registrationLevel}* atas nama *${NAME}* (ID: ${registrationId}) telah *DISETUJUI*.`,
    `Metode: ${String(method || "-").toUpperCase()}`,
    `Jumlah: ${fmtIDR(amount)}`,
  ];
  if (username) lines.push(`Username: *${username}*`);
  if (nisn) lines.push(`Password: *${nisn}*`);
  lines.push(`Login: ${loginUrl}`);
  lines.push(
    "",
    "Butuh Bantuan : 0877 2024 2025",
    "— Panitia SPMB"
  );
  return lines.join("\n");
}

/** =========================
 *  DATA FETCHERS
 *  ========================= */
export async function fetchPPDBDoc(nisn) {
  if (!nisn) return null;
  let data = null;
  let s = await getDoc(doc(db, "ppdb", String(nisn)));
  if (s.exists()) data = s.data();
  if (!data) {
    const q1 = query(collection(db, "ppdb"), where("nisn", "==", String(nisn)), qLimit(1));
    const d1 = await getDocs(q1);
    if (!d1.empty) data = d1.docs[0].data();
  }
  if (!data) {
    const q2 = query(collection(db, "ppdb"), where("identifier", "==", String(nisn)), qLimit(1));
    const d2 = await getDocs(q2);
    if (!d2.empty) data = d2.docs[0].data();
  }
  return data;
}

export async function fetchFeeByLevel(levelLabel) {
  if (!levelLabel) return { fee: 0, currency: "IDR", label: null };
  const qf = query(collection(db, "fees"), where("label", "==", String(levelLabel)), qLimit(1));
  const d = await getDocs(qf);
  if (!d.empty) {
    const f = d.docs[0].data();
    return { fee: Number(f?.fee ?? 0), currency: String(f?.currency || "IDR"), label: String(f?.label || levelLabel) };
  }
  return { fee: 0, currency: "IDR", label: String(levelLabel) };
}

/* ========= NEW: fetch users_app/{nisn} utk ambil registrationPaymentMethod ========= */
export async function fetchUsersAppPaymentMeta(nisn) {
  if (!nisn) return null;

  // 1) id dok = nisn
  let snap = await getDoc(doc(db, "users_app", String(nisn)));
  if (snap.exists()) return snap.data();

  // 2) cari via field nisn
  const q1 = query(collection(db, "users_app"), where("nisn", "==", String(nisn)), qLimit(1));
  const d1 = await getDocs(q1);
  if (!d1.empty) return d1.docs[0].data();

  // 3) fallback: identifier
  const q2 = query(collection(db, "users_app"), where("identifier", "==", String(nisn)), qLimit(1));
  const d2 = await getDocs(q2);
  if (!d2.empty) return d2.docs[0].data();

  return null;
}

/** =========================
 *  SIDE EFFECT: KIRIM WA SETELAH VERIFIKASI
 *  ========================= */
export function useVerifiedWaEffect() {
  const sentSetRef = useRef(new Set());

  useEffect(() => {
    async function getPPDB(nisn) {
      return await fetchPPDBDoc(nisn);
    }
    async function getFee(level) {
      const qs = await getDocs(query(collection(db, "fees"), where("label", "==", String(level)), qLimit(1)));
      return qs.empty ? 0 : Number(qs.docs[0].data()?.fee || 0);
    }
    function openWhatsAppSafe({ phone62, text }) {
      const encoded = encodeURIComponent(text);
      const isiDesktop = `https://web.whatsapp.com/send?phone=${phone62}&text=${encoded}`;
      const isiApi = `https://api.whatsapp.com/send?phone=${phone62}&text=${encoded}`;
      const isiMobile = `whatsapp://send?phone=${phone62}&text=${encoded}`;
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const url = isMobile ? isiMobile : isiDesktop;
      const delay = 120 + Math.floor(Math.random() * 300);
      setTimeout(() => {
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!isMobile && (!win || win.closed)) {
          setTimeout(() => window.open(isiApi, "_blank", "noopener,noreferrer"), 200);
        }
      }, delay);
    }

    async function onVerified(e) {
      const detail = e?.detail || {};
      const r = detail.row || {};
      const nisn = r.username || r.id;
      if (!nisn) return;

      const key = `${nisn}-${r.registrationId || "RID"}-${r._method || "M"}`;
      if (sentSetRef.current.has(key)) return;
      sentSetRef.current.add(key);

      try {
        const level = r.registrationLevel || "-";
        const amount = await getFee(level);
        const res = await sendWaKonfirmasi({
          nisn,
          registrationId: r.registrationId,
          fullName: r.fullName,
          registrationLevel: level,
          amount,
          method: r._method,
        });
        if (!res?.ok) throw new Error(res?.reason || "Gateway gagal");
      } catch {
        try {
          const p = await getPPDB(nisn);
          const rawWa = p?.waliWa || p?.ayahTelp || p?.waliTelp || "";
          const phone62 = normalizeWa(rawWa);
          if (!phone62) return;
          const level = r.registrationLevel || "-";
          const amount = await getFee(level);
          /* REVISI: sertakan username & nisn ke pesan fallback */
          const text = buildWaMessage({
            fullName: r.fullName,
            registrationId: r.registrationId,
            registrationLevel: level,
            amount,
            method: r._method,
            username: r?.username || nisn, // kalau ada username, pakai; fallback ke nisn
            nisn,                          // selalu kirimkan nisn
          });
          openWhatsAppSafe({ phone62, text });
        } catch (fallbackErr) {
          console.error("Fallback WhatsApp gagal:", fallbackErr);
        }
      }
    }

    window.addEventListener("spmb:payment:verified", onVerified);
    return () => window.removeEventListener("spmb:payment:verified", onVerified);
  }, []);
}

/** =========================
 *  PRIVILEGED EMAILS (bisa lihat total global)
 *  ========================= */
const ALLOWED_VERIFIER_EMAILS = [
  "abdurrahman.man.88@gmail.com",
  "wirasandilalu12@gmail.com",
  "usmanirawan00@gmail.com",
].map((e) => e.toLowerCase());

/** =========================
 *  LOGIC AGREGASI & FILTER (di atas hook data)
 *  ========================= */
export function usePembayaranLogic() {
  const base = useAdminPayments();

  // cache meta PPDB & fee per jenjang
  const [ppdbMap, setPpdbMap] = useState({});
  const [loadingPPDB, setLoadingPPDB] = useState({});
  const [feesMap, setFeesMap] = useState({}); // { [labelJenjang]: {fee,currency,label} }

  // NEW: cache users_app utk registrationPaymentMethod
  const [userAppMap, setUserAppMap] = useState({});        // { [nisn]: users_app doc }
  const [loadingUserApp, setLoadingUserApp] = useState({}); // { [nisn]: boolean }

  // prefetch fee per jenjang yang muncul di halaman (irit read)
  useEffect(() => {
    const seen = new Set();
    base.rows.slice(0, base.pageSize).forEach((r) => {
      const lv = r.registrationLevel;
      if (lv && !seen.has(lv) && !feesMap[lv]) {
        seen.add(lv);
        fetchFeeByLevel(lv).then((f) => {
          setFeesMap((m) => ({ ...m, [lv]: f }));
        });
      }
    });
  }, [base.rows, base.pageSize]); // feesMap diabaikan agar prefetch tidak loop

  // NEW: prefetch users_app.registrationPaymentMethod utk baris yang tampil
  useEffect(() => {
    const seen = new Set();
    base.rows.slice(0, base.pageSize).forEach((r) => {
      const nisn = String(r?.username || r?.id || r?.nisn || "").trim();
      if (!nisn) return;
      if (!seen.has(nisn) && !userAppMap[nisn] && !loadingUserApp[nisn]) {
        seen.add(nisn);
        setLoadingUserApp((s) => ({ ...s, [nisn]: true }));
        fetchUsersAppPaymentMeta(nisn)
          .then((d) => { if (d) setUserAppMap((m) => ({ ...m, [nisn]: d })); })
          .finally(() => setLoadingUserApp((s) => ({ ...s, [nisn]: false })));
      }
    });
  }, [base.rows, base.pageSize, userAppMap, loadingUserApp]);

  const getFeeCached = useCallback(async (level) => {
    if (!level) return { fee: 0, currency: "IDR", label: null };
    if (feesMap[level]) return feesMap[level];
    const f = await fetchFeeByLevel(level);
    setFeesMap((m) => ({ ...m, [level]: f }));
    return f;
  }, [feesMap]);

  const fetchPPDB = useCallback(async (nisn) => {
    if (!nisn) return null;
    if (ppdbMap[nisn]) return ppdbMap[nisn];
    if (loadingPPDB[nisn]) return ppdbMap[nisn] ?? null;
    setLoadingPPDB((s) => ({ ...s, [nisn]: true }));
    try {
      const data = await fetchPPDBDoc(nisn);
      setPpdbMap((m) => ({ ...m, [nisn]: data }));
      return data;
    } finally {
      setLoadingPPDB((s) => ({ ...s, [nisn]: false }));
    }
  }, [ppdbMap, loadingPPDB]);

  // opsi jenjang langsung dari rows (irit read)
  const levelOptions = useMemo(() => {
    const s = new Set();
    base.rows.forEach((r) => { if (r.registrationLevel) s.add(r.registrationLevel); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
  }, [base.rows]);

  // ======== Visibility rules (privilege vs non-privilege) ========
  const getFeeForRow = useCallback((r) => {
    const lv = r.registrationLevel;
    const fee = lv ? feesMap[lv]?.fee : undefined;
    return Number(fee ?? 0);
  }, [feesMap]);

  const verifiedRows = useMemo(
    () => base.rows.filter((r) => r.verifiedPayment === true),
    [base.rows]
  );

  const myKey = String(base.adminEmail || "").toLowerCase();
  const isPrivileged = ALLOWED_VERIFIER_EMAILS.includes(myKey);

  const privilegedTargeting = useMemo(() => {
    const hasTarget =
      String(base.verifierQuery || "").trim() !== "" ||
      base.verifierFilter !== "all";
    return base.canUseVerifierFilter && hasTarget;
  }, [base.canUseVerifierFilter, base.verifierQuery, base.verifierFilter]);

  const visibleRows = useMemo(() => {
    if (isPrivileged && privilegedTargeting) return base.rows;
    // NEW: bila status "all" → tampilkan semua baris apa adanya
    if (String(base.statusFilter || "all") === "all") return base.rows;

    return base.rows.filter((r) => {
      const isVerified = r?.verifiedPayment === true;
      if (!isVerified) return true; // pending → semua bisa lihat
      const by = String(r?.registrationPaymentVerifiedBy || "").toLowerCase();
      return by === myKey;
    });
  }, [base.rows, myKey, isPrivileged, privilegedTargeting, base.statusFilter]);

  const filteredRows = visibleRows;

  // ======== Agregasi khusus: jumlah terverifikasi per verifikator ========
  const verifiedCountByVerifier = useMemo(() => {
    const map = {};
    for (const r of verifiedRows) {
      const by = String(r?.registrationPaymentVerifiedBy || "").trim().toLowerCase();
      if (!by) continue;
      map[by] = (map[by] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [verifiedRows]);

  // ======== Nominal untuk verifikator / privileged ========
  const verifiedRowsByMe = useMemo(
    () => verifiedRows.filter((r) => String(r?.registrationPaymentVerifiedBy || "").toLowerCase() === myKey),
    [verifiedRows, myKey]
  );

  const sourceRows = useMemo(
    () => (isPrivileged ? verifiedRows : verifiedRowsByMe),
    [isPrivileged, verifiedRows, verifiedRowsByMe]
  );

  /* ========= NEW: resolver metode dari users_app SAJA ========= */
  const methodForRow = useCallback((r) => {
    const nisn = String(r?.username || r?.id || r?.nisn || "").trim();
    const mUsersApp = String(userAppMap?.[nisn]?.registrationPaymentMethod || "").toLowerCase();
    // hanya terima "online" / "offline"; selain itu unknown
    if (mUsersApp === "online" || mUsersApp === "offline") return mUsersApp;
    return ""; // unknown → tidak dihitung di online/offline
  }, [userAppMap]);

  /* ========= REVISI: hitung nominal pakai method dari users_app SAJA ========= */
  const onlineAmount  = useMemo(
    () => sourceRows
      .filter((r) => methodForRow(r) === "online")
      .reduce((s, r) => s + getFeeForRow(r), 0),
    [sourceRows, methodForRow, getFeeForRow]
  );

  const offlineAmount = useMemo(
    () => sourceRows
      .filter((r) => methodForRow(r) === "offline")
      .reduce((s, r) => s + getFeeForRow(r), 0),
    [sourceRows, methodForRow, getFeeForRow]
  );

  const totalDynamicAmount = useMemo(() => onlineAmount + offlineAmount, [onlineAmount, offlineAmount]);

  // ======== Total jumlah siswa sesuai filter verifikator (ikut filteredRows) ========
  const selectedVerifier = useMemo(() => {
    const v = String(base.verifierFilter || "all").trim().toLowerCase();
    return v === "all" ? null : v;
  }, [base.verifierFilter]);

  const rowsBySelectedVerifier = useMemo(() => {
    const src = filteredRows;
    if (!selectedVerifier) return src;
    return src.filter(
      (r) => String(r?.registrationPaymentVerifiedBy || "").toLowerCase() === selectedVerifier
    );
  }, [filteredRows, selectedVerifier]);

  const totalVerifiedByVerifier = useMemo(
    () => rowsBySelectedVerifier.filter((r) => r?.verifiedPayment === true).length,
    [rowsBySelectedVerifier]
  );
  const totalPendingByVerifier = useMemo(
    () =>
      rowsBySelectedVerifier.filter(
        (r) => String(r?.registrationPaymentStatus || "") === "waiting_review"
      ).length,
    [rowsBySelectedVerifier]
  );
  const totalSiswaByVerifier = useMemo(
    () => rowsBySelectedVerifier.length,
    [rowsBySelectedVerifier]
  );

  // hak melihat nominal pada modal bukti (behavior lama dipertahankan)
  const canSeeAmount = useCallback((row) => {
    return row?.verifiedPayment === true &&
      String(row?.registrationPaymentVerifiedBy || "").toLowerCase() === myKey;
  }, [myKey]);

  return {
    // re-export semua dari hook data (source of truth)
    ...base,

    // cache & loaders tambahan
    ppdbMap, loadingPPDB, feesMap,
    // expose meta users_app (berguna debugging)
    userAppMap, loadingUserApp,

    // computed utk UI
    levelOptions, filteredRows,
    getFeeForRow, onlineAmount, offlineAmount, totalDynamicAmount,

    // >>> rekap terverifikasi per verifikator <<<
    verifiedCountByVerifier,

    // >>> total berbasis filter verifikator <<<
    totalSiswaByVerifier,
    totalVerifiedByVerifier,   // (tetap ada untuk yang berbasis visibleRows)
    totalPendingByVerifier,    // (tetap ada untuk yang berbasis visibleRows)
    // >>> angka global (tidak terpengaruh pagination)
    totalVerifiedGlobal: base.totalVerifiedCount,
    totalPendingGlobal:  base.totalPendingCount,
    totalAllRowsCount: base.totalRowsCount,

    // fetchers
    fetchPPDB, getFeeCached,

    // permission
    canSeeAmount,
  };
}
