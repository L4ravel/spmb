// app/admin/data-daftar-ulang/page.js
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
import * as XLSX from "xlsx-js-style";

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

const PAGE_SIZES = [10, 25, 50, 100, "ALL"];

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

function formatDateOnly(value) {
  if (!value) return "";

  try {
    const date = value?.toDate
      ? value.toDate()
      : value instanceof Date
      ? value
      : new Date(value);

    if (Number.isNaN(date.getTime())) return String(value || "").trim();

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(value || "").trim();
  }
}

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

    if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s)) {
      return "approved";
    }

    if (["REJECTED", "DENIED", "DECLINED"].includes(s)) {
      return "rejected";
    }

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

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function sortRowsAZ(data) {
  return [...data].sort((a, b) => {
    const nameCompare = normalizeName(a.name).localeCompare(
      normalizeName(b.name),
      "id",
      {
        sensitivity: "base",
        numeric: true,
      }
    );

    if (nameCompare !== 0) return nameCompare;

    return String(a.nisn || "").localeCompare(String(b.nisn || ""), "id", {
      numeric: true,
    });
  });
}

function makeSafeSheetName(value, fallback = "Sheet") {
  const clean = String(value || fallback)
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (clean || fallback).slice(0, 31);
}

function makeUniqueSheetName(wb, rawName) {
  const base = makeSafeSheetName(rawName);
  let name = base;
  let i = 2;

  while (wb.SheetNames.includes(name)) {
    const suffix = ` ${i}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }

  return name;
}

function groupRowsByLevel(data) {
  const map = new Map();

  data.forEach((row) => {
    const level = row.level || "Tanpa Jenjang";

    if (!map.has(level)) {
      map.set(level, []);
    }

    map.get(level).push(row);
  });

  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "id"));
}

function applyExcelStyle(ws, rowCount, colCount) {
  if (!ws || rowCount <= 0 || colCount <= 0) return;

  const thinBorder = {
    top: { style: "thin", color: { rgb: "94A3B8" } },
    bottom: { style: "thin", color: { rgb: "94A3B8" } },
    left: { style: "thin", color: { rgb: "94A3B8" } },
    right: { style: "thin", color: { rgb: "94A3B8" } },
  };

  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const cellRef = XLSX.utils.encode_cell({ r, c });

      if (!ws[cellRef]) {
        ws[cellRef] = { t: "s", v: "" };
      }

      ws[cellRef].s = {
        border: thinBorder,
        alignment: {
          vertical: "center",
          horizontal: r === 0 ? "center" : c === 0 ? "center" : "left",
          wrapText: true,
        },
        font: {
          name: "Arial",
          sz: 10,
          bold: r === 0,
          color: { rgb: r === 0 ? "0F172A" : "111827" },
        },
        fill:
          r === 0
            ? {
                patternType: "solid",
                fgColor: { rgb: "E2E8F0" },
              }
            : undefined,
      };
    }
  }

  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, rowCount - 1), c: Math.max(0, colCount - 1) },
    }),
  };
}

function appendStyledSheet(wb, sheetName, sheetData, colWidths) {
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = colWidths;
  applyExcelStyle(ws, sheetData.length, sheetData[0]?.length || 0);
  XLSX.utils.book_append_sheet(wb, ws, makeUniqueSheetName(wb, sheetName));
}

function normalizeWaNumber(raw) {
  if (!raw) return "";

  let n = raw.toString().replace(/\D/g, "");

  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (!n.startsWith("62")) n = "62" + n;

  return n;
}

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

function DownloadLevelModal({
  open,
  type,
  levels,
  selectedLevels,
  includeAllSheet,
  onToggleLevel,
  onToggleAllLevels,
  onToggleIncludeAllSheet,
  onClose,
  onDownload,
}) {
  if (!open) return null;

  const allLevelsChecked =
    levels.length > 0 && selectedLevels.length === levels.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            Download Excel {type === "SIMPLE" ? "Ringkas" : "Lengkap"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Centang jenjang yang ingin dibuat menjadi sheet Excel.
          </p>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={allLevelsChecked}
              onChange={onToggleAllLevels}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />

            <span>
              <span className="block font-semibold">Pilih semua jenjang</span>
              <span className="block text-xs text-slate-500">
                Semua jenjang dibuat per sheet sesuai nama jenjangnya.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <input
              type="checkbox"
              checked={includeAllSheet}
              onChange={onToggleIncludeAllSheet}
              className="mt-0.5 h-4 w-4 rounded border-emerald-300"
            />

            <span>
              <span className="block font-semibold">
                Tambahkan sheet Semua Jenjang
              </span>
              <span className="block text-xs text-emerald-700">
                Semua jenjang digabung dalam 1 sheet tambahan.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {levels.map((level) => (
              <label
                key={level}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-800 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedLevels.includes(level)}
                  onChange={() => onToggleLevel(level)}
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="font-medium">{level}</span>
              </label>
            ))}
          </div>

          {!levels.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Tidak ada jenjang yang cocok dengan filter saat ini.
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onDownload}
            disabled={!includeAllSheet && selectedLevels.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [viewMode, setViewMode] = useState("SUMMARY");
  const [statScope, setStatScope] = useState("ALL");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [sentWA, setSentWA] = useState({});

  const [downloadModalType, setDownloadModalType] = useState(null);
  const [selectedDownloadLevels, setSelectedDownloadLevels] = useState([]);
  const [includeAllDownloadSheet, setIncludeAllDownloadSheet] = useState(false);

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
        const finalSnap = await getDocs(
          query(
            collection(db, "users_app"),
            where("finalDecision", "==", "LULUS")
          )
        );

        const feesSnap = await getDocs(collection(db, "re_registration_fees"));
        const feesByLabel = {};

        feesSnap.forEach((d) => {
          const data = d.data() || {};
          const label = normalizeText(data.label || data.key);

          if (!label) return;

          feesByLabel[label] = {
            spp: typeof data.spp === "number" ? data.spp : 0,
            uangPangkal:
              data.uangPangkal && typeof data.uangPangkal === "object"
                ? data.uangPangkal
                : {},
          };
        });

        const ppdbSnap = await getDocs(collection(db, "ppdb"));
        const ppdbById = {};

        ppdbSnap.forEach((d) => {
          ppdbById[d.id] = d.data() || {};
        });

        const reRegSnap = await getDocs(collectionGroup(db, "re_registration"));

        const discountsByNisn = {};
        let totalDiscountPTK = 0;
        let totalDiscountNonPTK = 0;

        reRegSnap.forEach((docSnap) => {
          const docId = docSnap.id;

          if (docId !== "ptk_discount" && docId !== "nonptk_discount") return;

          const data = docSnap.data() || {};
          const amount = Number(data.amount || 0);

          if (!Number.isFinite(amount) || amount <= 0) return;

          const parent = docSnap.ref.parent;
          const userRef = parent?.parent;
          const nisn = userRef?.id || "";

          if (!nisn) return;

          const type = normalizeText(data.type).toUpperCase();
          const siblingsCount = Number(data.siblingsCount || 0) || 0;
          const amountBP3 = Number(data.amountBP3 || 0) || 0;
          const amountSPP = Number(data.amountSPP || 0) || 0;
          const sourceKey = normalizeText(data.sourceKey);

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
          } else {
            discountsByNisn[nisn].nonptk += amount;
            discountsByNisn[nisn].nonptkMeta = {
              type,
              siblingsCount,
              sourceKey,
            };
            totalDiscountNonPTK += amount;
          }
        });

        const paySnap = await getDocs(collectionGroup(db, "payments"));
        const payAggByNisn = {};

        paySnap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const parent = docSnap.ref.parent;
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
              firstPaidAt: null,
              lastPaidAt: null,
            };
          }

          const agg = payAggByNisn[nisn];
          agg.count += 1;

          if (status === "approved") {
            agg.totalApproved += amount;

            if (ms && (!agg.firstPaidAt || ms < agg.firstPaidAt)) {
              agg.firstPaidAt = ms;
            }

            if (ms && (!agg.lastPaidAt || ms > agg.lastPaidAt)) {
              agg.lastPaidAt = ms;
            }
          }
        });

        const tmpRows = [];
        let statTotalTagihanNet = 0;
        let statTotalPaid = 0;
        let statTotalSisa = 0;

        for (const fSnap of finalSnap.docs) {
          const ud = fSnap.data() || {};
          const nisn = normalizeText(ud.nisn || fSnap.id);

          if (!nisn) continue;

          const level = normalizeText(
            ud.registrationLevel || ud.jenjangDiterima || ud.jenjang
          );

          if (!level) continue;

          const name =
            normalizeText(ud.fullName || ud.nama || ud.name || ud.studentName) ||
            nisn;

          const phone = normalizeText(
            ud.noWa || ud.whatsapp || ud.phone || ud.hp || ud.noHP
          );

          const fee = feesByLabel[level] || null;
          const baseSPP = Number(fee?.spp || 0) || 0;

          let pangkalComponents = {};
          let totalPangkal = 0;

          if (fee?.uangPangkal && typeof fee.uangPangkal === "object") {
            pangkalComponents = fee.uangPangkal;

            for (const v of Object.values(fee.uangPangkal)) {
              const n = Number(v || 0);

              if (Number.isFinite(n)) {
                totalPangkal += n;
              }
            }
          }

          const totalAwal = baseSPP + totalPangkal;

          const discInfo = discountsByNisn[nisn] || { ptk: 0, nonptk: 0 };
          const discPTK = Number(discInfo.ptk || 0);
          const discNonPTK = Number(discInfo.nonptk || 0);
          const totalDisc =
            (Number.isFinite(discPTK) ? discPTK : 0) +
            (Number.isFinite(discNonPTK) ? discNonPTK : 0);

          const ppdbData = ppdbById[nisn] || {};
          const waliWa = normalizeText(ppdbData.waliWa);
          const ayahNama = normalizeText(ppdbData.ayahNama);
          const ibuNama = normalizeText(ppdbData.ibuNama);
          const tempatLahir = normalizeText(ppdbData.tempatLahir);
          const tglLahir = formatDateOnly(ppdbData.tglLahir);
          const ayahIncomeRaw = normalizeText(ppdbData.ayahIncome);

          let netTagihan = Math.max(0, totalAwal - totalDisc);

          if (isPpsJenjang(level) && !ayahIncomeRaw) {
            netTagihan = 0;
          }

          const payAgg = payAggByNisn[nisn] || {
            totalApproved: 0,
            count: 0,
            firstPaidAt: null,
            lastPaidAt: null,
          };

          const totalPaid = payAgg.totalApproved || 0;
          const sisa = Math.max(0, netTagihan - totalPaid);

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
              discountLabel = "PTK bersaudara + SPP";
            } else if (punyaSaudara) {
              discountLabel = "PTK bersaudara";
            } else if (!hasSPP && hasBP3) {
              discountLabel = "PTK non SPP (BP3)";
            } else if (hasSPP && !hasBP3) {
              discountLabel = "PTK SPP";
            } else if (hasSPP && hasBP3) {
              discountLabel = "PTK SPP+BP3";
            } else {
              discountLabel = "PTK";
            }
          } else if (discNonPTK > 0 && discInfo.nonptkMeta) {
            const meta = discInfo.nonptkMeta;
            const punyaSaudara = (meta.siblingsCount || 0) > 0;
            const sourceKey = normalizeText(meta.sourceKey).toLowerCase();
            const t = meta.type || "";
            const isSPP =
              t === "SPP" ||
              sourceKey === "spp" ||
              sourceKey.endsWith(".spp");
            const isBP3 = t === "BP3" || sourceKey.includes("bp3");

            if (isSPP) {
              discountLabel = "SPP yatim";
            } else if (isBP3 || punyaSaudara) {
              discountLabel = "BP3 bersaudara";
            } else {
              discountLabel = "Non-PTK";
            }
          }

          tmpRows.push({
            nisn,
            name,
            ayahNama,
            ibuNama,
            tempatLahir,
            tglLahir,
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
            firstPaidAt: payAgg.firstPaidAt,
            lastPaidAt: payAgg.lastPaidAt,
            statusDaftarUlang,
            discountLabel,
          });

          statTotalTagihanNet += netTagihan;
          statTotalPaid += totalPaid;
          statTotalSisa += sisa;
        }

        if (!alive) return;

        const sortedRows = sortRowsAZ(tmpRows);

        setRows(sortedRows);
        setStats({
          totalParticipants: sortedRows.length,
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
      out = out.filter((r) => (r.jalur || "") !== "PTK");
    } else if (filterJalur === "NON_PTK_DISC") {
      out = out.filter(
        (r) =>
          (r.jalur || "") !== "PTK" && (Number(r.discNonPTK || 0) || 0) > 0
      );
    }

    if (filterLevel !== "ALL") {
      out = out.filter((r) => r.level === filterLevel);
    }

    if (filterStatus !== "ALL") {
      out = out.filter((r) => r.statusDaftarUlang === filterStatus);
    }

    return sortRowsAZ(out);
  }, [rows, search, filterJalur, filterLevel, filterStatus]);

  const scopedStats = useMemo(() => {
    let filtered = [...filteredRows];

    if (statScope === "PTK") {
      filtered = filtered.filter((r) => r.jalur === "PTK");
    } else if (statScope === "NON_PTK") {
      filtered = filtered.filter((r) => (r.jalur || "") !== "PTK");
    }

    return {
      participants: filtered.length,
      totalTagihanNet: filtered.reduce(
        (sum, r) => sum + (Number(r.netTagihan || 0) || 0),
        0
      ),
      totalPaid: filtered.reduce(
        (sum, r) => sum + (Number(r.totalPaid || 0) || 0),
        0
      ),
      totalSisa: filtered.reduce(
        (sum, r) => sum + (Number(r.sisa || 0) || 0),
        0
      ),
    };
  }, [filteredRows, statScope]);

  const discountValue = useMemo(() => {
    let totalPTK = 0;
    let totalNonPTK = 0;

    filteredRows.forEach((r) => {
      totalPTK += Number(r.discPTK || 0) || 0;
      totalNonPTK += Number(r.discNonPTK || 0) || 0;
    });

    if (statScope === "ALL") return fmtIDR(totalPTK + totalNonPTK);
    if (statScope === "PTK") return fmtIDR(totalPTK);
    if (statScope === "NON_PTK") return fmtIDR(totalNonPTK);

    return "-";
  }, [filteredRows, statScope]);

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

  const isShowAll = pageSize === "ALL";

  const totalPages = useMemo(() => {
    if (isShowAll) return 1;
    return Math.max(1, Math.ceil(filteredRows.length / Number(pageSize)));
  }, [filteredRows.length, pageSize, isShowAll]);

  const pageSafe = isShowAll ? 1 : Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    if (isShowAll) return filteredRows;

    const start = (pageSafe - 1) * Number(pageSize);
    return filteredRows.slice(start, start + Number(pageSize));
  }, [filteredRows, pageSafe, pageSize, isShowAll]);

  const rowIndexStart = isShowAll ? 0 : (pageSafe - 1) * Number(pageSize);

  const levelOptions = useMemo(() => {
    const set = new Set();

    rows.forEach((r) => {
      if (r.level) set.add(r.level);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [rows]);

  const downloadLevelOptions = useMemo(() => {
    const set = new Set();

    filteredRows.forEach((r) => {
      if (r.level) set.add(r.level);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [filteredRows]);

  const openDownloadModal = (type) => {
    if (!filteredRows.length) return;

    setDownloadModalType(type);
    setSelectedDownloadLevels(downloadLevelOptions);
    setIncludeAllDownloadSheet(false);
  };

  const closeDownloadModal = () => {
    setDownloadModalType(null);
    setSelectedDownloadLevels([]);
    setIncludeAllDownloadSheet(false);
  };

  const toggleDownloadLevel = (level) => {
    setSelectedDownloadLevels((prev) =>
      prev.includes(level)
        ? prev.filter((item) => item !== level)
        : [...prev, level]
    );
  };

  const toggleAllDownloadLevels = () => {
    setSelectedDownloadLevels((prev) =>
      prev.length === downloadLevelOptions.length ? [] : downloadLevelOptions
    );
  };

  const buildSimpleSheetData = (data) => {
    const header = [
      "No",
      "NISN",
      "Nama",
      "Jenjang",
      "Tempat Lahir",
      "Tanggal Lahir",
      "Nama Ayah",
      "Nama Ibu",
      "Nomor HP/Wali",
    ];

    const body = sortRowsAZ(data).map((r, idx) => [
      idx + 1,
      r.nisn || "",
      r.name || "",
      r.level || "",
      r.tempatLahir || "",
      r.tglLahir || "",
      r.ayahNama || "",
      r.ibuNama || "",
      r.waliWa || r.phone || "",
    ]);

    return [header, ...body];
  };

  const buildFullSheetData = (data) => {
    const header = [
      "No",
      "NISN",
      "Nama",
      "Jenjang",
      "Tempat Lahir",
      "Tanggal Lahir",
      "Nama Ayah",
      "Nama Ibu",
      "Nomor HP/Wali",
      "Jalur",
      "Keterangan Potongan",
      "SPP",
      "Pakaian",
      "Sarpras",
      "Kasur",
      "Kitab",
      "BP3",
      "Total Uang Pangkal",
      "Tagihan Awal",
      "Potongan PTK",
      "Potongan Non-PTK",
      "Total Potongan",
      "Tagihan Net",
      "Terbayar",
      "Sisa",
      "Status",
      "Jumlah Bukti",
      "Pertama Bayar",
      "Terakhir Bayar",
    ];

    const body = sortRowsAZ(data).map((r, idx) => {
      const pk = r.pangkalComponents || {};

      const getPkValNum = (key) => {
        const val = Number(pk?.[key] || 0);
        return Number.isFinite(val) ? val : 0;
      };

      return [
        idx + 1,
        r.nisn || "",
        r.name || "",
        r.level || "",
        r.tempatLahir || "",
        r.tglLahir || "",
        r.ayahNama || "",
        r.ibuNama || "",
        r.waliWa || r.phone || "",
        r.jalur || "",
        r.discountLabel || "",
        Number(r.baseSPP || 0) || 0,
        getPkValNum("pakaian"),
        getPkValNum("sarpras"),
        getPkValNum("kasur"),
        getPkValNum("kitab"),
        getPkValNum("bp3"),
        Number(r.totalPangkal || 0) || 0,
        Number(r.totalAwal || 0) || 0,
        Number(r.discPTK || 0) || 0,
        Number(r.discNonPTK || 0) || 0,
        Number(r.totalDisc || 0) || 0,
        Number(r.netTagihan || 0) || 0,
        Number(r.totalPaid || 0) || 0,
        Number(r.sisa || 0) || 0,
        r.statusDaftarUlang || "",
        r.buktiCount || 0,
        formatDateTime(r.firstPaidAt),
        formatDateTime(r.lastPaidAt),
      ];
    });

    return [header, ...body];
  };

  const runDownloadXls = (type) => {
    if (!filteredRows.length) return;

    const pickedLevels = new Set(selectedDownloadLevels);
    const selectedRows = filteredRows.filter((r) => pickedLevels.has(r.level));

    if (!selectedRows.length && !includeAllDownloadSheet) return;

    const ts = new Date().toISOString().slice(0, 10);
    const wb = XLSX.utils.book_new();
    const isSimple = type === "SIMPLE";

    const simpleColWidths = [
      { wch: 6 },
      { wch: 18 },
      { wch: 34 },
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
      { wch: 30 },
      { wch: 30 },
      { wch: 22 },
    ];

    const fullColWidths = [
      { wch: 6 },
      { wch: 18 },
      { wch: 34 },
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
      { wch: 30 },
      { wch: 30 },
      { wch: 22 },
      { wch: 14 },
      { wch: 26 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 20 },
    ];

    const buildSheetData = isSimple ? buildSimpleSheetData : buildFullSheetData;
    const colWidths = isSimple ? simpleColWidths : fullColWidths;

   if (includeAllDownloadSheet && selectedRows.length) {
  appendStyledSheet(
    wb,
    "Semua Jenjang",
    buildSheetData(selectedRows),
    colWidths
  );
}

    const grouped = groupRowsByLevel(selectedRows);

    grouped.forEach(([level, data]) => {
      appendStyledSheet(wb, level, buildSheetData(data), colWidths);
    });

    XLSX.writeFile(
      wb,
      `data-daftar-ulang-${isSimple ? "ringkas" : "lengkap"}-${ts}.xlsx`,
      { bookType: "xlsx" }
    );

    closeDownloadModal();
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

            <div className="flex flex-wrap items-center gap-2">
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

              <select
                value={pageSize}
                onChange={(e) => {
                  const value = e.target.value;
                  setPageSize(value === "ALL" ? "ALL" : Number(value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n === "ALL" ? "Semua" : n}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openDownloadModal("SIMPLE")}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-500 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Excel Ringkas
              </button>

              <button
                type="button"
                onClick={() => openDownloadModal("FULL")}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Excel Lengkap
              </button>
            </div>
          </div>
        </div>

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
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">NISN</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Jenjang</th>
                    <th className="px-3 py-2">Jalur</th>
                    <th className="px-3 py-2 text-right">Tagihan Awal</th>
                    <th className="px-3 py-2 text-right">Potongan</th>
                    <th className="px-3 py-2 text-right">Tagihan Net</th>
                    <th className="px-3 py-2 text-right">Terbayar</th>
                    <th className="px-3 py-2 text-right">Sisa</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-center">Bukti</th>
                    <th className="px-3 py-2">Pertama Bayar</th>
                    <th className="px-3 py-2">Hubungi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((r, idx) => (
                    <tr key={r.nisn} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-[11px] font-semibold text-slate-800">
                        {rowIndexStart + idx + 1}
                      </td>

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

                        {(r.tempatLahir || r.tglLahir) && (
                          <div className="text-[11px] text-slate-500">
                            TTL: {[r.tempatLahir, r.tglLahir]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}

                        {r.waliWa ? (
                          <div className="text-[11px] text-slate-500">
                            Wali: {r.waliWa}
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
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border border-violet-200 bg-violet-50 text-violet-700">
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
                        {formatDateTime(r.firstPaidAt)}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {(r.statusDaftarUlang === "BELUM BAYAR" ||
                          r.statusDaftarUlang === "SEBAGIAN") &&
                        r.waliWa ? (
                          <a
                            href={`https://web.whatsapp.com/send?phone=${normalizeWaNumber(
                              r.waliWa
                            )}&text=${encodeURIComponent(
                              `Bismillah..\n\nDiberitahukan kepada Yth. Bapak/Ibu Wali Santri dari *${r.name}*, bahwa proses *daftar ulang* ananda masih *belum diselesaikan*.\n\nAdapun sisa pembayaran daftar ulang yang perlu dilunasi adalah sebesar *${fmtIDR(
                                r.sisa
                              )}*.\n\nKami berharap Bapak/Ibu dapat melakukan pelunasan sebelum kedatangan santri, agar proses administrasi dan penerimaan ananda dapat berjalan dengan baik dan lancar.\n\nUntuk informasi lebih lanjut, silakan menghubungi panitia di nomor *0877 2024 2025*.\n\nTerima kasih atas perhatian dan kerja samanya.\nSyukron jazakumullahu khairan.\n\n— Panitia SPMB`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              setSentWA((prev) => ({
                                ...prev,
                                [r.nisn]: true,
                              }))
                            }
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white ${
                              sentWA[r.nisn]
                                ? "bg-slate-400 cursor-default"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                          >
                            {sentWA[r.nisn] ? "Hubungi WA ✓" : "Hubungi WA"}
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">NISN</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Jenjang</th>
                    <th className="px-3 py-2">Jalur</th>
                    <th className="px-3 py-2 text-right">SPP</th>
                    <th className="px-3 py-2 text-right">Pakaian</th>
                    <th className="px-3 py-2 text-right">Sarpras</th>
                    <th className="px-3 py-2 text-right">Kasur</th>
                    <th className="px-3 py-2 text-right">Kitab</th>
                    <th className="px-3 py-2 text-right">BP3</th>
                    <th className="px-3 py-2 text-right">Total Pangkal</th>
                    <th className="px-3 py-2 text-right">Total Dibayar</th>
                    <th className="px-3 py-2 text-right">Jumlah Dibayar</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((r, idx) => {
                    const pk = r.pangkalComponents || {};

                    const getPkVal = (key) => {
                      const val = Number(pk?.[key] || 0);
                      return Number.isFinite(val) && val > 0
                        ? fmtIDR(val)
                        : "–";
                    };

                    return (
                      <tr key={r.nisn} className="hover:bg-slate-50 align-top">
                        <td className="px-3 py-2 text-[11px] font-semibold text-slate-800">
                          {rowIndexStart + idx + 1}
                        </td>

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

                          {(r.tempatLahir || r.tglLahir) && (
                            <div className="text-[11px] text-slate-500">
                              TTL: {[r.tempatLahir, r.tglLahir]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          )}

                          {r.waliWa ? (
                            <div className="text-[11px] text-slate-500">
                              Wali: {r.waliWa}
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
                          {fmtIDR(r.baseSPP)}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("pakaian")}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("sarpras")}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("kasur")}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("kitab")}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {getPkVal("bp3")}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {fmtIDR(r.totalPangkal)}
                        </td>

                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {fmtIDR(r.baseSPP + r.totalPangkal)}
                        </td>

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
              {stats.totalParticipants.toLocaleString("id-ID")}
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
              Halaman <span className="font-semibold">{pageSafe}</span> dari{" "}
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

      <DownloadLevelModal
        open={Boolean(downloadModalType)}
        type={downloadModalType}
        levels={downloadLevelOptions}
        selectedLevels={selectedDownloadLevels}
        includeAllSheet={includeAllDownloadSheet}
        onToggleLevel={toggleDownloadLevel}
        onToggleAllLevels={toggleAllDownloadLevels}
        onToggleIncludeAllSheet={() =>
          setIncludeAllDownloadSheet((prev) => !prev)
        }
        onClose={closeDownloadModal}
        onDownload={() => runDownloadXls(downloadModalType)}
      />
    </main>
  );
}