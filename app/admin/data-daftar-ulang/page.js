"use client";

import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  Loader2,
  Users,
  Wallet,
  Banknote,
  TicketPercent,
  AlertCircle,
  Search,
  Filter,
  LayoutGrid,
  Rows,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";

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

const PAGE_SIZES = [10, 25, 50];

const MAX_FINAL = 500; // berapa banyak peserta LULUS yang diambil
const MAX_RE_REG_DOCS = 2000;
const MAX_PAYMENTS_DOCS = 5000;
const MAX_PPDB_DOCS = 3000;

function fmtIDR(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(ms) {
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleString("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "-";
  }
}

/* ===== Normalizer status (pembayaran) ===== */
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

function isPpsJenjang(jenjang) {
  const j = (jenjang || "").toString().toLowerCase();
  return (
    j.includes("pps ula putra") ||
    j.includes("pps ula putri") ||
    j.includes("pps wustho") ||
    j.includes("pps ulya")
  );
}

/* ====== Komponen kecil ====== */
function StatCard({ icon: Icon, label, value, helper, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-300 p-4 md:p-5 ${
        active
          ? "border-emerald-300 ring-2 ring-emerald-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] md:text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-0.5 text-sm md:text-lg font-extrabold tracking-tight tabular-nums text-slate-900 break-words">
            {value}
          </div>
          {helper ? (
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {helper}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/* ========= Halaman Data Daftar Ulang ========= */
export default function AdminDataDaftarUlangPage() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    totalParticipants: 0,
    totalTagihanNet: 0,
    totalPaid: 0,
    totalSisa: 0,
    totalDiscountPTK: 0,
    totalDiscountNonPTK: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterJalur, setFilterJalur] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState("SUMMARY"); // SUMMARY | COMPONENT
  const [statScope, setStatScope] = useState("ALL");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [sentWA, setSentWA] = useState({});

  function normalizeWaNumber(raw) {
  if (!raw) return "";
  let n = raw.toString().replace(/\D/g, ""); // buang selain angka

  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (!n.startsWith("62")) n = "62" + n;

  return n;
}



  // Aggregasi untuk stat card sesuai scope (ALL / PTK / NON_PTK)
  const scopedStats = useMemo(() => {
    // mulai dari semua rows
    let base = [...rows];

    // filter search
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      base = base.filter(
        (r) =>
          r.nisn.toLowerCase().includes(s) ||
          r.name.toLowerCase().includes(s) ||
          r.level.toLowerCase().includes(s)
      );
    }
    
     // filter jalur dari dropdown
    if (filterJalur === "PTK") {
      base = base.filter((r) => r.jalur === "PTK");
    } else if (filterJalur === "NON_PTK") {
      // NON_PTK = semua yang BUKAN PTK
      base = base.filter((r) => (r.jalur || "") !== "PTK");
    } else if (filterJalur === "NON_PTK_DISC") {
      // Non-PTK yang PUNYA diskon Non-PTK
      base = base.filter(
        (r) => (r.jalur || "") !== "PTK" && (Number(r.discNonPTK || 0) || 0) > 0
      );
    }

    // filter jenjang
    if (filterLevel !== "ALL") {
      base = base.filter((r) => r.level === filterLevel);
    }

    // filter status daftar ulang
    if (filterStatus !== "ALL") {
      base = base.filter((r) => r.statusDaftarUlang === filterStatus);
    }

    // setelah semua filter UI, baru pecah berdasarkan scope (ALL / PTK / NON_PTK)
    let filtered = base;
    if (statScope === "PTK") {
      filtered = base.filter((r) => r.jalur === "PTK");
    } else if (statScope === "NON_PTK") {
      filtered = base.filter((r) => (r.jalur || "") !== "PTK");
    }

    const totalTagihanNet = filtered.reduce(
      (sum, r) => sum + (Number(r.netTagihan || 0) || 0),
      0
    );
    const totalPaid = filtered.reduce(
      (sum, r) => sum + (Number(r.totalPaid || 0) || 0),
      0
    );
    const totalSisa = filtered.reduce(
      (sum, r) => sum + (Number(r.sisa || 0) || 0),
      0
    );

    return {
      participants: filtered.length,
      totalTagihanNet,
      totalPaid,
      totalSisa,
    };
  }, [rows, statScope, search, filterJalur, filterLevel, filterStatus]);



   const discountValue = useMemo(() => {
    // mulai dari semua rows
    let base = [...rows];

    // filter search
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      base = base.filter(
        (r) =>
          r.nisn.toLowerCase().includes(s) ||
          r.name.toLowerCase().includes(s) ||
          r.level.toLowerCase().includes(s)
      );
    }

     // filter jalur dari dropdown
    if (filterJalur === "PTK") {
      base = base.filter((r) => r.jalur === "PTK");
    } else if (filterJalur === "NON_PTK") {
      base = base.filter((r) => (r.jalur || "") !== "PTK");
    } else if (filterJalur === "NON_PTK_DISC") {
      base = base.filter(
        (r) => (r.jalur || "") !== "PTK" && (Number(r.discNonPTK || 0) || 0) > 0
      );
    }

    // filter jenjang
    if (filterLevel !== "ALL") {
      base = base.filter((r) => r.level === filterLevel);
    }

    // filter status
    if (filterStatus !== "ALL") {
      base = base.filter((r) => r.statusDaftarUlang === filterStatus);
    }

    // hitung total diskon PTK & Non-PTK dari data yang sudah difilter
    let totalPTK = 0;
    let totalNonPTK = 0;
    base.forEach((r) => {
      totalPTK += Number(r.discPTK || 0) || 0;
      totalNonPTK += Number(r.discNonPTK || 0) || 0;
    });

    if (statScope === "ALL") {
      return fmtIDR(totalPTK + totalNonPTK);
    }
    if (statScope === "PTK") {
      return fmtIDR(totalPTK);
    }
    if (statScope === "NON_PTK") {
      return fmtIDR(totalNonPTK);
    }
    return "-";
  }, [
    rows,
    search,
    filterJalur,
    filterLevel,
    filterStatus,
    statScope,
  ]);


  const discountHelper = useMemo(() => {
    if (statScope === "ALL") return "Kiri: PTK · Kanan: Non-PTK";
    if (statScope === "PTK") return "Diskon jalur PTK";
    if (statScope === "NON_PTK") return "Diskon jalur Non-PTK";
    return "";
  }, [statScope]);

  const scopeLabelSuffix =
    statScope === "ALL"
      ? " (Semua Jalur)"
      : statScope === "PTK"
      ? " (PTK)"
      : " (Non-PTK)";

  const handleToggleStatScope = () => {
    setStatScope((prev) =>
      prev === "ALL" ? "PTK" : prev === "PTK" ? "NON_PTK" : "ALL"
    );
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        /* 1) Ambil peserta LULUS dari users_app (field finalDecision) */
        const finalSnap = await getDocs(
          query(
            collection(db, "users_app"),
            where("finalDecision", "==", "LULUS"),
            limit(MAX_FINAL)
          )
        );

        /* 2) Ambil seluruh konfigurasi biaya re_registration_fees */
        const feesSnap = await getDocs(collection(db, "re_registration_fees"));
        const feesByLabel = {};
        feesSnap.forEach((d) => {
          const data = d.data() || {};
          const label = (data.label || data.key || "").toString().trim();
          if (!label) return;
          feesByLabel[label] = {
            spp: typeof data.spp === "number" ? data.spp : 0,
            uangPangkal:
              data.uangPangkal && typeof data.uangPangkal === "object"
                ? data.uangPangkal
                : {},
          };
        });

          /* 3) Ambil data PPDB (ayahIncome) sekali saja */
        const ppdbSnap = await getDocs(
          query(collection(db, "ppdb"), limit(MAX_PPDB_DOCS))
        );
        const ppdbById = {};
        ppdbSnap.forEach((d) => {
          ppdbById[d.id] = d.data() || {};
        });

        /* 4) Ambil semua dokumen potongan di subkoleksi re_registration */
        const reRegSnap = await getDocs(
  query(collectionGroup(db, "re_registration"), limit(MAX_RE_REG_DOCS))
);
const discountsByNisn = {};
let totalDiscountPTK = 0;
let totalDiscountNonPTK = 0;

reRegSnap.forEach((docSnap) => {
  const docId = docSnap.id; // "ptk_discount" / "nonptk_discount" / lainnya
  if (docId !== "ptk_discount" && docId !== "nonptk_discount") return;

  const data = docSnap.data() || {};
  const amount = Number(data.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const parent = docSnap.ref.parent; // re_registration
  const userRef = parent?.parent; // users_app/{nisn}
  const nisn = userRef?.id || "";
  if (!nisn) return;

  const type = (data.type || "").toString().toUpperCase();
  const siblingsCount = Number(data.siblingsCount || 0) || 0;
  const amountBP3 = Number(data.amountBP3 || 0) || 0;
  const amountSPP = Number(data.amountSPP || 0) || 0;
  const sourceKey = (data.sourceKey || "").toString();

  if (!discountsByNisn[nisn]) {
    discountsByNisn[nisn] = {
      ptk: 0,
      nonptk: 0,
      ptkMeta: null,
      nonptkMeta: null,
    };
  }

  if (docId === "ptk_discount") {
    discountsByNisn[nisn].ptk += amount;
    discountsByNisn[nisn].ptkMeta = {
      type,
      siblingsCount,
      amountBP3,
      amountSPP,
      sourceKey,
    };
    totalDiscountPTK += amount;
  } else if (docId === "nonptk_discount") {
    discountsByNisn[nisn].nonptk += amount;
    discountsByNisn[nisn].nonptkMeta = {
      type,
      siblingsCount,
      sourceKey,
    };
    totalDiscountNonPTK += amount;
  }
});

        /* 4) Ambil semua payments (collectionGroup) */
        const paySnap = await getDocs(
          query(collectionGroup(db, "payments"), limit(MAX_PAYMENTS_DOCS))
        );
        const payAggByNisn = {};
        paySnap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const parent = docSnap.ref.parent; // payments
          const userRef = parent?.parent;
          const nisn = userRef?.id || "";
          if (!nisn) return;

          const amount = Number(data.amount || 0);
          if (!Number.isFinite(amount) || amount <= 0) return;

          const status = normalizeStatus(data);
          const ts = data.createdAt;
          const ms = ts?.toMillis
            ? ts.toMillis()
            : ts instanceof Date
            ? ts.getTime()
            : null;

          if (!payAggByNisn[nisn]) {
            payAggByNisn[nisn] = {
              totalApproved: 0,
              count: 0,
              lastPaidAt: null,
            };
          }

          const agg = payAggByNisn[nisn];
          agg.count += 1;

          if (status === "approved") {
            agg.totalApproved += amount;
          }

          if (ms && (!agg.lastPaidAt || ms > agg.lastPaidAt)) {
            agg.lastPaidAt = ms;
          }
        });

        /* 5) Susun rows per peserta LULUS */
        const tmpRows = [];
        let statTotalTagihanNet = 0;
        let statTotalPaid = 0;
        let statTotalSisa = 0;

        for (const fSnap of finalSnap.docs) {
          const ud = fSnap.data() || {};

          const nisn = (ud.nisn || fSnap.id || "").toString().trim();
          if (!nisn) continue;

          const level = (
            ud.registrationLevel ||
            ud.jenjangDiterima ||
            ud.jenjang ||
            ""
          )
            .toString()
            .trim();
          if (!level) continue;

          const name =
            ud.fullName || ud.nama || ud.name || ud.studentName || nisn;
          const phone =
            ud.noWa || ud.whatsapp || ud.phone || ud.hp || ud.noHP || "";

          // Biaya dasar dari label/jenjang
            const fee = feesByLabel[level] || null;
          const baseSPP = fee?.spp || 0;

          let pangkalComponents = {};
          let totalPangkal = 0;
          if (fee?.uangPangkal && typeof fee.uangPangkal === "object") {
            pangkalComponents = fee.uangPangkal;
            for (const v of Object.values(fee.uangPangkal)) {
              const n = Number(v || 0);
              if (Number.isFinite(n)) totalPangkal += n;
            }
          }
          const totalAwal = baseSPP + totalPangkal;

          // Potongan PTK / Non-PTK
          const discInfo = discountsByNisn[nisn] || { ptk: 0, nonptk: 0 };
          const discPTK = Number(discInfo.ptk || 0);
          const discNonPTK = Number(discInfo.nonptk || 0);
          const totalDisc =
            (Number.isFinite(discPTK) ? discPTK : 0) +
            (Number.isFinite(discNonPTK) ? discNonPTK : 0);

          // --- NEW: baca ayahIncome dari ppdb/{nisn} untuk rule PPS yatim ---
          const ppdbData = ppdbById[nisn] || {};
const waliWa = (ppdbData.waliWa || "").toString().trim();
          const ayahIncomeRaw = (ppdbData.ayahIncome ?? "")
            .toString()
            .trim();

          // Tagihan net awal (setelah potongan)
          let netTagihan = Math.max(0, totalAwal - totalDisc);

          // PPS + yatim (ayahIncome kosong) => GRATIS
          if (isPpsJenjang(level) && !ayahIncomeRaw) {
            netTagihan = 0;
          }

          // Aggregasi pembayaran
          const payAgg = payAggByNisn[nisn] || {
            totalApproved: 0,
            count: 0,
            lastPaidAt: null,
          };
          const totalPaid = payAgg.totalApproved || 0;
          const sisa = Math.max(0, netTagihan - totalPaid);

          // Status daftar ulang:
          // - kalau netTagihan 0 → LUNAS (gratis) walaupun belum bayar
          // - selain itu ikut totalPaid vs netTagihan
          let statusDaftarUlang = "BELUM BAYAR";
          if (netTagihan === 0) {
            statusDaftarUlang = "LUNAS";
          } else if (totalPaid <= 0) {
            statusDaftarUlang = "BELUM BAYAR";
          } else if (totalPaid < netTagihan) {
            statusDaftarUlang = "SEBAGIAN";
          } else {
            statusDaftarUlang = "LUNAS";
          }

          const jalur =
            discPTK > 0
              ? "PTK"
              : discNonPTK > 0
              ? "NON_PTK"
              : ud.isPTK
              ? "PTK"
              : ud.isNonPTK
              ? "NON_PTK"
              : "";

          // Label keterangan potongan (SAMA seperti punyamu tadi)
          let discountLabel = "";
          if (discPTK > 0 && discInfo.ptkMeta) {
            const meta = discInfo.ptkMeta;
            const punyaSaudara = (meta.siblingsCount || 0) > 0;
            const hasSPP =
              (meta.amountSPP || 0) > 0 ||
              meta.type === "SPP" ||
              meta.type === "BP3+SPP";
            const hasBP3 =
              (meta.amountBP3 || 0) > 0 ||
              meta.type === "BP3" ||
              meta.type === "BP3+SPP";

            if (punyaSaudara && hasSPP) {
              // PTK punya saudara + dapat SPP
              discountLabel = "PTK bersaudara + SPP";
            } else if (punyaSaudara) {
              // PTK bersaudara saja (tanpa SPP)
              discountLabel = "PTK bersaudara";
            } else if (!hasSPP && hasBP3) {
              // PTK hanya BP3 → non SPP
              discountLabel = "PTK non SPP (BP3)";
            } else if (hasSPP && !hasBP3) {
              // PTK cuma SPP
              discountLabel = "PTK SPP";
            } else if (hasSPP && hasBP3) {
              // PTK dapat dua komponen (tanpa saudara)
              discountLabel = "PTK SPP+BP3";
            } else {
              discountLabel = "PTK";
            }
          } else if (discNonPTK > 0 && discInfo.nonptkMeta) {
            const meta = discInfo.nonptkMeta;
            const punyaSaudara = (meta.siblingsCount || 0) > 0;
            const sourceKey = (meta.sourceKey || "").toLowerCase();
            const t = meta.type || "";
            const isSPP =
              t === "SPP" ||
              sourceKey === "spp" ||
              sourceKey.endsWith(".spp");
            const isBP3 =
              t === "BP3" ||
              sourceKey.includes("bp3");

            if (isSPP) {
              // Skenario yatim: potongan SPP
              discountLabel = "SPP yatim";
            } else if (isBP3 || punyaSaudara) {
              // Non-PTK saudara → BP3
              discountLabel = "BP3 bersaudara";
            } else {
              discountLabel = "Non-PTK";
            }
          }

          tmpRows.push({
            nisn,
            name,
            level,
            jalur,
            phone,
            waliWa,
            baseSPP,
            pangkalComponents,
            totalPangkal,
            totalAwal,
            discPTK,
            discNonPTK,
            totalDisc,
            netTagihan,
            totalPaid,
            sisa,
            buktiCount: payAgg.count || 0,
            lastPaidAt: payAgg.lastPaidAt,
            statusDaftarUlang,
            discountLabel,
          });

          statTotalTagihanNet += netTagihan;
          statTotalPaid += totalPaid;
          statTotalSisa += sisa;
        }

        if (!alive) return;

        // Urutkan by level lalu nama
        tmpRows.sort((a, b) => {
          if (a.level === b.level) {
            return a.name.localeCompare(b.name, "id");
          }
          return a.level.localeCompare(b.level, "id");
        });

        setRows(tmpRows);
        setStats({
          totalParticipants: tmpRows.length,
          totalTagihanNet: statTotalTagihanNet,
          totalPaid: statTotalPaid,
          totalSisa: statTotalSisa,
          totalDiscountPTK,
          totalDiscountNonPTK,
        });
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErrorMsg(e?.message || "Gagal memuat data daftar ulang.");
      } finally {
        alive && setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  // Filter & pencarian
  const filteredRows = useMemo(() => {
    let out = [...rows];

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.nisn.toLowerCase().includes(s) ||
          r.name.toLowerCase().includes(s) ||
          r.level.toLowerCase().includes(s)
      );
    }

    if (filterJalur === "PTK") {
      out = out.filter((r) => r.jalur === "PTK");
    } else if (filterJalur === "NON_PTK") {
      // NON_PTK = semua yang BUKAN PTK
      out = out.filter((r) => (r.jalur || "") !== "PTK");
    } else if (filterJalur === "NON_PTK_DISC") {
      // Non-PTK yang dapat diskon Non-PTK
      out = out.filter(
        (r) => (r.jalur || "") !== "PTK" && (Number(r.discNonPTK || 0) || 0) > 0
      );
    }

    // filter jenjang
    if (filterLevel !== "ALL") {
      out = out.filter((r) => r.level === filterLevel);
    }

    if (filterStatus !== "ALL") {
      out = out.filter((r) => r.statusDaftarUlang === filterStatus);
    }

    return out;
  }, [rows, search, filterJalur, filterLevel, filterStatus]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / pageSize)),
    [filteredRows.length, pageSize]
  );

  const pageSafe = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSafe, pageSize]);

  const rowIndexStart = (pageSafe - 1) * pageSize;

  const pangkalLabelMap = {
    pakaian: "PAKAIAN",
    sarpras: "SARPRAS",
    kasur: "KASUR",
    kitab: "KITAB",
    bp3: "BP3",
  };
  const pangkalKeyOrder = ["pakaian", "sarpras", "kasur", "kitab", "bp3"];

  const levelOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.level) set.add(r.level);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [rows]);

  // ====== Download Excel (.xls) ======
  const buildSummarySheetData = (data) => {
    const header = [
  "NISN",
  "Nama",
  "Jenjang",
  "Jalur",
  "Tagihan Awal",
  "Potongan",
  "Keterangan Potongan",
  "Tagihan Net",
  "Terbayar",
  "Sisa",
  "Status",
  "Bukti",
  "Terakhir Bayar",
];

    const rows = data.map((r) => {
      const totalAwalNum = Number(r.totalAwal || 0) || 0;
      const totalPaidNum = Number(r.totalPaid || 0) || 0;
      const perluNum = Math.max(0, totalAwalNum - totalPaidNum);

      return [
  r.nisn,
  r.name,
  r.level,
  r.jalur || "",
  totalAwalNum,
  Number(r.totalDisc || 0) || 0,
  r.discountLabel || "",
  Number(r.netTagihan || 0) || 0,
  totalPaidNum,
  Number(r.sisa || 0) || 0,
  r.statusDaftarUlang,
  r.buktiCount || 0,
  formatDateTime(r.lastPaidAt),
];
    });

    return [header, ...rows];
  };

  // data untuk mode KOMPONEN
  const buildComponentSheetData = (data) => {
    const header = [
  "NISN",
  "Nama",
  "Jenjang",
  "Jalur",
  "Keterangan Potongan",
  "SPP",
  "Pakaian",
  "Sarpras",
  "Kasur",
  "Kitab",
  "BP3",
  "Total Uang Pangkal",
  "Total Dibayar (SPP+Pangkal)",
  "Jumlah Dibayar (Approved)",
  "Perlu Dibayar Lagi",
];

    const rows = data.map((r) => {
      const pk = r.pangkalComponents || {};
      const getPkValNum = (key) => {
        const val = Number(pk?.[key] || 0);
        return Number.isFinite(val) ? val : 0;
      };

      const baseSPPNum = Number(r.baseSPP || 0) || 0;
      const totalPangkalNum = Number(r.totalPangkal || 0) || 0;
      const totalAll = baseSPPNum + totalPangkalNum; // total dibayar (SPP+Pangkal)
      const totalPaidNum = Number(r.totalPaid || 0) || 0;
      const perluNum = Math.max(0, totalAll - totalPaidNum);

      return [
  r.nisn,
  r.name,
  r.level,
  r.jalur || "",
  r.discountLabel || "",
  baseSPPNum,
  getPkValNum("pakaian"),
  getPkValNum("sarpras"),
  getPkValNum("kasur"),
  getPkValNum("kitab"),
  getPkValNum("bp3"),
  totalPangkalNum,
  totalAll,
  totalPaidNum,
  perluNum,
];
    });

    return [header, ...rows];
  };

  const handleDownloadXls = () => {
    if (!filteredRows.length) return;

    // pilih data berdasarkan view yang aktif
    const ts = new Date().toISOString().slice(0, 10);
    const wb = XLSX.utils.book_new();

    let sheetData;
    let sheetName;

    if (viewMode === "SUMMARY") {
      sheetData = buildSummarySheetData(filteredRows);
      sheetName = "Rekap";
    } else {
      sheetData = buildComponentSheetData(filteredRows);
      sheetName = "Komponen";
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const filename = `data-daftar-ulang-${viewMode.toLowerCase()}-${ts}.xlsx`;

// tulis sebagai file .xlsx (default font Excel = Calibri)
XLSX.writeFile(wb, filename, { bookType: "xlsx" });
  };

  

  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900">
            Data Rekap Daftar Ulang
          </h1>         
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          icon={Users}
          label={`Peserta Daftar Ulang (LULUS)${scopeLabelSuffix}`}
          value={scopedStats.participants.toLocaleString("id-ID")}
          helper="Klik untuk toggle: Semua → PTK → Non-PTK"
          onClick={handleToggleStatScope}
          active={statScope !== "ALL"}
        />
        <StatCard
          icon={Wallet}
          label={`Total Tagihan (net)${scopeLabelSuffix}`}
          value={fmtIDR(scopedStats.totalTagihanNet)}
          helper="Setelah potongan sesuai jalur"
          onClick={handleToggleStatScope}
          active={statScope !== "ALL"}
        />
        <StatCard
          icon={Banknote}
          label={`Total Pembayaran ${scopeLabelSuffix}`}
          value={fmtIDR(scopedStats.totalPaid)}
          helper="Hanya pembayaran berstatus disetujui"
          onClick={handleToggleStatScope}
          active={statScope !== "ALL"}
        />
        <StatCard
          icon={AlertCircle}
          label={`Total Sisa Tagihan${scopeLabelSuffix}`}
          value={fmtIDR(scopedStats.totalSisa)}
          helper="Tagihan net dikurangi pembayaran"
          onClick={handleToggleStatScope}
          active={statScope !== "ALL"}
        />
        <StatCard
          icon={TicketPercent}
          label={`Total Diskon${scopeLabelSuffix}`}
          value={discountValue}
          helper={discountHelper}
          onClick={handleToggleStatScope}
          active={statScope !== "ALL"}
        />
      </div>

      {/* Filter & kontrol tabel */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-3 py-3 md:px-4 md:py-3 border-b border-slate-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-semibold">Data peserta</span>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Memuat…
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            {/* Search */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari NISN / nama / jenjang…"
                className="bg-transparent px-1 py-1 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              {/* Filter jalur */}
              <select
  value={filterJalur}
  onChange={(e) => {
    setFilterJalur(e.target.value);
    setPage(1);
  }}
  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
>
  <option value="ALL">Semua Jalur</option>
  <option value="PTK">PTK</option>
  <option value="NON_PTK">Non-PTK</option>
  <option value="NON_PTK_DISC">Non-PTK (dapat potongan)</option>
</select>

              {/* Filter jenjang */}
              <select
                value={filterLevel}
                onChange={(e) => {
                  setFilterLevel(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 max-w-[160px]"
              >
                <option value="ALL">Semua Jenjang</option>
                {levelOptions.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              {/* Filter status */}
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              >
                <option value="ALL">Semua Status</option>
                <option value="BELUM BAYAR">Belum bayar</option>
                <option value="SEBAGIAN">Sebagian</option>
                <option value="LUNAS">Lunas</option>
              </select>

              {/* Page size */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode toggle: Rekap vs Komponen */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setViewMode("SUMMARY")}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold ${
                  viewMode === "SUMMARY"
                    ? "bg-white text-slate-900"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Rekap
              </button>
              <button
                type="button"
                onClick={() => setViewMode("COMPONENT")}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold border-l border-slate-200 ${
                  viewMode === "COMPONENT"
                    ? "bg-white text-slate-900"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Rows className="h-3.5 w-3.5" />
                Komponen
              </button>
            </div>

            {/* Download XLS */}
            <button
              type="button"
              onClick={handleDownloadXls}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download .xls
            </button>
          </div>
        </div>

        {/* Tabel */}
        {errorMsg ? (
          <div className="p-4 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errorMsg}
          </div>
        ) : filteredRows.length === 0 && !loading ? (
          <div className="p-4 text-sm text-slate-700">
            Tidak ada data daftar ulang yang cocok dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {viewMode === "SUMMARY" ? (
              /* ---------- MODE 1: REKAP ---------- */
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
  {/* baris header 1: grup TAGIHAN */}
  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
    <th className="px-3 py-2" rowSpan={2}>
      No
    </th>
    <th className="px-3 py-2" rowSpan={2}>
      NISN
    </th>
    <th className="px-3 py-2" rowSpan={2}>
      Nama
    </th>
    <th className="px-3 py-2" rowSpan={2}>
      Jenjang
    </th>
    <th className="px-3 py-2" rowSpan={2}>
      Status
    </th>
    <th className="px-3 py-2 text-center" colSpan={5}>
      TAGIHAN
    </th>
    <th className="px-3 py-2" rowSpan={2}>
      Status
    </th>
    <th className="px-3 py-2 text-center" rowSpan={2}>
      Bukti
    </th>
    <th className="px-3 py-2" rowSpan={2}>
  Terakhir Bayar
</th>
<th className="px-3 py-2" rowSpan={2}>
  Hubungi
</th>
  </tr>
  {/* baris header 2: sub kolom TAGIHAN */}
  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
    <th className="px-3 py-1 text-right">Tagihan Awal</th>
    <th className="px-3 py-1 text-right">Potongan</th>
    <th className="px-3 py-1 text-right">Tagihan Net</th>
    <th className="px-3 py-1 text-right">Terbayar</th>
    <th className="px-3 py-1 text-right">Sisa</th>
  </tr>
</thead>

                <tbody className="divide-y divide-slate-100">
  {paginatedRows.map((r, idx) => (
    <tr key={r.nisn} className="hover:bg-slate-50">
      {/* NO */}
      <td className="px-3 py-2 text-[11px] font-semibold text-slate-800">
        {rowIndexStart + idx + 1}
      </td>
      {/* NISN */}
      <td className="px-3 py-2 font-mono text-[11px] text-slate-800">
        {r.nisn}
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-slate-900">
          {r.name}
        </div>
        {r.phone ? (
          <div className="text-[11px] text-slate-500">
            {r.phone}
          </div>
        ) : null}
      </td>
                      <td className="px-3 py-2 text-slate-800">{r.level}</td>
                      <td className="px-3 py-2">
                        {r.jalur ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                              r.jalur === "PTK"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-sky-50 border-sky-200 text-sky-700"
                            }`}
                          >
                            {r.jalur}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {fmtIDR(r.totalAwal)}
                      </td>
                     <td className="px-3 py-2 text-center tabular-nums text-slate-900">
  {r.totalDisc > 0 ? (
    <div className="flex flex-col items-center gap-0.5">
      <span>{fmtIDR(r.totalDisc)}</span>

      {r.discountLabel && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border border-violet-200 bg-violet-50 text-violet-700"
        >
          {r.discountLabel}
        </span>
      )}
    </div>
  ) : (
    "—"
  )}
</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {fmtIDR(r.netTagihan)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {fmtIDR(r.totalPaid)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {fmtIDR(r.sisa)}
                      </td>
                     <td className="px-3 py-2">
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
      r.statusDaftarUlang === "LUNAS"
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : r.statusDaftarUlang === "SEBAGIAN"
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-rose-50 border-rose-200 text-rose-700"
    }`}
  >
    {r.statusDaftarUlang}
  </span>
</td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-800">
                        {r.buktiCount || 0}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-700">
                        {formatDateTime(r.lastPaidAt)}
                      </td>
                      <td className="px-3 py-2 text-center">
  {(r.statusDaftarUlang === "BELUM BAYAR" ||
    r.statusDaftarUlang === "SEBAGIAN") &&
  r.waliWa ? (() => {
    const waNumber = normalizeWaNumber(r.waliWa);

    return (
      <a
  href={`https://web.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(
    `Bismillah..\n\nDiberitahukan kepada Yth. Wali Santri dari *${r.name}*, bahwa proses *daftar ulang* masih *belum diselesaikan*.\n\nJumlah daftar ulang yang perlu diselesaikan: *${fmtIDR(r.sisa)}*.\n\nBatas akhir pembayaran adalah *25 April 2026*. Setelah tanggal tersebut, bagi yang tidak melakukan pembayaran, data akan dihapus oleh sistem dan dianggap mengundurkan diri.\n\nUntuk informasi lebih lanjut, silakan menghubungi panitia di nomor *0877 2024 2025*.\n\nTerima kasih atas perhatian dan kerja samanya.\nSyukron jazakumullahu khairan.\n\n— Panitia SPMB`
  )}`}
  target="_blank"
  rel="noopener noreferrer"
  onClick={() =>
    setSentWA((prev) => ({ ...prev, [r.nisn]: true }))
  }
  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white ${
    sentWA[r.nisn]
      ? "bg-slate-400 cursor-default"
      : "bg-green-600 hover:bg-green-700"
  }`}
>
  {sentWA[r.nisn] ? "Hubungi WA ✓" : "Hubungi WA"}
</a>
    );
  })() : (
    <span className="text-[11px] text-slate-400">—</span>
  )}
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* ---------- MODE 2: KOMPONEN SPP & UANG PANGKAL ---------- */
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  {/* baris header 1: group UANG PANGKAL */}
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
  <th className="px-3 py-2" rowSpan={2}>
    No
  </th>
  <th className="px-3 py-2" rowSpan={2}>
    NISN
  </th>
  <th className="px-3 py-2" rowSpan={2}>
    Nama
  </th>
  <th className="px-3 py-2" rowSpan={2}>
    Jenjang
  </th>
  <th className="px-3 py-2" rowSpan={2}>
    Status
  </th>
  <th className="px-3 py-2 text-right" rowSpan={2}>
    SPP
  </th>
                    <th className="px-3 py-2 text-center" colSpan={6}>
                      UANG PANGKAL
                    </th>
                    <th className="px-3 py-2 text-right" rowSpan={2}>
                      TOTAL DIBAYAR
                    </th>
                    <th className="px-3 py-2 text-right" rowSpan={2}>
                      JUMLAH DIBAYAR
                    </th>
                  </tr>

                  {/* baris header 2: sub kolom uang pangkal */}
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-1 text-right">PAKAIAN</th>
                    <th className="px-3 py-1 text-right">SARPRAS</th>
                    <th className="px-3 py-1 text-right">KASUR</th>
                    <th className="px-3 py-1 text-right">KITAB</th>
                    <th className="px-3 py-1 text-right">BP3</th>
                    <th className="px-3 py-1 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
  {paginatedRows.map((r, idx) => {
    const pk = r.pangkalComponents || {};
                    const getPkVal = (key) => {
                      const val = Number(pk?.[key] || 0);
                      return Number.isFinite(val) && val > 0 ? fmtIDR(val) : "–";
                    };
                    return (
                      <tr key={r.nisn} className="hover:bg-slate-50 align-top">
        {/* NO */}
        <td className="px-3 py-2 text-[11px] font-semibold text-slate-800">
          {rowIndexStart + idx + 1}
        </td>
        {/* NISN */}
        <td className="px-3 py-2 font-mono text-[11px] text-slate-800">
          {r.nisn}
        </td>
        <td className="px-3 py-2">
          <div className="font-semibold text-slate-900">
            {r.name}
          </div>
                          {r.phone ? (
                            <div className="text-[11px] text-slate-500">
                              {r.phone}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-800">
                          {r.level}
                        </td>
                        <td className="px-3 py-2">
                          {r.jalur ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                r.jalur === "PTK"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "bg-sky-50 border-sky-200 text-sky-700"
                              }`}
                            >
                              {r.jalur}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              —
                            </span>
                          )}
                        </td>

                        {/* SPP */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {fmtIDR(r.baseSPP)}
                        </td>

                        {/* PAKAIAN */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("pakaian")}
                        </td>
                        {/* SARPRAS */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("sarpras")}
                        </td>
                        {/* KASUR */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("kasur")}
                        </td>
                        {/* KITAB */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("kitab")}
                        </td>
                        {/* BP3 */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("bp3")}
                        </td>
                        {/* TOTAL UANG PANGKAL */}
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {fmtIDR(r.totalPangkal)}
                        </td>

                        {/* TOTAL DIBAYAR = SPP + Total Pangkal */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {fmtIDR(r.baseSPP + r.totalPangkal)}
                        </td>

                        {/* JUMLAH DIBAYAR (total approved) */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {fmtIDR(r.totalPaid)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="px-3 py-2 md:px-4 md:py-3 border-t border-slate-200 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-[11px] md:text-xs text-slate-600">
          <div>
            Menampilkan{" "}
            <span className="font-semibold">
              {paginatedRows.length.toLocaleString("id-ID")}
            </span>{" "}
            dari{" "}
            <span className="font-semibold">
              {filteredRows.length.toLocaleString("id-ID")}
            </span>{" "}
            peserta (total{" "}
            <span className="font-semibold">
              {rows.length.toLocaleString("id-ID")}
            </span>
            ).
          </div>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe === 1}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 disabled:opacity-40"
            >
              &lt;
            </button>
            <span>
              Halaman{" "}
              <span className="font-semibold">{pageSafe}</span> dari{" "}
              <span className="font-semibold">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe === totalPages}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
