"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  ChevronLeft,
  AlertTriangle,
  UploadCloud,
  BadgeInfo,
  Pencil,
  ExternalLink,
  FileText,
  Wallet,
  Banknote,
  BadgeCheck,
  IdCard,
  GraduationCap,
  User2,
  Shirt,
  Info,
  X,
  Copy,
  PhoneCall,
} from "lucide-react";
import UploadBukti from "./uploud-bukti"; // samakan dengan Non-PTK

/* ---------------- Firebase (read-only on client) ---------------- */
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

/* ---------------- Utils ---------------- */
const fmtIDR = (n) =>
  typeof n === "number"
    ? n.toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      })
    : "-";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">
        {value ?? "-"}
      </span>
    </div>
  );
}

/* ——— UI mini samakan dengan Non-PTK ——— */
function Stat({ icon: Icon, label, value }) {
  return (
    <div className="group rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <div className="text-xs md:text-sm text-slate-600">{label}</div>
          <div className="text-xl md:text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 hover:bg-slate-50 transition-colors duration-200">
      <div className="flex items-center gap-2 text-[12px] md:text-[13px] text-slate-600">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1.5 text-base md:text-lg font-semibold text-slate-900 break-all">
        {value}
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
async function resolveNisn(db, raw) {
  const input = String(raw || "").trim();
  if (!input) return null;

  const d = await getDoc(doc(db, "users_app", input));
  if (d.exists())
    return {
      nisn: d.id,
      studentName:
        d.data()?.fullName || d.data()?.nama || d.data()?.name || "",
    };

  const q1 = query(
    collection(db, "users_app"),
    where("nins", "==", input),
    limit(1)
  );
  const s1 = await getDocs(q1);
  if (!s1.empty) {
    const x = s1.docs[0];
    return {
      nisn: x.id,
      studentName:
        x.data()?.fullName || x.data()?.nama || x.data()?.name || "",
    };
  }

  const q2 = query(
    collection(db, "users_app"),
    where("username", "==", input),
    limit(1)
  );
  const s2 = await getDocs(q2);
  if (!s2.empty) {
    const x = s2.docs[0];
    return {
      nisn: x.id,
      studentName:
        x.data()?.fullName || x.data()?.nama || x.data()?.name || "",
    };
  }
  return null;
}

/* status pembuktian pembayaran mengikuti Non-PTK */
function normalizeStatus(p) {
  const raw =
    (p?.status ||
      p?.paymentStatus ||
      p?.reviewStatus ||
      (p?.verified ? "VERIFIED" : "") ||
      (p?.approved ? "APPROVED" : "") ||
      "").toString();
  const s = raw.trim().toUpperCase();
  if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s))
    return "approved";
  if (["REJECTED", "DENIED", "DECLINED"].includes(s)) return "rejected";
  return "pending";
}
function isApproved(p) {
  return normalizeStatus(p) === "approved";
}

