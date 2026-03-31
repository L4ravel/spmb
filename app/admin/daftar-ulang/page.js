// app/admin/daftar-ulang/page.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  Users,
  UserSquare2,
  Filter,
  ChevronRight,
  Loader2,
  BadgeCheck,
  XCircle,
  ExternalLink,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { KonfirmasiPotonganPanel } from "./potongan";
import { PTKPanel } from "./ptk";
import { NonPTKPanel } from "./nonptk";

/* ==== Firebase init ==== */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

const PAGE_SIZES = [10, 25, 50];

function fmtIDR(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

/* ===== Normalizer status (panel kanan & kiri Non-PTK) ===== */
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
    if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s))
      return "approved";
    if (["REJECTED", "DENIED", "DECLINED"].includes(s)) return "rejected";
    return "pending";
  } catch {
    return "pending";
  }
}

/* ===== Klasifikasi metode pembayaran: OFFLINE (panitia) vs ONLINE (user) ===== */
function resolvePaymentMethod(pLike) {
  const method = String(pLike?.method || "").toUpperCase();
  const source = String(pLike?.source || "").toUpperCase();

  // Jika jelas ditandai OFFLINE atau dari panel admin → anggap offline
  if (method === "OFFLINE" || source === "ADMIN_PANEL") {
    return "OFFLINE";
  }

  // Kalau sudah ada flag ONLINE / GATEWAY, bisa kamu tambah di sini kalau perlu
  if (["ONLINE", "GATEWAY", "VIRTUAL_ACCOUNT", "TRANSFER"].includes(method)) {
    return "ONLINE";
  }

  // Default: anggap pembayaran dari user (online)
  return "ONLINE";
}

/* ========= MODAL ========= */
function ImageModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-black/60 rounded-lg flex flex-col"
        onClick={(e) => e.stopPropagation()} // klik di dalam modal tidak menutup
      >
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex-1 overflow-auto">
          <img
            src={imageUrl}
            alt="Bukti Pembayaran"
            className="w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}


