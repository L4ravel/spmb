// form-nonptk.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  orderBy,
  setDoc, // (biarkan import ini walau tidak dipakai, agar tidak mengubah struktur lain)
  deleteDoc,
} from "firebase/firestore";
import {
  User2,
  IdCard,
  GraduationCap,
  Wallet,
  Banknote,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Shirt,
  Upload,
  FileText,
  ExternalLink,
  BadgeCheck,
  ShieldCheck,
  Info,
  X,
  AlertCircle,
  Users,
  Save,
  Plus,
  Trash2,
  Copy,
  PhoneCall, 
} from "lucide-react";
import UploadBukti from "./uploud-bukti";

/* ---------------- Firebase bootstrap ---------------- */
function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApps()[0] : initializeApp(cfg);
}

const fmtIDR = (n) =>
  typeof n === "number"
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(n)
    : "-";

/* ---------------------------------- UI ---------------------------------- */
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

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-56 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-28 bg-slate-200 rounded-xl" />
        <div className="h-28 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

/* --------------------------- Helper status --------------------------- */
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

/* ---------------------- Modal: Pemberitahuan Anak PTK ---------------------- */
function PTKNoticeModal({ open, onClose, info = {} }) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const handleNavigate = () => {
    if (navigating) return;
    setNavigating(true);
    router.push("/portal");
  };

  if (!open) return null;

  const s = String(info.status || "").toLowerCase();
  const status =
    s.includes("approve") || s.includes("verify") || s === "approved"
      ? "approved"
      : s.includes("reject") || s === "rejected"
      ? "rejected"
      : "pending";

  const statusView =
    status === "approved"
      ? {
          icon: (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ),
          text: "Status: Disetujui",
          cls: "text-emerald-700",
        }
      : status === "pending"
      ? {
          icon: (
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          ),
          text: "Status: Menunggu Konfirmasi",
          cls: "text-amber-700",
        }
      : {
          icon: <X className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />,
          text: "Status: Ditolak/Non-PTK",
          cls: "text-red-700",
        };

  return (
    <div className="fixed inset-0 z-[99999]">
      <div
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
        onClick={handleNavigate}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ptk-title"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-700" />
              </div>
              <h3
                id="ptk-title"
                className="text-base md:text-lg font-bold text-slate-900"
              >
                Data Terdeteksi Anak PTK
              </h3>
            </div>
            <button
              onClick={handleNavigate}
              aria-label="Tutup"
              className="p-2 rounded-md hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <ShieldCheck className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-slate-700">
                Sistem mendeteksi bahwa data Anda <b>termasuk Anak PTK</b>.
                {(info.parentName || info.parent_name) && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <div className="font-semibold">
                      Orang Tua: {info.parentName || info.parent_name}
                    </div>
                    {info.jabatan ? (
                      <div className="text-xs mt-0.5">
                        Jabatan: {info.jabatan}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-slate-700">
                Untuk Daftar Ulang, silakan gunakan fitur Anak PTK agar
                ketentuan PTK diterapkan dengan benar. Jika bukan Anak PTK,
                mohon konfirmasi ke panitia.
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs">
              {statusView.icon}
              <span className={`${statusView.cls} font-semibold`}>
                {statusView.text}
              </span>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleNavigate}
              disabled={navigating}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {navigating ? "Memuat..." : "Mengerti"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
              <li className="space-y-1">
  
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


/* --------------------------- Komponen Utama --------------------------- */
export default function FormNonPTK({
  onBack,
  onOpenUniform,
  uniformFilled = false,
}) {
  const { nins } = useParams();
  const nisnFromUrl = Array.isArray(nins) ? nins[0] : nins;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [fees, setFees] = useState(null);
const [discount, setDiscount] = useState(null);
const [ayahIncomeEmpty, setAyahIncomeEmpty] = useState(false);
  

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false); 

  // PTK notice
  const [showPTKNotice, setShowPTKNotice] = useState(false);
  const [ptkInfo, setPtkInfo] = useState({
    status: "pending",
    parentName: "",
    jabatan: "",
  });

  // 🧩 Data Saudara (opsional, MULTI)
  const [hasSibling, setHasSibling] = useState(false);
  const [siblings, setSiblings] = useState([]);
  const [savingSibling, setSavingSibling] = useState(false);
  const [savedSiblingAt, setSavedSiblingAt] = useState(0);

  const getFirebaseDb = () => getFirestore(getFirebaseApp());

  const loadPayments = useCallback(async (nisn) => {
    try {
      setLoadingPayments(true);
      const db = getFirebaseDb();
      const qy = query(
        collection(db, "users_app", String(nisn), "payments"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPayments(rows);
    } catch (_) {
      // silent
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const loadDiscount = useCallback(async (nisn) => {
    try {
      const db = getFirebaseDb();
      const ref = doc(
        db,
        "users_app",
        String(nisn),
        "re_registration",
        "nonptk_discount"
      );
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setDiscount({ id: snap.id, ...snap.data() });
      } else {
        setDiscount(null);
      }
    } catch (e) {
      // potongan sifatnya opsional, diam saja kalau gagal
      setDiscount(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");

        const db = getFirebaseDb();

        // 1) user
        const uRef = doc(
          db,
          "users_app",
          String(nisnFromUrl || "").trim()
        );
        const uSnap = await getDoc(uRef);
        if (!uSnap.exists())
          throw new Error("Data peserta tidak ditemukan.");
          const u = uSnap.data();
        const registrationLevel = u?.registrationLevel || "";
        if (!registrationLevel)
          throw new Error("Jenjang belum terisi.");

        // 1b) cek status ayah di koleksi ppdb
      let ayahIncomeEmptyVal = false;
        try {
          const pRef = doc(
            db,
            "ppdb",
            String(nisnFromUrl || "").trim()
          );
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pdata = pSnap.data() || {};
            const incomeRaw =
              pdata.ayahIncome ?? pdata.ayah_income ?? "";
            const normalized = String(incomeRaw).trim();
            ayahIncomeEmptyVal = normalized === "";
          }
        } catch (_) {
          // abaikan jika gagal, anggap tidak kosong
          ayahIncomeEmptyVal = false;
        }

        // Prefill Data Saudara (multi/legacy)     
        let preSiblings = [];
        if (Array.isArray(u?.siblings)) {
          preSiblings = (u.siblings || [])
            .map((s) => ({
              name: (s?.name || s?.nama || "").toString(),
              level: (s?.level || s?.jenjang || "").toString(),
              // ambil kelas saudara jika ada (class / kelas)
              class: (s?.class || s?.kelas || "").toString(),
            }))
            .filter((s) => s.name || s.level || s.class);
        } else {
          const n = (u?.siblingsCount ?? u?.jumlahSaudara ?? 0) | 0;
          const preName = (
            u?.saudaraNama || u?.namaSaudara || ""
          ).toString();
          const preLevel = (u?.saudaraJenjang || "").toString();
          const preClass = (u?.saudaraKelas || "").toString();
          if (preName || preLevel || preClass || n > 0) {
            preSiblings = [
              { name: preName, level: preLevel, class: preClass },
            ];
          }
        }


        // 2) fees (by label)
        const col = collection(db, "re_registration_fees");
        const qy = query(
          col,
          where("label", "==", registrationLevel),
          limit(1)
        );
        const qSnap = await getDocs(qy);
        if (qSnap.empty)
          throw new Error(
            `Data biaya untuk "${registrationLevel}" belum tersedia.`
          );
        const feeDoc = qSnap.docs[0].data();

         if (!cancelled) {
          const userObj = {
            nisn: u?.nisn || nisnFromUrl || "-",
            fullName: u?.fullName || "-",
            registrationLevel,
          };
          setUser(userObj);
          setFees(feeDoc);
          setAyahIncomeEmpty(ayahIncomeEmptyVal);

          // set prefill sibling (multi)
          setHasSibling(preSiblings.length > 0);
          setSiblings(preSiblings);

          loadPayments(String(userObj.nisn));
          loadDiscount(String(userObj.nisn)); // 🔹 tambahan
        }
      } catch (e) {
        if (!cancelled)
          setError(e?.message || "Terjadi kesalahan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (nisnFromUrl) load();
    return () => {
      cancelled = true;
    };
  }, [nisnFromUrl, loadPayments, loadDiscount]);

  // 🔎 Cek status PTK untuk popup
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!nisnFromUrl) return;
        const db = getFirebaseDb();
        const ref = doc(
          db,
          "users_app",
          String(nisnFromUrl).trim(),
          "ptk_confirmation",
          "current"
        );
        const snap = await getDoc(ref);
        if (!alive || !snap.exists()) return;
        const data = snap.data() || {};
        const st = normalizeStatus(data);
        if (st === "approved") {
          setPtkInfo({
            status: st,
            parentName: data.parentName || data.parent_name || "",
            jabatan: data.jabatan || "",
          });
          setShowPTKNotice(true);
        }
      } catch {
        // abaikan
      }
    })();
    return () => {
      alive = false;
    };
  }, [nisnFromUrl]);

const totalUangPangkal = useMemo(() => {
  if (!fees || !fees.uangPangkal) return 0;

  // Normalisasi jenjang ke lowercase
  const jenjang = (user?.registrationLevel || "")
    .toString()
    .toLowerCase();

  // Selama jenjang salah satu dari 4 PPS
  const isPpsJenjang =
    jenjang.includes("pps ula putra") ||
    jenjang.includes("pps ula putri") ||
    jenjang.includes("pps wustho") ||
    jenjang.includes("pps ulya");

  // Khusus jenjang PPS + income ayah KOSONG → Uang Pangkal 0
  if (isPpsJenjang && ayahIncomeEmpty) {
    return 0;
  }

  // Selain itu, hitung normal dari fees.uangPangkal
  return Object.values(fees.uangPangkal).reduce((acc, v) => {
    const n = typeof v === "number" ? v : NaN;
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}, [fees, user?.registrationLevel, ayahIncomeEmpty]);



  const totalPembayaran = useMemo(() => {
    const spp = typeof fees?.spp === "number" ? fees.spp : 0;
    return spp + totalUangPangkal;
  }, [fees?.spp, totalUangPangkal]);

    const effectiveTotalTagihan = useMemo(() => {
    const base = Number(totalPembayaran) || 0;
    const disc =
      discount && Number(discount.amount || 0) > 0
        ? Number(discount.amount)
        : 0;

    if (!Number.isFinite(base) || !Number.isFinite(disc)) return base;
    return Math.max(0, base - disc);
  }, [totalPembayaran, discount]);

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
        (Number(effectiveTotalTagihan) || 0) -
          (Number(totalTerverifikasi) || 0)
      ),
    [effectiveTotalTagihan, totalTerverifikasi]
  );

  // Opsi jenjang saudara sesuai jenjang user
  const siblingLevelOptions = useMemo(() => {
    const lv = (user?.registrationLevel || "").toLowerCase();
    const isSD = lv.includes("sd");
    const isSMP = lv.includes("smp");
    const isSMA = lv.includes("sma");

    if (isSD && !isSMP && !isSMA) {
      return ["SD Putra", "SD Putri"];
    }
    return [
      "SMP Putra",
      "SMP Putri",
      "SMA Putra",
      "SMA Putri",
    ];
  }, [user?.registrationLevel]);

  // Helpers multi-saudara
   const addSibling = useCallback(() => {
  setHasSibling(true);
  setSiblings((arr) => [
    ...arr,
    { name: "", level: "", class: "" },
  ]);
}, []);

  const updateSibling = useCallback((idx, key, val) => {
    setSiblings((arr) => arr.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }, []);

  // Simpan Data Saudara (opsional, multi) — via SERVER agar tidak kena Security Rules client
  const saveSibling = useCallback(
    async (overrideList) => {
      if (!user?.nisn) return;
      try {
        setSavingSibling(true);

        const source = Array.isArray(overrideList) ? overrideList : siblings;

        // Normalisasi
        const raw = (source || []).map((s) => ({
  name: (s?.name || s?.nama || "").toString().trim(),
  level: (s?.level || s?.jenjang || "").toString().trim(),
  class: (s?.class || s?.kelas || "").toString().trim(),
}));

// ✅ VALIDASI: jika nama diisi tapi jenjang atau kelas kosong → blok
const invalid = raw.some(
  (s) => s.name && (!s.level || !s.class)
);
if (invalid) {
  alert(
    "Jika mengisi nama saudara, jenjang dan kelas saudara wajib dipilih."
  );
  return;
}

// Buang baris kosong
const cleaned = raw.filter((s) => s.name || s.level || s.class);
        const count = cleaned.length;

        const res = await fetch("/api/ptk/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_siblings",
            nisn: String(user.nisn),
            siblings: cleaned,
            siblingsCount: count,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Gagal menyimpan data saudara.");
        }

        setSavedSiblingAt(Date.now());
        if (count === 0) setHasSibling(false);
        alert("Data saudara disimpan.");
      } catch (e) {
        alert(e?.message || "Gagal menyimpan data saudara.");
      } finally {
        setSavingSibling(false);
      }
    },
    [user?.nisn, siblings]
  );

  const removeSibling = useCallback(
    async (idx) => {
      if (!user?.nisn) return;

      const ok = window.confirm(
        "Yakin ingin menghapus data saudara ini? Perubahan akan langsung disimpan."
      );
      if (!ok) return;

      // buat list baru tanpa saudara yang dihapus
      const newList = siblings.filter((_, i) => i !== idx);
      setSiblings(newList);

      // langsung simpan ke server, tanpa perlu tekan tombol 'Simpan'
      await saveSibling(newList);
    },
    [user?.nisn, siblings, saveSibling]
  );


  // Batalkan / hapus bukti pembayaran
  const cancelPayment = useCallback(
    async (payment) => {
      if (!user?.nisn) return;
      if (!payment?.id) return;

      if (isApproved(payment)) {
        alert(
          "Bukti pembayaran yang sudah disetujui admin tidak bisa dibatalkan."
        );
        return;
      }

      const ok = window.confirm(
        "Yakin ingin membatalkan bukti pembayaran ini? Bukti akan dihapus dan perlu upload ulang jika ingin mengganti."
      );
      if (!ok) return;

      try {
        const db = getFirebaseDb();
        await deleteDoc(
          doc(
            db,
            "users_app",
            String(user.nisn),
            "payments",
            payment.id
          )
        );
        setPayments((prev) =>
          prev.filter((p) => p.id !== payment.id)
        );
        alert("Bukti pembayaran telah dibatalkan.");
      } catch (e) {
        alert(
          e?.message ||
            "Gagal membatalkan bukti pembayaran."
        );
      }
    },
    [user?.nisn]
  );

  return (
    <div className="relative min-h:[85vh] md:min-h-screen bg-white">
      <section className="relative z-10 w-full px-2 md:px-4 py-3 md:py-4 -mt-2">
        <div className="mx-auto w-full max-w-9xl">
          <div
            className={[
              "mt-1 md:mt-1 rounded-2xl border border-slate-200 bg-white p-4 md:p-8 shadow-xl transition-all duration-700",
              !loading && !error
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-3",
            ].join(" ")}
          >
            {/* Header */}
            <div className="mb-5 md:mb-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                  Daftar Ulang, Non-PTK
                </h2>
                {fees?.label && (
                  <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-2.5 py-1 text-xs font-semibold shadow-sm">
                    {fees.label}
                  </span>
                )}
              </div>
            </div>

            {/* Aksi */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4 mb-6">
              <div className="flex items-center gap-2 text-[13px] text-slate-600 mb-3">
                <IdCard className="h-4 w-4" /> Aksi
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onBack && onBack()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all hover:shadow-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>

                {[
                  "SMP Putra",
                  "SMA Putra",
                  "SMP Putri",
                  "SMA Putri",
                ].includes(user?.registrationLevel || "") ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenUniform &&
                      onOpenUniform(user?.registrationLevel)
                    }
                    className={[
                      "w-full inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold shadow-sm transition-all",
                      uniformFilled
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                        : "bg-slate-900 hover:bg-black text-white border-slate-900",
                    ].join(" ")}
                  >
                    {uniformFilled ? (
                      <CheckCircle2 className="h-4 w-4" />
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

            {/* Identitas / konten utama */}
            {loading ? (
              <Skeleton />
            ) : error ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 mb-6">
                  <Field
                    icon={IdCard}
                    label="NISN"
                    value={user?.nisn}
                  />
                  <Field
                    icon={User2}
                    label="Nama Lengkap"
                    value={user?.fullName}
                  />
                  <Field
                    icon={GraduationCap}
                    label="Jenjang"
                    value={user?.registrationLevel}
                  />
                </div>

                {/* ===== Data Saudara (Opsional, MULTI) ===== */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 mb-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-slate-900">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                        <Users className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          Data Saudara (opsional)
                        </div>
                        <div className="text-xs text-slate-600">
                          Jika memiliki saudara di yayasan, isi nama &
                          pilih jenjangnya.
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <label className="text-xs text-slate-700">
                        Punya saudara?
                      </label>
                      <input
                        type="checkbox"
                        checked={hasSibling}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasSibling(checked);
                          if (
                            checked &&
                            siblings.length === 0
                          ) {
                            setSiblings([
                              { name: "", level: "" },
                            ]);
                          }
                          if (!checked) {
                            setSiblings([]);
                          }
                        }}
                        className="h-4 w-4 accent-violet-600"
                      />
                    </div>
                  </div>

                  {hasSibling ? (
                    <div className="mt-4 space-y-3">
                      {siblings.map((s, idx) => {
  const lvl = (s.level || "").toLowerCase();
  let kelasOptions = [];
  if (lvl.includes("sd")) {
    // SD: 1–5
    kelasOptions = ["1", "2", "3", "4", "5"];
  } else if (lvl.includes("smp")) {
    // SMP: 7–8
    kelasOptions = ["7", "8"];
  } else if (lvl.includes("sma")) {
    // SMA: 10–11
    kelasOptions = ["10", "11"];
  }

  return (
    <div
      key={idx}
      className="grid grid-cols-1 md:grid-cols-9 gap-3 items-end"
    >
      <div className="md:col-span-4">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Nama Saudara #{idx + 1}
        </label>
        <input
          type="text"
          value={s.name}
          onChange={(e) =>
            updateSibling(idx, "name", e.target.value)
          }
          placeholder="Tulis nama saudara"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
      </div>

      <div className="md:col-span-3">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Jenjang Saudara #{idx + 1}
        </label>
        <select
          value={s.level}
          onChange={(e) =>
            updateSibling(idx, "level", e.target.value)
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-300"
        >
          <option value="">Pilih jenjang</option>
          {siblingLevelOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Kelas Saudara #{idx + 1}
        </label>
        <select
          value={s.class || ""}
          onChange={(e) =>
            updateSibling(idx, "class", e.target.value)
          }
          disabled={kelasOptions.length === 0}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">Pilih kelas</option>
          {kelasOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-9 flex items-center justify-end">
        <button
          type="button"
          onClick={() => removeSibling(idx)}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          title="Hapus baris saudara ini"
        >
          <Trash2 className="h-4 w-4" />
          Hapus
        </button>
      </div>
    </div>
  );
})}


                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={addSibling}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Plus className="h-4 w-4" />
                          Tambah Saudara
                        </button>

                        <button
                          type="button"
                          onClick={saveSibling}
                          disabled={savingSibling}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {savingSibling ? (
                            <Save className="h-4 w-4 animate-pulse" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {savingSibling
                            ? "Menyimpan…"
                            : "Simpan Data Saudara"}
                        </button>
                      </div>

                      {!!savedSiblingAt && (
                        <div className="text-[11px] text-emerald-800">
                          Data saudara terakhir disimpan:{" "}
                          {new Date(
                            savedSiblingAt
                          ).toLocaleString("id-ID")}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500">
                        Opsi jenjang mengikuti jenjang Anda: SD →
                        hanya SD; SMP/SMA → SMP &amp; SMA.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-600">
                      Centang “Punya saudara?” bila ingin mengisi
                      data saudara.
                    </div>
                  )}
                </div>
                {/* ===== /Data Saudara ===== */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Stat
                    icon={Wallet}
                    label="SPP (per semester)"
                    value={fmtIDR(fees?.spp ?? 0)}
                  />
                  <Stat
                    icon={Banknote}
                    label="Total Uang Pangkal"
                    value={fmtIDR(totalUangPangkal)}
                  />
                </div>

                <div className="mt-3 rounded-xl border-2 border-slate-300 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      Total Tagihan
                    </span>
                    <span className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
                      {fmtIDR(effectiveTotalTagihan)}
                    </span>
                  </div>

                  {discount && Number(discount.amount || 0) > 0 && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-800">
                      <span>
                        Potongan {discount.type || "BP3"} karena saudara
                      </span>
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
                  Nominal yang mengurangi tagihan hanyalah
                  pembayaran yang sudah <b>dikofirmasi admin</b>.
                  Bukti berstatus{" "}
                  <i>Menunggu Konfirmasi</i> belum mengurangi
                  tagihan.
                </p>

                                {/* BUKTI */}
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-sm text-slate-700">
                      Bukti Pembayaran (bisa beberapa kali transfer)
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
                        className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Bukti
                      </button>
                    </div>
                  </div>

                  {/* LIST BUKTI YANG SUDAH DIUPLOAD */}
                  {loadingPayments ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Memuat data bukti pembayaran…
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      Belum ada bukti pembayaran yang diupload. Silakan klik{" "}
                      <span className="font-semibold">Upload Bukti</span> untuk
                      mengunggah.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((p) => {
                        const status = normalizeStatus(p);
                        const approved = isApproved(p);

                        let createdAtText = "-";
                        try {
                          const ts = p.createdAt;
                          const dt =
                            ts?.toDate?.() ||
                            (ts?.seconds
                              ? new Date(ts.seconds * 1000)
                              : null);
                          if (dt) {
                            createdAtText = dt.toLocaleString("id-ID");
                          }
                        } catch {
                          // diam saja
                        }

                        const amount = Number(p.amount || 0);
                        const method =
                          p.method ||
                          p.paymentMethod ||
                          p.via ||
                          "Transfer";

                        const proofUrl =
  p.downloadURL ||         
  p.proofUrl ||
  p.buktiUrl ||
  p.fileUrl ||
  p.url ||
  "";

                        const statusView =
                          status === "approved"
                            ? {
                                label: "Terverifikasi",
                                cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
                                Icon: BadgeCheck,
                              }
                            : status === "rejected"
                            ? {
                                label: "Ditolak",
                                cls: "bg-rose-50 text-rose-800 border-rose-200",
                                Icon: AlertCircle,
                              }
                            : {
                                label: "Menunggu Konfirmasi",
                                cls: "bg-amber-50 text-amber-800 border-amber-200",
                                Icon: AlertCircle,
                              };

                        const StatusIcon = statusView.Icon;

                        return (
                          <div
                            key={p.id}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <FileText className="h-4 w-4" />
                                Bukti Pembayaran
                              </div>
                              <div className="text-xs text-slate-600">
                                Tanggal: {createdAtText}
                              </div>
                              <div className="text-xs text-slate-600">
                                Metode: {method}
                              </div>
                              <div className="text-sm font-semibold text-slate-900">
                                Nominal: {fmtIDR(amount)}
                              </div>

                              <div
                                className={[
                                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                  statusView.cls,
                                ].join(" ")}
                              >
                                <StatusIcon className="h-3.5 w-3.5" />
                                <span>{statusView.label}</span>
                              </div>
                            </div>

                           <div className="flex flex-col items-end gap-2">
  {proofUrl ? (
    <a
      href={proofUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
    >
      Lihat Bukti
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  ) : (
    <span className="text-[11px] text-slate-500">Belum ada file</span>
  )}

  <button
    type="button"
    onClick={() => cancelPayment(p)}
    disabled={approved}
    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Trash2 className="h-3.5 w-3.5" />
    {approved ? "Sudah disetujui" : "Batalkan Bukti"}
  </button>
</div>


                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* END BUKTI */}

              </>
            )}
          </div>
        </div>
      </section>

      {/* Modal Upload */}
       <UploadBukti
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() =>
          user?.nisn && loadPayments(String(user.nisn))
        }
        nisn={String(user?.nisn || "")}
      />

       <TutorialPaymentModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        amount={effectiveTotalTagihan}
      />

      
      {/* Modal Pemberitahuan Anak PTK */}
      <PTKNoticeModal
        open={showPTKNotice}
        onClose={() => setShowPTKNotice(false)}
        info={ptkInfo}
      />      
    </div>
  );
}