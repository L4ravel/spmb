"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileText,
  FileQuestion,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuthEmail } from "@/app/admin/_components/useAuthEmail";
import {
  isVerifiedRegistrationPayment,
  normalizeRegistrationPaymentMethod,
  registrationPaymentDate,
} from "@/app/admin/_lib/registrationPayment";

const nf = new Intl.NumberFormat("id-ID");
const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatDate(value) {
  const date = value instanceof Date ? value : registrationPaymentDate({ createdAt: value });
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isPdfUrl(url = "") {
  return /\.pdf(?:\?|#|$)/i.test(decodeURIComponent(String(url)));
}

function safeExcelText(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function fileDateStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function SummaryCard({ label, value, helper, icon: Icon, tone }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function ProofModal({ row, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!row?.registrationPaymentProof) return null;
  const url = row.registrationPaymentProof;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Tutup pratinjau"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <section className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-slate-900">Bukti pembayaran — {row.fullName || "Tanpa nama"}</h2>
            <p className="truncate text-xs text-slate-500">{row.username || row.nisn || row.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          {isPdfUrl(url) ? (
            <iframe src={url} title="Bukti pembayaran" className="h-[78vh] w-full rounded-xl bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Bukti pembayaran ${row.fullName || "peserta"}`} className="mx-auto max-h-[78vh] max-w-full rounded-xl bg-white object-contain shadow" />
          )}
        </div>
        <footer className="flex justify-end border-t border-slate-200 px-5 py-3">
          <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-violet-700 hover:text-violet-900">
            Buka berkas asli ↗
          </a>
        </footer>
      </section>
    </div>
  );
}

function ProofThumbnail({ row, onOpen }) {
  const url = row.registrationPaymentProof;
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-300">
        <FileQuestion size={15} /> Tidak ada bukti
      </span>
    );
  }

  if (isPdfUrl(url)) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group inline-flex h-24 w-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
        aria-label={`Buka bukti PDF ${row.fullName || "peserta"}`}
      >
        <FileText size={28} />
        <span className="text-xs font-extrabold">Bukti PDF</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative inline-block h-24 w-40 overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100 shadow-sm transition hover:border-violet-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
      aria-label={`Perbesar bukti pembayaran ${row.fullName || "peserta"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Bukti pembayaran ${row.fullName || "peserta"}`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-950/75 px-2 py-1.5 text-[11px] font-bold text-white">
        <Eye size={13} /> Klik untuk perbesar
      </span>
    </button>
  );
}

export default function AuditUangPendaftaranPage() {
  const adminEmail = useAuthEmail();
  const [rows, setRows] = useState([]);
  const [fees, setFees] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [level, setLevel] = useState("all");
  const [proof, setProof] = useState("all");
  const [selectedProof, setSelectedProof] = useState(null);
  const [updatingMethod, setUpdatingMethod] = useState({});
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState("");

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [paymentSnap, feeSnap] = await Promise.all([
        getDocs(collection(db, "users_app")),
        getDocs(collection(db, "fees")),
      ]);

      const feeMap = new Map();
      feeSnap.forEach((feeDoc) => {
        const data = feeDoc.data() || {};
        const label = String(data.label || "").trim();
        if (label) feeMap.set(label, Number(data.fee || 0));
      });

      const paymentRows = paymentSnap.docs
        .map((paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() }))
        .filter(isVerifiedRegistrationPayment)
        .sort((a, b) => {
          const dateA = registrationPaymentDate(a)?.getTime() || 0;
          const dateB = registrationPaymentDate(b)?.getTime() || 0;
          return dateB - dateA;
        });

      setFees(feeMap);
      setRows(paymentRows);
    } catch (loadError) {
      console.error(loadError);
      setError("Data audit gagal dimuat. Periksa koneksi atau aturan akses Firestore.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const changePaymentMethod = useCallback(async (row, nextMethod) => {
    const normalizedNext = normalizeRegistrationPaymentMethod(nextMethod);
    const previousMethod = normalizeRegistrationPaymentMethod(row.registrationPaymentMethod);
    if (!normalizedNext || normalizedNext === previousMethod) return;

    setUpdatingMethod((current) => ({ ...current, [row.id]: true }));
    setError("");
    setSuccess("");
    try {
      await updateDoc(doc(db, "users_app", row.id), {
        registrationPaymentMethod: normalizedNext,
        registrationPaymentMethodPrevious: previousMethod || null,
        registrationPaymentMethodEditedAt: serverTimestamp(),
        registrationPaymentMethodEditedBy: adminEmail || "admin",
        registrationPaymentMethodEditSource: "audit-uang-pendaftaran",
        updatedAt: serverTimestamp(),
      });
      setRows((current) => current.map((item) => (
        item.id === row.id
          ? {
              ...item,
              registrationPaymentMethod: normalizedNext,
              registrationPaymentMethodPrevious: previousMethod || null,
              registrationPaymentMethodEditedBy: adminEmail || "admin",
            }
          : item
      )));
      setSuccess(`Metode pembayaran ${row.fullName || row.id} berhasil diubah menjadi ${normalizedNext}.`);
    } catch (updateError) {
      console.error(updateError);
      setError(`Gagal mengubah metode pembayaran ${row.fullName || row.id}.`);
    } finally {
      setUpdatingMethod((current) => ({ ...current, [row.id]: false }));
    }
  }, [adminEmail]);

  const levels = useMemo(
    () => [...new Set(rows.map((row) => row.registrationLevel).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (method !== "all" && normalizeRegistrationPaymentMethod(row.registrationPaymentMethod) !== method) return false;
      if (level !== "all" && row.registrationLevel !== level) return false;
      const hasProof = Boolean(row.registrationPaymentProof);
      if (proof === "with" && !hasProof) return false;
      if (proof === "without" && hasProof) return false;
      if (!needle) return true;
      return [row.fullName, row.username, row.nisn, row.registrationId, row.registrationLevel]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [rows, search, method, level, proof]);

  const summary = useMemo(() => {
    const online = rows.filter((row) => normalizeRegistrationPaymentMethod(row.registrationPaymentMethod) === "online").length;
    const offline = rows.filter((row) => normalizeRegistrationPaymentMethod(row.registrationPaymentMethod) === "offline").length;
    const withoutProof = rows.filter((row) => !row.registrationPaymentProof).length;
    const total = rows.reduce((sum, row) => sum + (fees.get(row.registrationLevel) || 0), 0);
    return { online, offline, withoutProof, total };
  }, [rows, fees]);

  const downloadXls = useCallback(async () => {
    if (!filteredRows.length || exporting) return;
    setExporting(true);
    setError("");
    setSuccess("");

    try {
      const xlsxModule = await import("xlsx-js-style");
      const XLSX = xlsxModule.default || xlsxModule;
      const generatedAt = new Date();
      const methodLabel = method === "all" ? "Semua metode" : method === "online" ? "Online" : "Offline";
      const levelLabel = level === "all" ? "Semua jenjang" : level;
      const proofLabel = proof === "all" ? "Semua bukti" : proof === "with" ? "Ada bukti" : "Tanpa bukti";

      const filteredSummary = filteredRows.reduce((result, row) => {
        const paymentMethod = normalizeRegistrationPaymentMethod(row.registrationPaymentMethod);
        const amount = Number(fees.get(row.registrationLevel) || 0);
        result.total += amount;
        if (paymentMethod === "online") {
          result.online += 1;
          result.onlineAmount += amount;
        } else if (paymentMethod === "offline") {
          result.offline += 1;
          result.offlineAmount += amount;
        }
        if (!row.registrationPaymentProof) result.withoutProof += 1;

        const levelName = String(row.registrationLevel || "Tanpa jenjang");
        const levelRow = result.byLevel.get(levelName) || { count: 0, online: 0, offline: 0, amount: 0 };
        levelRow.count += 1;
        levelRow.amount += amount;
        if (paymentMethod === "online") levelRow.online += 1;
        if (paymentMethod === "offline") levelRow.offline += 1;
        result.byLevel.set(levelName, levelRow);
        return result;
      }, {
        total: 0,
        online: 0,
        offline: 0,
        onlineAmount: 0,
        offlineAmount: 0,
        withoutProof: 0,
        byLevel: new Map(),
      });

      const summaryRows = [
        ["AUDIT UANG PENDAFTARAN"],
        [`Dibuat: ${generatedAt.toLocaleString("id-ID")}`],
        [`Filter: ${methodLabel} | ${levelLabel} | ${proofLabel}${search.trim() ? ` | Pencarian: ${search.trim()}` : ""}`],
        [],
        ["RINGKASAN DATA"],
        ["Keterangan", "Jumlah Peserta", "Nominal"],
        ["Total hasil filter", filteredRows.length, filteredSummary.total],
        ["Pembayaran online", filteredSummary.online, filteredSummary.onlineAmount],
        ["Pembayaran offline", filteredSummary.offline, filteredSummary.offlineAmount],
        ["Tanpa bukti upload", filteredSummary.withoutProof, ""],
        [],
        ["REKAP PER JENJANG"],
        ["Jenjang", "Jumlah Peserta", "Online", "Offline", "Nominal"],
        ...[...filteredSummary.byLevel.entries()]
          .sort(([a], [b]) => a.localeCompare(b, "id"))
          .map(([levelName, item]) => [levelName, item.count, item.online, item.offline, item.amount]),
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet["!merges"] = [
        XLSX.utils.decode_range("A1:E1"),
        XLSX.utils.decode_range("A2:E2"),
        XLSX.utils.decode_range("A3:E3"),
        XLSX.utils.decode_range("A5:E5"),
        XLSX.utils.decode_range("A12:E12"),
      ];
      summarySheet["!cols"] = [
        { wch: 34 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 22 },
      ];
      summarySheet["!rows"] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 20 }];

      const titleStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
      const sectionStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "4F46E5" } },
        alignment: { horizontal: "left", vertical: "center" },
      };
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "334155" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
      summarySheet.A1.s = titleStyle;
      summarySheet.A2.s = { font: { italic: true, color: { rgb: "475569" } }, alignment: { horizontal: "center" } };
      summarySheet.A3.s = { font: { color: { rgb: "475569" } }, alignment: { horizontal: "center" } };
      summarySheet.A5.s = sectionStyle;
      summarySheet.A12.s = sectionStyle;
      ["A6", "B6", "C6", "A13", "B13", "C13", "D13", "E13"].forEach((cell) => {
        if (summarySheet[cell]) summarySheet[cell].s = headerStyle;
      });

      for (let rowIndex = 6; rowIndex <= 9; rowIndex += 1) {
        const fill = rowIndex % 2 === 0 ? "F8FAFC" : "EEF2FF";
        for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
          const cell = summarySheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
          if (cell) cell.s = { fill: { fgColor: { rgb: fill } }, border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } } };
        }
      }
      ["C7", "C8", "C9"].forEach((cell) => {
        if (summarySheet[cell] && typeof summarySheet[cell].v === "number") summarySheet[cell].z = '"Rp" #,##0';
      });
      for (let rowIndex = 13; rowIndex < summaryRows.length; rowIndex += 1) {
        const excelRow = rowIndex + 1;
        const amountCell = summarySheet[`E${excelRow}`];
        if (amountCell) amountCell.z = '"Rp" #,##0';
        for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
          const cell = summarySheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
          if (cell) cell.s = {
            fill: { fgColor: { rgb: rowIndex % 2 === 0 ? "F8FAFC" : "FFFFFF" } },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
          };
        }
      }

      const detailRows = filteredRows.map((row, index) => {
        const paymentMethod = normalizeRegistrationPaymentMethod(row.registrationPaymentMethod);
        return [
          index + 1,
          safeExcelText(row.fullName || "-"),
          safeExcelText(row.username || row.nisn || row.id),
          safeExcelText(row.registrationId || "-"),
          safeExcelText(row.registrationLevel || "-"),
          paymentMethod === "online" ? "Online" : paymentMethod === "offline" ? "Offline" : "Belum tercatat",
          Number(fees.get(row.registrationLevel) || 0),
          registrationPaymentDate(row) || "",
          safeExcelText(row.registrationPaymentVerifiedBy || "-"),
          row.registrationPaymentProof ? "Ada" : "Tidak Ada",
          row.registrationPaymentProof ? "Buka Bukti" : "-",
        ];
      });
      const detailData = [
        ["DATA AUDIT UANG PENDAFTARAN"],
        [`Dibuat: ${generatedAt.toLocaleString("id-ID")} | Total: ${filteredRows.length.toLocaleString("id-ID")} peserta`],
        [],
        ["No.", "Nama Peserta", "NISN / Username", "ID Pendaftaran", "Jenjang", "Metode", "Nominal", "Waktu Verifikasi", "Verifikator", "Status Bukti", "Bukti Pembayaran"],
        ...detailRows,
      ];
      const detailSheet = XLSX.utils.aoa_to_sheet(detailData, { cellDates: true });
      detailSheet["!merges"] = [XLSX.utils.decode_range("A1:K1"), XLSX.utils.decode_range("A2:K2")];
      detailSheet["!autofilter"] = { ref: `A4:K${detailData.length}` };
      detailSheet["!cols"] = [
        { wch: 7 }, { wch: 34 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
        { wch: 13 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 15 }, { wch: 22 },
      ];
      detailSheet["!rows"] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 8 }, { hpt: 28 }];
      detailSheet.A1.s = titleStyle;
      detailSheet.A2.s = { font: { italic: true, color: { rgb: "475569" } }, alignment: { horizontal: "center" } };
      for (let columnIndex = 0; columnIndex < 11; columnIndex += 1) {
        const headerCell = detailSheet[XLSX.utils.encode_cell({ r: 3, c: columnIndex })];
        if (headerCell) headerCell.s = headerStyle;
      }
      filteredRows.forEach((row, index) => {
        const sheetRow = index + 5;
        const fill = index % 2 === 0 ? "FFFFFF" : "F8FAFC";
        for (let columnIndex = 0; columnIndex < 11; columnIndex += 1) {
          const cell = detailSheet[XLSX.utils.encode_cell({ r: index + 4, c: columnIndex })];
          if (cell) cell.s = {
            fill: { fgColor: { rgb: fill } },
            alignment: { vertical: "center", wrapText: columnIndex === 1 || columnIndex === 4 || columnIndex === 8 },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
          };
        }
        const amountCell = detailSheet[`G${sheetRow}`];
        if (amountCell) amountCell.z = '"Rp" #,##0';
        const dateCell = detailSheet[`H${sheetRow}`];
        if (dateCell && dateCell.v) dateCell.z = "dd/mm/yyyy hh:mm";
        const proofCell = detailSheet[`K${sheetRow}`];
        if (proofCell && row.registrationPaymentProof) {
          proofCell.l = { Target: row.registrationPaymentProof, Tooltip: "Buka bukti pembayaran" };
          proofCell.s = {
            ...(proofCell.s || {}),
            font: { color: { rgb: "4F46E5" }, underline: true, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }
      });

      const workbook = XLSX.utils.book_new();
      workbook.Props = {
        Title: "Audit Uang Pendaftaran",
        Subject: "Rekap pembayaran pendaftaran online dan offline",
        Author: adminEmail || "Admin SPMB",
        CreatedDate: generatedAt,
      };
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");
      XLSX.utils.book_append_sheet(workbook, detailSheet, "Data Audit");
      XLSX.writeFile(workbook, `audit-uang-pendaftaran-${fileDateStamp(generatedAt)}.xls`, {
        bookType: "biff8",
        bookSST: true,
        cellStyles: true,
      });
      setSuccess(`${filteredRows.length.toLocaleString("id-ID")} data audit berhasil diekspor ke Excel.`);
    } catch (exportError) {
      console.error(exportError);
      setError("Gagal membuat file Excel. Silakan coba kembali.");
    } finally {
      setExporting(false);
    }
  }, [adminEmail, exporting, fees, filteredRows, level, method, proof, search]);

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
            <ShieldCheck size={14} /> Audit pembayaran terverifikasi
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Audit Uang Pendaftaran</h1>
          <p className="mt-1 text-sm text-slate-500">Daftar nama, jenjang, metode pembayaran, nominal, dan bukti unggahan.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={downloadXls}
            disabled={loading || exporting || filteredRows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={17} className={exporting ? "animate-bounce" : ""} />
            {exporting ? "Membuat XLS…" : "Download XLS"}
          </button>
          <button
            type="button"
            onClick={loadAudit}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Muat ulang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pembayaran Online" value={nf.format(summary.online)} helper="Peserta terdata" icon={CreditCard} tone="emerald" />
        <SummaryCard label="Pembayaran Offline" value={nf.format(summary.offline)} helper="Peserta terdata" icon={Landmark} tone="blue" />
        <SummaryCard label="Tanpa Bukti" value={nf.format(summary.withoutProof)} helper="Perlu diperiksa" icon={FileQuestion} tone="amber" />
        <SummaryCard label="Total Terdata" value={money.format(summary.total)} helper={`${nf.format(rows.length)} pembayaran`} icon={CheckCircle2} tone="violet" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-300 bg-slate-100 p-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative md:col-span-2">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, NISN, atau ID pendaftaran"
              className="w-full rounded-xl border border-slate-400 bg-white py-3 pl-10 pr-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <select value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-xl border border-slate-400 bg-white px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none [color-scheme:light] focus:border-violet-600 focus:ring-2 focus:ring-violet-200">
            <option className="bg-white text-slate-900" value="all">Semua metode</option>
            <option className="bg-white text-slate-900" value="online">Online</option>
            <option className="bg-white text-slate-900" value="offline">Offline</option>
          </select>
          <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-xl border border-slate-400 bg-white px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none [color-scheme:light] focus:border-violet-600 focus:ring-2 focus:ring-violet-200">
            <option className="bg-white text-slate-900" value="all">Semua jenjang</option>
            {levels.map((item) => <option className="bg-white text-slate-900" key={item} value={item}>{item}</option>)}
          </select>
          <select value={proof} onChange={(event) => setProof(event.target.value)} className="rounded-xl border border-slate-400 bg-white px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none [color-scheme:light] focus:border-violet-600 focus:ring-2 focus:ring-violet-200">
            <option className="bg-white text-slate-900" value="all">Semua bukti</option>
            <option className="bg-white text-slate-900" value="with">Ada bukti</option>
            <option className="bg-white text-slate-900" value="without">Tanpa bukti</option>
          </select>
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {success && (
          <div className="m-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 size={18} /> {success}
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>Menampilkan <strong className="text-slate-800">{nf.format(filteredRows.length)}</strong> dari {nf.format(rows.length)} peserta</span>
          <span className="hidden sm:inline">Sumber: Statistik Pembayaran</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full table-auto text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-extrabold uppercase tracking-wide text-slate-700 shadow-sm">
              <tr>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Nama / NISN</th>
                <th className="px-4 py-3">Jenjang</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Nominal</th>
                <th className="px-4 py-3">Waktu verifikasi</th>
                <th className="px-4 py-3">Verifikator</th>
                <th className="w-48 px-4 py-3 text-center">Bukti upload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">Memuat data audit…</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">Tidak ada data yang cocok dengan filter.</td></tr>
              ) : filteredRows.map((row, index) => {
                const normalizedMethod = normalizeRegistrationPaymentMethod(row.registrationPaymentMethod);
                const isOnline = normalizedMethod === "online";
                return (
                  <tr key={row.id} className="align-middle hover:bg-violet-50/40">
                    <td className="px-4 py-4 font-semibold text-slate-600">{index + 1}</td>
                    <td className="min-w-64 px-4 py-4">
                      <div className="font-bold text-slate-950">{row.fullName || "—"}</div>
                      <div className="mt-1 font-mono text-xs font-semibold text-slate-600">{row.username || row.nisn || row.id}</div>
                    </td>
                    <td className="min-w-52 px-4 py-4 font-semibold text-slate-800">{row.registrationLevel || "—"}</td>
                    <td className="px-4 py-4">
                      <select
                        value={normalizedMethod}
                        disabled={Boolean(updatingMethod[row.id])}
                        onChange={(event) => changePaymentMethod(row, event.target.value)}
                        aria-label={`Ubah metode pembayaran ${row.fullName || row.id}`}
                        title="Klik untuk mengubah metode pembayaran"
                        className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-extrabold shadow-sm outline-none ring-1 transition [color-scheme:light] focus:ring-2 focus:ring-violet-500 disabled:cursor-wait disabled:opacity-60 ${
                          isOnline
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                            : "bg-blue-50 text-blue-800 ring-blue-300"
                        }`}
                      >
                        {!normalizedMethod && <option className="bg-white text-slate-900" value="">Pilih metode</option>}
                        <option className="bg-white text-slate-900" value="online">Online</option>
                        <option className="bg-white text-slate-900" value="offline">Offline</option>
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900">{money.format(fees.get(row.registrationLevel) || 0)}</td>
                    <td className="min-w-44 px-4 py-4 text-xs font-medium text-slate-700">{formatDate(registrationPaymentDate(row))}</td>
                    <td className="max-w-56 truncate px-4 py-4 text-xs font-medium text-slate-700" title={row.registrationPaymentVerifiedBy || ""}>{row.registrationPaymentVerifiedBy || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <ProofThumbnail row={row} onOpen={() => setSelectedProof(row)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedProof && <ProofModal row={selectedProof} onClose={() => setSelectedProof(null)} />}
    </div>
  );
}