function TutorialPaymentModal({ open, onClose, amount }) {
  const [copied, setCopied] = useState(false);

  const waNumberDisplay = "0877 2024 2025";
  const waNumber = "6287720242025"; // format internasional untuk wa.me
  const waMessage = encodeURIComponent(
    "Assalamu'alaikum, saya ingin konfirmasi pembayaran SPMB. Berikut bukti pembayaran saya."
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waMessage}`;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  const rekeningRaw = "1111157778";
  const rekeningDisplay = "111 115 7778";

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(rekeningRaw);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // diam saja kalau gagal
    }
  };

  return (
    <div className="fixed inset-0 z-[99998]">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center px-3 md:px-4">
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
                <Info className="h-5 w-5 text-violet-700" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-slate-900">
                Tutorial Pembayaran
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-slate-100"
              aria-label="Tutup"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pt-4 pb-3 text-sm text-slate-700 space-y-3">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Buka aplikasi{" "}
                <span className="font-semibold">
                  m-banking / ATM / BSI / ke-Alfamart / Indomaret
                </span>{" "}
                terdekat.
              </li>
              <li>
                Transfer ke rekening:
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-slate-900">
                    Bank Syariah Indonesia a.n. Spmb Pas
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-slate-900 font-mono font-bold">
                      {rekeningDisplay}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? "Tersalin" : "Salin"}
                    </button>
                  </div>
                </div>
              </li>
              <li>
                Jumlah transfer:{" "}
                <span className="font-semibold text-slate-900">
                  {fmtIDR(Number(amount || 0))}
                </span>{" "}
                <span className="text-slate-600 italic">
                  (Jika belum bisa bayar lunas, silahkan konfirmasi terlebih dahulu ke pantia untuk membuat perjanjian).
                </span>
              </li>
              <li>
                Simpan struk / screenshot bukti pembayaran dari ATM /
                m-banking / kasir.
              </li>
              <li>
                Kembali ke halaman ini, klik{" "}
                <span className="font-semibold">Upload Bukti</span> lalu pilih
                file bukti pembayaran.
              </li>
              <li>
                Setelah terunggah, klik{" "}
               <span className="font-semibold">Konfirmasi WA</span> (untuk mempercepat proses verifikasi)
              </li>
              <li className="space-y-2">
              
                  Kirim bukti pembayaran ke panitia melalui WhatsApp dengan klik
                  tombol nomor berikut:
              

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.open(waUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 shadow-sm hover:bg-emerald-100 hover:border-emerald-400 transition"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                      <PhoneCall className="h-3.5 w-3.5 text-emerald-700" />
                    </span>

                    <span className="flex flex-col items-center">
                      <span className="text-[9px] font-medium uppercase tracking-wide text-emerald-700">
                        WhatsApp Panitia
                      </span>
                      <span className="text-sm md:text-[12px] font-semibold text-emerald-900">
                        {waNumberDisplay}
                      </span>
                    </span>
                  </button>
                </div>
              </li>
            </ol>

            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Verifikasi oleh panitia berlangsung sekitar 1–3 hari kerja. Jika
              ada kendala, hubungi panitia via WA.
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 transition"
            >
              Mengerti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function FormPTK({
  onBack,
  onOpenUniform,
  uniformFilled = false,
}) {
  const params = useParams();
  const router = useRouter();
  const paramInput = useMemo(() => {
    const p = params || {};
    return (p?.nisn || p?.nins || p?.username || "").toString();
  }, [params]);

  const [resolved, setResolved] = useState(null);
  const nisn = resolved?.nisn || "";

  const [studentName, setStudentName] = useState("");
  const [ptk, setPTK] = useState(null);

  const [registrationLevel, setRegistrationLevel] = useState("");
  const [fees, setFees] = useState(null);
  const [discount, setDiscount] = useState(null);

  // 📍 Samakan lokasi bukti dengan Non-PTK: users_app/{nisn}/payments
  const PAYMENT_SUBCOL = "payments";
  const [payments, setPayments] = useState([]);
  const [paymentsNote, setPaymentsNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingFees, setLoadingFees] = useState(false);
  const [loadingPay, setLoadingPay] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // resolve akun
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await resolveNisn(db, paramInput);
        if (!alive) return;
        if (!r) {
          setLoading(false);
          return;
        }
        setResolved(r);
        setStudentName(r.studentName || "");

        // users_app (nama & registrationLevel)
        const uSnap = await getDoc(doc(db, "users_app", r.nisn));
        if (uSnap.exists()) {
          const ud = uSnap.data() || {};
          setStudentName(
            ud?.fullName || ud?.nama || ud?.name || r.studentName || ""
          );
          setRegistrationLevel(ud?.registrationLevel || "");
        } else {
          setRegistrationLevel("");
        }

        // konfirmasi PTK dari API
        const res = await fetch(
          `/api/ptk/confirm?nisn=${encodeURIComponent(r.nisn)}`
        );
        if (res.ok) {
          const j = await res.json();
          if (alive && j?.exists && j?.data) setPTK({ ...j.data });
          if (!studentName && j?.student?.name) setStudentName(j.student.name);
        }
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [paramInput]);

  // pengaturan khusus PTK (diskon) — tetap dipakai menghitung total dasar
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!nisn) return;
      const dref = doc(
        db,
        "users_app",
        nisn,
        "re_registration",
        "ptk_discount"
      );
      const ds = await getDoc(dref);
      if (!alive) return;
      setDiscount(ds.exists() ? { id: ds.id, ...ds.data() } : null);
    })();
    return () => {
      alive = false;
    };
  }, [db, nisn]);

  // biaya: label == registrationLevel (sama dengan Non-PTK)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!nisn || ptk?.status !== "APPROVED" || !registrationLevel) {
        setFees(null);
        return;
      }
      try {
        setLoadingFees(true);
        const q1 = query(
          collection(db, "re_registration_fees"),
          where("label", "==", registrationLevel),
          limit(1)
        );
        const s1 = await getDocs(q1);
        if (!alive) return;
        setFees(!s1.empty ? { id: s1.docs[0].id, ...s1.docs[0].data() } : null);
      } finally {
        alive && setLoadingFees(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, nisn, ptk?.status, registrationLevel]);

  // payments (baca dari users_app/{nisn}/payments)
  const refreshPayments = useCallback(async () => {
    setPaymentsNote("");
    if (ptk?.status !== "APPROVED" || !nisn) return;
    try {
      setLoadingPay(true);
      const col = collection(db, "users_app", nisn, PAYMENT_SUBCOL);
      const qy = query(col, orderBy("createdAt", "desc"), limit(50));
      const s = await getDocs(qy);
      setPayments(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setPayments([]);
      setPaymentsNote(
        "Bukti tersimpan, namun belum diizinkan untuk ditampilkan di aplikasi ini."
      );
    } finally {
      setLoadingPay(false);
    }
  }, [db, nisn, ptk?.status]);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  const goConfirm = useCallback(() => {
    const key = paramInput || nisn;
    router.push(`/daftar-ulang/${encodeURIComponent(key)}/confirm-ptk`);
  }, [router, paramInput, nisn]);

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else router.back();
  }, [onBack, router]);

  /* ---------- Perhitungan total ala Non-PTK (tetap menghitung aturan PTK lebih dulu) ---------- */
    const baseSPP = typeof fees?.spp === "number" ? fees.spp : 0;
  const totalPangkalBefore = Object.values(fees?.uangPangkal || {}).reduce(
    (a, n) => a + (typeof n === "number" ? n : 0),
    0
  );

  // Dukungan potongan ganda PTK: BP3, SPP, atau BP3+SPP
  const discType = (discount?.type || "").toUpperCase();
  const discAmount = Number(discount?.amount || 0);

  // Ambil potongan BP3 & SPP:
  // - kalau ada amountBP3 / amountSPP: pakai itu
  // - kalau data lama (hanya BP3 *atau* SPP): pakai amount tunggal
  const rawDiscBP3 =
    discount?.amountBP3 ??
    (discType.includes("BP3") && !discType.includes("SPP") ? discAmount : 0);

  const rawDiscSPP =
    discount?.amountSPP ??
    (discType.includes("SPP") && !discType.includes("BP3") ? discAmount : 0);

  const cutPangkal = Math.max(
    0,
    Math.min(totalPangkalBefore, Number(rawDiscBP3) || 0)
  );
  const cutSPP = Math.max(
    0,
    Math.min(baseSPP, Number(rawDiscSPP) || 0)
  );

  const netSPP = Math.max(0, baseSPP - cutSPP);
  const netPangkal = Math.max(0, totalPangkalBefore - cutPangkal);
  const totalPembayaran = Math.max(0, netSPP + netPangkal);

  // hanya approved yang mengurangi
  const totalTerverifikasi = useMemo(
    () =>
      payments.reduce((acc, p) => {
        const amt = Number(p?.amount || 0);
        return acc + (isApproved(p) && Number.isFinite(amt) ? amt : 0);
      }, 0),
    [payments]
  );

  const sisaTagihan = useMemo(
    () =>
      Math.max(
        0,
        (Number(totalPembayaran) || 0) - (Number(totalTerverifikasi) || 0)
      ),
    [totalPembayaran, totalTerverifikasi]
  );

  const isPending = !loading && ptk?.status !== "APPROVED";
  const showEditButton =
    ptk?.jenjang && !(ptk?.status === "APPROVED" || !!fees);

  const hasDiscount =
    discount &&
    (cutPangkal > 0 ||
      cutSPP > 0 ||
      (Number(discount.amount || 0) > 0 && discount.type));

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </button>
          <div>
            <h2 className="text-base md:text-lg font-bold leading-tight text-slate-900">
              Daftar Ulang — Anak PTK
            </h2>
            <p className="text-[12px] text-slate-600">
              Identitas siswa & status persetujuan pembayaran.
            </p>
          </div>
        </div>
        {registrationLevel ? (
          <span className="hidden md:inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold bg-emerald-50 border-emerald-200 text-emerald-700">
            {registrationLevel}
          </span>
        ) : null}
      </div>

      <div className="p-4 md:p-6">
        {/* Warning belum isi */}
        {!loading && !ptk?.jenjang && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div className="text-sm">
                <b>Konfirmasi belum lengkap.</b> Isi data orang tua/wali
                terlebih dahulu.
                <div className="mt-2">
                  <button
                    onClick={goConfirm}
                    className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Buka Halaman Konfirmasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status PENDING */}
        {!loading && ptk?.jenjang && isPending && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div className="text-sm">
                <b>Menunggu konfirmasi admin.</b> Pembayaran akan muncul
                setelah disetujui.
                <div className="mt-1 text-[12px] text-amber-900/90">
                  Status sekarang: <b>{ptk?.status || "PENDING"}</b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Identitas */}
        {ptk?.jenjang && (
          <div className="rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-slate-800">
                <BadgeInfo className="h-4 w-4" />
                <span className="text-sm font-semibold">Identitas</span>
              </div>
              {showEditButton && (
                <button
                  onClick={goConfirm}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  title="Edit data konfirmasi"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Konfirmasi
                </button>
              )}
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 mb-2">
                <Field icon={IdCard} label="NISN" value={nisn || "-"} />
                <Field
                  icon={User2}
                  label="Nama Lengkap"
                  value={studentName || "-"}
                />
                <Field
                  icon={GraduationCap}
                  label="Jenjang"
                  value={registrationLevel || "-"}
                />
              </div>
              <Row label="Nama Orang Tua" value={ptk?.parentName || "-"} />
              <Row label="NIK Orang Tua" value={ptk?.nik || "-"} />
              <Row label="Jabatan Orang Tua" value={ptk?.jabatan || "-"} />
              <Row label="Jenjang (info PTK)" value={ptk?.jenjang || "-"} />
            </div>
          </div>
        )}

        {/* Aksi: Ukuran Baju */}
        {ptk?.status === "APPROVED" && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4 my-4">
            <div className="flex items-center gap-2 text-[13px] text-slate-600 mb-3">
              <IdCard className="h-4 w-4" /> Aksi
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => (onBack ? onBack() : router.back())}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Kembali
              </button>

              {["SMP Putra", "SMA Putra", "SMP Putri", "SMA Putri"].includes(
                registrationLevel || ""
              ) ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenUniform && onOpenUniform(registrationLevel)
                  }
                  className={[
                    "w-full inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold shadow-sm transition-all",
                    uniformFilled
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                      : "bg-slate-900 hover:bg-black text-white border-slate-900",
                  ].join(" ")}
                >
                  {uniformFilled ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <Shirt className="h-4 w-4" />
                  )}
                  {uniformFilled
                    ? "Ukuran Baju: Sudah diisi"
                    : "Isi Ukuran Baju"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Hanya untuk jenjang SMP/SMA"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-500"
                >
                  <Shirt className="h-4 w-4" />
                  Isi Ukuran Baju
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ringkasan biaya (sesuai Non-PTK) */}
        {ptk?.status === "APPROVED" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <Stat
                icon={Wallet}
                label="SPP (per semester)"
                value={fmtIDR(netSPP)}
              />
              <Stat
                icon={Banknote}
                label="Total Uang Pangkal"
                value={fmtIDR(netPangkal)}
              />
            </div>

            {/* Total Tagihan + info potongan PTK */}
            <div className="mt-3 rounded-xl border-2 border-slate-300 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Total Tagihan
                </span>
                <span className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
                  {fmtIDR(totalPembayaran)}
                </span>
              </div>

              {hasDiscount && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-800">
                  <span>Potongan {discount.type} (anak PTK)</span>
                  <span className="font-semibold">
                    -{fmtIDR(Number(discount.amount || 0))}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-800 inline-flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  Terbayar (Terverifikasi)
                </span>
                <span className="text-lg md:text-xl font-extrabold tracking-tight text-emerald-900">
                  {fmtIDR(totalTerverifikasi)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-300 bg-white px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Sisa yang Harus Dibayar
                </span>
                <span className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900">
                  {fmtIDR(sisaTagihan)}
                </span>
              </div>
            </div>

            <p className="mt-1 text-[11px] text-slate-500">
              Nominal yang mengurangi tagihan hanyalah pembayaran yang sudah{" "}
              <b>disetujui admin</b>. Kiriman berstatus{" "}
              <i>Menunggu Konfirmasi</i> belum mengurangi total.
            </p>
          </>
        )}

        {/* Bukti Pembayaran — sama seperti Non-PTK */}
        {ptk?.status === "APPROVED" && (
          <div className="mt-3 rounded-xl border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/60">
              <div className="inline-flex items-center gap-2 text-slate-800">
                <UploadCloud className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Bukti Pembayaran Daftar Ulang
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end">
                <button
                  type="button"
                  onClick={() => setTutorialOpen(true)}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs md:text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <Info className="h-4 w-4" />
                  Tutorial Pembayaran
                </button>
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                >
                  Upload Bukti
                </button>
              </div>
            </div>

            <div className="p-4">
              {loadingPay ? (
                <p className="text-sm text-slate-500">Memuat bukti…</p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {paymentsNote || "Belum ada bukti pembayaran daftar ulang."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {payments.map((p) => {
                    const status = normalizeStatus(p);
                    const badge =
                      status === "approved"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : status === "rejected"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-amber-100 text-amber-800 border-amber-200";
                    const label =
                      status === "approved"
                        ? "Disetujui"
                        : status === "rejected"
                        ? "Ditolak"
                        : "Menunggu Konfirmasi";

                    return (
                      <li
                        key={p.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="mt-0.5">
                          <FileText className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-900 break-all">
                              {p.fileName || "bukti.pdf"}
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${badge}`}
                            >
                              {label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Jumlah:{" "}
                            <span className="font-semibold">
                              {fmtIDR(Number(p.amount || 0))}
                            </span>
                            {p.note ? (
                              <>
                                {" "}
                                · <span className="italic">{p.note}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {p.downloadURL ? (
                          <a
                            href={p.downloadURL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                          >
                            Lihat <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Modal Upload */}
            <UploadBukti
              open={uploadOpen}
              onClose={() => setUploadOpen(false)}
              onUploaded={() => {
                setUploadOpen(false);
                refreshPayments();
              }}
              nisn={String(nisn || "")}
            />

            <TutorialPaymentModal
              open={tutorialOpen}
              onClose={() => setTutorialOpen(false)}
              amount={totalPembayaran}
            />
          </div>
        )}
      </div>
    </section>
  );
}