/* ========= PANEL KANAN: Persetujuan Pembayaran ========= */
function PaymentsVerificationPanel({ db, selectedNisn, headerSuffix = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState("");
  const [viewImage, setViewImage] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); 
  const [confirmRow, setConfirmRow] = useState(null);
    const methodLabelConfirm = confirmRow ? resolvePaymentMethod(confirmRow) : null;
  const isOfflineConfirm = methodLabelConfirm === "OFFLINE";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAdminEmail(user?.email || "");
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const [statusFilter, setStatusFilter] = useState("pending"); // 'pending' | 'approved' | 'rejected' | 'all'
  const selectedKey = useMemo(() => String(selectedNisn ?? ""), [selectedNisn]);

  // ==== Tambahan: state input pembayaran offline ====
  const [offlineAmount, setOfflineAmount] = useState("");
  const [offlineNote, setOfflineNote] = useState("");
  const [offlineFile, setOfflineFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const passesFilter = useCallback(
    (docData) => {
      const s = normalizeStatus(docData);
      if (statusFilter === "all") return true;
      return s === statusFilter;
    },
    [statusFilter]
  );

  const mapDocs = useCallback(
    async (docs) => {
      const mapped = [];
      for (const d of docs) {
        const nisn = d.ref.parent.parent?.id || "";
        let student = null;
        if (nisn) {
          try {
            const u = await getDoc(doc(db, "users_app", nisn));
            if (u.exists()) {
              const ud = u.data() || {};
              student = {
                name: ud.fullName || ud.nama || ud.name || "",
                level: ud.registrationLevel || "",
              };
            }
          } catch {}
        }
        mapped.push({ id: d.id, nisn, student, ...d.data() });
      }
      return mapped;
    },
    [db]
  );

  const loadPage = useCallback(
    async (mode = "first", currentCursor = null) => {
      setLoading(true);
      try {
        let qref;
        if (selectedKey) {
          qref = query(
            collection(db, "users_app", selectedKey, "payments"),
            orderBy("createdAt", "desc"),
            limit(pageSize + 1)
          );
          if (mode === "next" && currentCursor) {
            qref = query(
              collection(db, "users_app", selectedKey, "payments"),
              orderBy("createdAt", "desc"),
              startAfter(currentCursor),
              limit(pageSize + 1)
            );
          }
        } else {
          qref = query(
            collectionGroup(db, "payments"),
            orderBy("createdAt", "desc"),
            limit(pageSize + 1)
          );
          if (mode === "next" && currentCursor) {
            qref = query(
              collectionGroup(db, "payments"),
              orderBy("createdAt", "desc"),
              startAfter(currentCursor),
              limit(pageSize + 1)
            );
          }
        }

        const snap = await getDocs(qref);
        const docs = snap.docs;

        setHasNext(docs.length > pageSize);
        const pageDocs = docs.slice(0, pageSize);

        const mapped = (await mapDocs(pageDocs)).filter(passesFilter);

        setRows(mapped);
        setCursor(pageDocs.length ? pageDocs[pageDocs.length - 1] : null);
      } finally {
        setLoading(false);
      }
    },
    [db, pageSize, selectedKey, mapDocs, passesFilter]
  );

  useEffect(() => {
    loadPage("first", null);
  }, [pageSize, selectedKey, statusFilter, loadPage]);

     const sendWaNotification = async (row, action) => {
    try {
      const nisn = row.nisn;
      if (!nisn) return;

      // Ambil data PPDB untuk dapatkan nomor WA wali
      const ppdbSnap = await getDoc(doc(db, "ppdb", nisn));
      if (!ppdbSnap.exists()) return;

      const p = ppdbSnap.data() || {};
      let rawWa =
        p.waliWa || p.waliHP || p.waliTelp || p.waWali || p.hpWali || "";
      if (!rawWa) return;

      // Ambil hanya digit
      let digits = String(rawWa).replace(/[^\d]/g, "");
      if (!digits) return;

      // Normalisasi: 08xx -> 62xx
      if (digits.startsWith("0")) {
        digits = "62" + digits.slice(1);
      }
      const phone = digits;

      const nama =
        row.student?.name ||
        p.namaSantri ||
        p.nama ||
        p.namaLengkap ||
        "-";
      const jenjang =
        row.student?.level ||
        p.registrationLevel ||
        p.jenjang ||
        p.tingkat ||
        "-";
      const amountText = fmtIDR(row.amount || 0);

      const statusKalimat =
        action === "approve"
          ? "telah DISETUJUI oleh panitia."
          : "BELUM DISETUJUI / DITOLAK oleh panitia. Silakan menghubungi panitia SPMB untuk informasi lebih lanjut.";

      const message =
        `Bismillah.\n\n` +
        `Pembayaran daftar ulang sebesar ${amountText} untuk peserta a.n. ${nama} ` +
        `(${jenjang}, NISN ${nisn}) ${statusKalimat}\n\n` +
        `Pesan ini dikirim otomatis oleh Panitia SPMB Pondok Asunnah Lombok.`;

      // ==== WA WEB: buka tab baru ====    
if (typeof window !== "undefined") {
  const url =
    "https://web.whatsapp.com/send?phone=" +
    phone +
    "&text=" +
    encodeURIComponent(message);
  window.open(url, "_blank", "noopener,noreferrer");
}


      // (Opsional) tetap tulis log ke Firestore
      await addDoc(collection(db, "wa_logs"), {
        to: phone,
        message,
        type:
          action === "approve"
            ? "payment:rereg_approved"
            : "payment:rereg_rejected",
        ref: `rereg_payment:${nisn}:${row.id}`,
        createdAt: serverTimestamp(),
        createdBy: adminEmail || null,
      });
    } catch (err) {
      console.error("Gagal membuat log / membuka WA pembayaran:", err);
    }
  };

    const confirmAndAct = (row, action) => {
    if (typeof window === "undefined") return;

    const isApprove = action === "approve";
    const message = isApprove
      ? "Apakah Anda yakin ingin MENYETUJUI pembayaran ini dan mengirim WhatsApp ke wali?"
      : "Apakah Anda yakin ingin MENOLAK pembayaran ini dan mengirim WhatsApp ke wali?";

    const ok = window.confirm(message);
    if (!ok) return;

    return act(row, action);
  };

   const openConfirm = (row, action) => {
    setConfirmRow(row);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleConfirmYes = async () => {
    if (!confirmRow || !confirmAction) {
      setConfirmOpen(false);
      return;
    }
    await act(confirmRow, confirmAction);
    setConfirmOpen(false);
    setConfirmRow(null);
    setConfirmAction(null);
  };

  const handleConfirmNo = () => {
    setConfirmOpen(false);
    setConfirmRow(null);
    setConfirmAction(null);
  };


  const act = async (row, action /* 'approve' | 'reject' */) => {
    // Pastikan auth sudah siap
    if (!authReady) {
      alert("Sedang memuat data login admin, coba lagi sebentar...");
      return;
    }

    // Wajib ada email admin yang login
    if (!adminEmail) {
      alert("Tidak bisa memproses: email admin login tidak ditemukan. Coba login ulang.");
      return;
    }

    try {
      setBusyId(row.id);
      const res = await fetch("/api/re_registration_payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nisn: row.nisn,
          paymentId: row.id,
          action,
          adminEmail,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Gagal memverifikasi pembayaran.");

      // ✅ setelah backend OK, buat log WA
      await sendWaNotification(row, action);

      await loadPage("first", null);
      
    } catch (e) {
      alert(e.message || "Gagal memproses.");
    } finally {
      setBusyId("");
    }
  };



  // ============ Tambahan: fungsi tambah pembayaran offline ============
  const handleAddOfflinePayment = async (e) => {
    e.preventDefault();
    if (!selectedKey) {
      alert("Pilih peserta dulu di panel kiri.");
      return;
    }

    const raw = String(offlineAmount || "").replace(/[^\d]/g, "");
    const amountNum = Number(raw || 0);

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      alert("Jumlah pembayaran tidak valid.");
      return;
    }

    try {
      setUploadBusy(true);

      let downloadURL = null;
      if (offlineFile) {
        const path = `re_registration_payments/${selectedKey}/${Date.now()}_${offlineFile.name}`;
        const fileRef = storageRef(storage, path);
        const snap = await uploadBytes(fileRef, offlineFile);
        downloadURL = await getDownloadURL(snap.ref);
      }

      const payload = {
        amount: amountNum,
        note: offlineNote || "Pembayaran offline (diinput admin)",
        status: "PENDING",
        method: "OFFLINE",        
        source: "ADMIN_PANEL",     
        createdAt: serverTimestamp(),
        ...(downloadURL ? { downloadURL } : {}),
      };

      await addDoc(
        collection(db, "users_app", selectedKey, "payments"),
        payload
      );

      setOfflineAmount("");
      setOfflineNote("");
      setOfflineFile(null);

      await loadPage("first", null);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Gagal menyimpan pembayaran offline.");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <>
    {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="modal-appear w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 text-center">
                Konfirmasi verifikasi pembayaran
              </h2>
            </div>

            <div className="px-8 py-6 text-base text-slate-700 space-y-4">
              <p className="text-center leading-relaxed">
                {confirmAction === "approve" ? (
                  <>
                    Apakah Anda yakin ingin{" "}
                    <span className="font-semibold">MENYETUJUI</span>{" "}
                    pembayaran ini dan mengirim WhatsApp ke wali?
                  </>
                ) : (
                  <>
                    Apakah Anda yakin ingin{" "}
                    <span className="font-semibold">MENOLAK</span>{" "}
                    pembayaran ini dan mengirim WhatsApp ke wali?
                  </>
                )}
              </p>

              {confirmRow && (
                <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-600 flex flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Peserta</span>
                    <span className="font-semibold text-slate-900">
                      {confirmRow.student?.name || "-"} ({confirmRow.nisn})
                    </span>
                  </div>

                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Jumlah</span>
                    <span className="font-semibold text-emerald-700">
                      {fmtIDR(confirmRow.amount || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-slate-500">Metode</span>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border",
                        isOfflineConfirm
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-sky-300 bg-sky-50 text-sky-800",
                      ].join(" ")}
                    >
                      {isOfflineConfirm ? "Offline (Panitia)" : "Online (User)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-slate-200 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleConfirmNo}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmYes}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors"
              >
                Ya, lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">
            Persetujuan Pembayaran {headerSuffix}{" "}
            {selectedKey ? `(NISN: ${selectedKey})` : ""}
            {" · "}
            <span className="font-normal text-slate-700">
              Filter:{" "}
              {statusFilter === "pending"
                ? "Pending"
                : statusFilter === "approved"
                ? "Disetujui"
                : statusFilter === "rejected"
                ? "Ditolak"
                : "Semua"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
              {[
                { key: "pending", label: "Pending" },
                { key: "approved", label: "Approved" },
                { key: "rejected", label: "Rejected" },
                { key: "all", label: "Semua" },
              ].map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setStatusFilter(it.key)}
                  className={[
                    "px-2.5 py-1.5 text-xs font-semibold",
                    statusFilter === it.key
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {it.label}
                </button>
              ))}
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 "
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadPage("first", null)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 text-black"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ===== Tambahan: Form input pembayaran offline (hanya jika ada NISN terpilih) ===== */}
        {selectedKey ? (
          <form
  onSubmit={handleAddOfflinePayment}
  className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 flex flex-col gap-2"
>
  <div className="flex items-center justify-between gap-2">
    <div className="text-xs font-semibold text-slate-800">
      Tambah Pembayaran Offline
    </div>
  </div>

  {/* Baris 1: Jumlah + Catatan */}
  <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-3">
    <div className="flex-1 flex flex-col gap-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Jumlah (IDR)"
        value={offlineAmount}
        onChange={(e) => setOfflineAmount(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
      {/* Preview SELALU muncul, default Rp 0 */}
      <span className="text-[11px] text-slate-500">
        Preview:{" "}
        <b>
          {fmtIDR(
            Number(
              String(offlineAmount || "")
                .replace(/[^\d]/g, "") || 0
            )
          )}
        </b>
      </span>
    </div>

    <div className="flex-1 flex flex-col">
      <input
        type="text"
        placeholder="Catatan (opsional)"
        value={offlineNote}
        onChange={(e) => setOfflineNote(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
  </div>

  {/* Baris 2: Upload + Tombol */}
  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3 md:flex-nowrap">
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2 md:flex-1">
      <label
        htmlFor="offline-file"
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 cursor-pointer hover:bg-slate-50"
      >
        Pilih Bukti Pembayaran (JPG/PNG)
      </label>
      <input
        id="offline-file"
        type="file"
        accept="image/*"
        onChange={(e) => setOfflineFile(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <span className="text-[11px] text-slate-500 truncate max-w-xs md:max-w-sm">
        {offlineFile ? offlineFile.name : "Belum ada file dipilih"}
      </span>
    </div>

    <div className="flex items-center justify-end md:shrink-0">
      <button
        type="submit"
        disabled={uploadBusy}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {uploadBusy && (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
        Simpan Pembayaran Offline
      </button>
    </div>
  </div>
</form>

        ) : null}

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-4 text-sm text-slate-700 inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-slate-700">
              Tidak ada data untuk filter ini.
            </div>
          ) : (
            rows.map((r) => {
              const s = normalizeStatus(r);
              const isPending = s === "pending";
              const showReviewer = s === "approved" && r.reviewer;
              const waAction =
    s === "approved" ? "approve" : s === "rejected" ? "reject" : null;
    const methodLabel = resolvePaymentMethod(r);
  const isOffline = methodLabel === "OFFLINE";
              return (
                <div
                  key={`${r.nisn}-${r.id}`}
                  className="p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
  <div className="text-sm font-semibold text-slate-900">
    {r.student?.name || "-"}{" "}
    <span className="text-slate-500 font-normal">
      ({r.nisn})
    </span>
    {showReviewer ? (
     <span className="ml-2 text-xs font-semibold text-violet-600">
  Reviewer: {r.reviewer}
</span>
    ) : null}
  </div>
  <div className="text-xs text-slate-600">
    {r.student?.level || "-"}
  </div>
</div>

                  <div className="flex items-center justify-between text-sm">
  <div className="flex flex-col gap-1 text-slate-700">
    <div className="flex items-center flex-wrap gap-2">
      <span>
        Jumlah: <b>{fmtIDR(r.amount)}</b>
      </span>

      {/* Badge metode pembayaran */}
      <span
        className={[
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
          isOffline
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-sky-300 bg-sky-50 text-sky-800",
        ].join(" ")}
      >
        {isOffline ? "Offline (Panitia)" : "Online (User)"}
      </span>
    </div>

    {r.note ? (
      <span className="text-[11px] text-slate-500">
        Catatan: {r.note}
      </span>
    ) : null}
  </div>

  {r.downloadURL ? (
    <button
      type="button"
      onClick={() => setViewImage(r.downloadURL)}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
    >
      Lihat Bukti <ExternalLink className="h-3.5 w-3.5" />
    </button>
  ) : null}
</div>

                  <div className="flex items-center gap-2">
  <button
    type="button"
    disabled={busyId === r.id || !isPending}
    onClick={() => openConfirm(r, "approve")}
    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
    title={isPending ? "" : "Sudah diproses"}
  >
    <BadgeCheck className="h-4 w-4" />
    Setujui
  </button>
  <button
    type="button"
    disabled={busyId === r.id || !isPending}
    onClick={() => openConfirm(r, "reject")}
    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white text-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60"
    title={isPending ? "" : "Sudah diproses"}
  >
    <XCircle className="h-4 w-4" />
    Tolak
  </button>

  {waAction && (
    <button
      type="button"
      onClick={() => sendWaNotification(r, waAction)}
      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100"
      title="Kirim ulang WhatsApp ke wali"
    >
      Kirim WA
    </button>
  )}
</div>

                </div>
              );
            })
          )}
        </div>

        {hasNext ? (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end">
            <button
              type="button"
              onClick={() => loadPage("next", cursor)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 text-black disabled:opacity-60"
              disabled={loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Modal Image Viewer */}
      <ImageModal imageUrl={viewImage} onClose={() => setViewImage(null)} />
    </>
  );
}

/* ===== helper: (SEKARANG TIDAK DIPAKAI UNTUK RENDER, HANYA JIKA KAMU BUTUH NANTI) ===== */
function hasSaudara(selected) {
  if (!selected) return false;
  const v =
    selected.saudara ??
    selected.siblings ??
    selected.siblingsCount ??
    selected.jumlahSaudara ??
    selected.saudaraDiSekolah ??
    "";
  if (typeof v === "number") return v > 0;
  const s = String(v || "").trim();
  if (!s || s === "-" || s === "–") return false;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(n)) return n > 0;
  return true;
}

/* ========= HALAMAN UTAMA ========= */
export default function AdminDaftarUlangPage() {
  const [view, setView] = useState("PTK"); // 'PTK' | 'NON_PTK'
  const [levels, setLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(true);

  const [pageSize, setPageSize] = useState(10);
  const [jenjangFilter, setJenjangFilter] = useState("");

  // Pisah selected per tab agar tidak bercampur
  const [selectedPTK, setSelectedPTK] = useState(null);
  const [selectedNonPTK, setSelectedNonPTK] = useState(null);

  // Toggle visibilitas panel Potongan (khusus PTK)
  const [showPotongan, setShowPotongan] = useState(true);

  // selected yang dipakai panel kanan mengikuti tab aktif
  const selected = view === "PTK" ? selectedPTK : selectedNonPTK;

  /* Ambil distinct registrationLevel */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingLevels(true);
        const seen = new Set();
        const batchSize = 200;
        let after = null;
        for (let i = 0; i < 5; i++) {
          let qref = query(
            collection(db, "users_app"),
            orderBy("registrationLevel"),
            orderBy("__name__"),
            limit(batchSize)
          );
          if (after) {
            qref = query(
              collection(db, "users_app"),
              orderBy("registrationLevel"),
              orderBy("__name__"),
              startAfter(after),
              limit(batchSize)
            );
          }
          const snap = await getDocs(qref);
          if (!alive || snap.empty) break;
          snap.docs.forEach((d) => {
            const lv = (d.data()?.registrationLevel || "").trim();
            if (lv) seen.add(lv);
          });
          after = snap.docs[snap.docs.length - 1];
          if (snap.size < batchSize) break;
        }
        alive &&
          setLevels(
            Array.from(seen).sort((a, b) =>
              (a || "").localeCompare(b || "", "id")
            )
          );
      } finally {
        alive && setLoadingLevels(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleAfterApprove = useCallback(() => {
    if (view === "PTK") {
      setSelectedPTK((s) => (s ? { ...s } : s));
    } else {
      setSelectedNonPTK((s) => (s ? { ...s } : s));
    }
  }, [view]);

  return (
    <div className="relative min-h-screen bg-slate-50/60 w-full pb-40">      
      <div className="fixed inset-0 -z-10 bg-slate-50/60" />
      <div className="px-4 pt-6 md:pt-8">
        <h1 className="text-xl md:2xl font-bold tracking-tight text-slate-900">
          Halaman verifikasi daftar ulang
        </h1>
        <p className="text-sm md:text-[15px] text-slate-700 mt-1">
          Pilih tab di kiri: PTK / Non-PTK.
        </p>
      </div>

      <div className="px-4 py-6 md:py-8 grid grid-cols-1 xl:grid-cols-5 gap-6 w-full">
        {/* Kiri */}
        <div className="xl:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 md:justify-between">
              {/* Toggle kiri */}
              <div className="flex items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setView("PTK")}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
                      view === "PTK"
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Daftar PTK
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("NON_PTK")}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
                      view === "NON_PTK"
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <UserSquare2 className="h-4 w-4" />
                    Non-PTK
                  </button>
                </div>

                {/* Toggle Potongan dari toolbar (khusus PTK) */}
                <button
                  type="button"
                  onClick={() => setShowPotongan((s) => !s)}
                  disabled={view !== "PTK"}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    view !== "PTK"
                      ? "border-slate-200 bg-white text-slate-400 cursor-not-allowed"
                      : showPotongan
                      ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                  title={
                    view !== "PTK"
                      ? "Hanya untuk tab PTK"
                      : showPotongan
                      ? "Sembunyikan Potongan"
                      : "Tampilkan Potongan"
                  }
                >
                  {showPotongan ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {showPotongan ? "Sembunyikan Potongan" : "Tampilkan Potongan"}
                </button>
              </div>

              {/* Filter kanan */}
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Filter className="h-4 w-4 text-slate-700" />
                  <select
                    value={jenjangFilter}
                    onChange={(e) => setJenjangFilter(e.target.value)}
                    className="bg-transparent text-sm outline-none text-slate-900"
                    disabled={loadingLevels}
                  >
                    <option value="">Semua Jenjang</option>
                    {levels.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                  {loadingLevels ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin text-slate-500" />
                  ) : null}
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-xs text-slate-700">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-transparent text-sm outline-none text-slate-900"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Panel Kiri per tab */}
            {view === "PTK" ? (
              <PTKPanel
                db={db}
                jenjangFilter={jenjangFilter}
                pageSize={pageSize}
                onRowSelect={setSelectedPTK}
              />
            ) : (
              <NonPTKPanel
                db={db}
                jenjangFilter={jenjangFilter}
                pageSize={pageSize}
                onRowSelect={setSelectedNonPTK}
              />
            )}
          </div>
        </div>

        {/* Kanan */}
        <div className="xl:col-span-2 space-y-6">
          {/* Potongan untuk PTK (pakai toggle) */}
          {view === "PTK" && showPotongan && selected ? (
            <KonfirmasiPotonganPanel
              db={db}
              selected={selected}
              onAfterApprove={handleAfterApprove}
              onRequestHide={() => setShowPotongan(false)} // sudah oke
            />
          ) : null}

          {/* Potongan untuk NON_PTK: selalu tampil saat ada selected; syarat saudara di-handle di potongan.js */}
          {view === "NON_PTK" && selected ? (
            <KonfirmasiPotonganPanel
              db={db}
              selected={selected}
              mode="NON_PTK"
              variant="NON_PTK"
              onAfterApprove={handleAfterApprove}
              onRequestHide={() => setSelectedNonPTK(null)} // ⬅️ TAMBAHAN
            />
          ) : null}

          {/* Persetujuan pembayaran */}
          <PaymentsVerificationPanel
            db={db}
            selectedNisn={selected?.nisn}
            headerSuffix={view === "NON_PTK" ? "· Non-PTK" : ""}
          />
        </div>
      </div>
    </div>
  );
}
