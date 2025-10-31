"use client";

/** =========================
 *  UI PAGE – HANYA UI
 *  ========================= */
import { useEffect, useState, useCallback } from "react";
import {
  db, usePembayaranLogic, useVerifiedWaEffect,
  looksLikePdfUrl, classify, getDocLabel, toDateStr, fmtIDR,
} from "./logika-pembayaran";
import { collection, getDocs, query, where, limit as qLimit } from "firebase/firestore";
import {
  ShieldCheck, Search, RefreshCw, FileText, Eye, Check, Clock, Upload, X, ChevronRight, Filter, User
} from "lucide-react";

/* ====== Komponen UI: Modal Kelengkapan Dokumen ====== */
function ModalViewer({ open, onClose, row, data, activeKey, setActiveKey }) {
  const escHandler = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => { if (!open) return; document.addEventListener("keydown", escHandler); return () => document.removeEventListener("keydown", escHandler); }, [open, escHandler]);

  if (!open || !row) return null;
  const filesMeta = data?.filesMeta || {};
  const allKeys = Object.keys(filesMeta || {});
  const currentKey = allKeys.includes(activeKey) ? activeKey : allKeys[0] || "kk";
  const meta = filesMeta[currentKey];

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 md:p-6">
        {/* CENTERED, NOT FULLSCREEN */}
        <div className="w-full max-w-5xl md:max-w-4xl lg:max-w-3xl max-h-[85vh] rounded-3xl bg-white text-black shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="relative flex items-start justify-between gap-4 p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Kelengkapan Dokumen</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-black flex items-baseline gap-2 truncate">
                <span className="truncate">{row.username || row.id}</span>
                <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
                <span className="text-slate-700 font-medium truncate">{row.fullName || "-"}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Dibuat: {toDateStr(data?.createdAt)}
                </span>
                <span>•</span>
                <span>Diperbarui: {toDateStr(data?.updatedAt)}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 text-black items-center justify-center rounded-xl bg-white hover:bg-slate-50 transition-all duration-200 ring-1 ring-slate-200 hover:ring-slate-300 group"
              aria-label="Tutup"
            >
              <X className="h-5 w-5 text-slate-500 group-hover:text-slate-700 transition-colors" />
            </button>
          </div>

          {/* Tab Pills */}
          <div className="px-5 md:px-6 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(filesMeta).map((k) => {
                const ada = Boolean(filesMeta?.[k]?.url);
                const active = k === currentKey;
                return (
                  <button
                    key={k}
                    disabled={!ada}
                    onClick={() => ada && setActiveKey(k)}
                    className={[
                      "px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200",
                      ada
                        ? (active
                            ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/30"
                            : "bg-white text-slate-800 hover:bg-violet-50 hover:text-violet-700 shadow-sm ring-1 ring-slate-200 hover:ring-violet-200")
                        : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {getDocLabel(k)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content (scrollable) */}
          <div className="max-h-[calc(85vh-140px)] overflow-y-auto">
            <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              {meta ? (
                <div className="space-y-2">
                  <div className="font-semibold text-black text-xs md:text-sm uppercase tracking-wide">
                    {(Object.keys(filesMeta).find(k => filesMeta[k]===meta) || "").toUpperCase()}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] md:text-xs text-slate-700">
                    <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-medium">
                      {meta.contentType || "–"}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                      {meta.size ? `${(meta.size / 1024).toFixed(1)} KB` : "–"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-600 text-sm">Dokumen tidak tersedia.</div>
              )}
            </div>

            <div className="p-5 md:p-6 bg-slate-50">
              {!meta ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada yang ditampilkan.</p>
                </div>
              ) : classify(meta) === "image" ? (
                <img src={meta.url} alt="doc" className="w-full h-auto rounded-2xl border border-slate-200 shadow-lg" />
              ) : classify(meta) === "pdf" ? (
                <iframe src={meta.url} title="doc" className="w-full h-[55vh] rounded-2xl border border-slate-200 shadow-lg" />
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-700 mb-3">Format tidak didukung untuk preview.</p>
                  <a
                    href={meta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Buka / Unduh Berkas
                  </a>
                </div>
              )}
              {meta?.url && (
                <div className="mt-4 p-3 rounded-xl bg-slate-100">
                  <code className="text-[10px] text-slate-700 break-all">{meta.url}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== Komponen UI: Modal Bukti Pembayaran (centered, not full) ====== */
function ProofModal({ open, onClose, row, url }) {
  const escHandler = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => { if (!open) return; document.addEventListener("keydown", escHandler); return () => document.removeEventListener("keydown", escHandler); }, [open, escHandler]);

  const [feeInfo, setFeeInfo] = useState({ fee: null, currency: "IDR", label: null });
  useEffect(() => {
    (async () => {
      if (!open) return;
      try {
        const level = row?.registrationLevel || row?.level;
        if (!level) { setFeeInfo((p) => ({ ...p, fee: null, label: null })); return; }
        const qf = query(collection(db, "fees"), where("label","==",String(level)), qLimit(1));
        const d = await getDocs(qf);
        if (!d.empty) {
          const f = d.docs[0].data();
          setFeeInfo({ fee: Number(f?.fee ?? 0), currency: String(f?.currency || "IDR"), label: String(f?.label || level) });
        } else setFeeInfo({ fee: 0, currency:"IDR", label:String(level) });
      } catch { setFeeInfo((p)=>({ ...p, fee: null })); }
    })();
  }, [open, row?.registrationLevel, row?.level]);

  if (!open || !url) return null;
  const isPdf = looksLikePdfUrl(url);

  return (
    <div className="fixed inset-0 z-[75]">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 md:p-6">
        {/* CENTERED, NOT FULLSCREEN */}
        <div className="w-full max-w-4xl md:max-w-3xl max-h-[85vh] rounded-3xl bg-white text-black shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50">
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white px-3 py-1.5 text-xs font-bold shadow-lg shadow-violet-500/30">
                <FileText className="h-3.5 w-3.5" />
                Bukti Pembayaran
              </span>
              {feeInfo.label && (
                <span className="inline-flex items-center rounded-xl bg-slate-100 text-slate-800 px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200">
                  {feeInfo.label}
                </span>
              )}
              {feeInfo.fee != null ? (
                <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1.5 text-xs font-bold shadow-lg shadow-emerald-500/30">
                  {fmtIDR(feeInfo.fee)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-xl bg-slate-100 text-slate-600 px-3 py-1.5 text-xs font-medium ring-1 ring-slate-200">
                  Nominal: –
                </span>
              )}
              <span className="hidden md:inline text-slate-300">•</span>
              <span className="text-black font-semibold truncate">{row?.fullName || "-"}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-700 font-mono text-[11px] truncate">{row?.username || row?.id}</span>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center text-black justify-center rounded-xl bg-white hover:bg-slate-50 transition-all duration-200 ring-1 ring-slate-200 hover:ring-slate-300 group"
              aria-label="Tutup"
            >
              <X className="h-5 w-5 text-slate-500 group-hover:text-slate-700 transition-colors" />
            </button>
          </div>

          {/* Content (scrollable) */}
          <div className="max-h-[calc(85vh-120px)] overflow-y-auto p-5 md:p-6 bg-slate-50">
            {isPdf ? (
              <iframe src={url} title="Bukti Pembayaran" className="w-full h-[55vh] rounded-2xl border border-slate-200 shadow-lg" />
            ) : (
              <img src={url} alt="Bukti Pembayaran" className="w-full h-auto rounded-2xl border border-slate-200 shadow-lg" />
            )}
            <div className="mt-4 p-3 rounded-xl bg-slate-100">
              <code className="text-[10px] text-slate-700 break-all">{url}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== NEW: Modal Detail – nominal terlihat oleh semua ====== */
function RowDetailModal({ open, onClose, row, onOpenViewer, onOpenProof, onApprove }) {
  const escHandler = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => { if (!open) return; document.addEventListener("keydown", escHandler); return () => document.removeEventListener("keydown", escHandler); }, [open, escHandler]);

  const [feeInfo, setFeeInfo] = useState({ fee: null, label: null });
  useEffect(() => {
    (async () => {
      if (!open) return;
      try {
        const level = row?.registrationLevel || row?.level;
        if (!level) { setFeeInfo({ fee: null, label: null }); return; }
        const d = await getDocs(query(collection(db, "fees"), where("label","==",String(level)), qLimit(1)));
        if (!d.empty) {
          const f = d.docs[0].data();
          setFeeInfo({ fee: Number(f?.fee ?? 0), label: String(f?.label || level) });
        } else setFeeInfo({ fee: 0, label: String(level) });
      } catch { setFeeInfo({ fee: null, label: null }); }
    })();
  }, [open, row?.registrationLevel, row?.level]);

  if (!open || !row) return null;
  const isVerified = row.verifiedPayment === true;
  const hasProof = !!row.registrationPaymentProof;

  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {/* CENTERED CARD, NOT FULL */}
        <div className="w-full max-w-md max-h-[85vh] rounded-3xl bg-white ring-1 ring-slate-200 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
            <div className="text-base font-bold text-black truncate">{row.fullName || "-"}</div>
            <div className="text-xs text-slate-700 font-mono truncate">{row.username || row.id}</div>
          </div>
          {/* Body (scrollable) */}
          <div className="px-5 pb-5 pt-4 space-y-3 max-h-[calc(85vh-160px)] overflow-y-auto">
            <Item label="Jenjang" value={row.registrationLevel || "-"} />
            <Item label="ID Pendaftaran" value={row.registrationId || "-"} />
            <Item
              label="Status"
              value={
                isVerified ? (
                  <Badge className="from-emerald-500 to-emerald-600 text-white">Terverifikasi</Badge>
                ) : (
                  <Badge className="bg-amber-100 !from-amber-100 !to-amber-100 text-amber-800 ring-amber-200">Pending</Badge>
                )
              }
            />
            <Item label="Metode">
              <select
                value={row._method}
                onChange={(e)=>onApprove?.("setMethod", e.target.value)}
                disabled={isVerified}
                className={["w-full rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  isVerified ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                             : "border-slate-300 hover:border-violet-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                ].join(" ")}
              >
                <option value="online">Online (WA/Transfer)</option>
                <option value="offline">Offline (Stand)</option>
              </select>
            </Item>
            <Item label="Bukti">
              {hasProof ? (
                <button
                  onClick={onOpenProof}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white px-4 py-2 text-xs font-bold hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                >
                  <Eye className="h-3.5 w-3.5" /> Lihat Bukti
                </button>
              ) : <span className="text-slate-500 text-sm">Belum ada</span>}
            </Item>
            <Item label="Kelengkapan Data">
              <button
                onClick={onOpenViewer}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-700 transition"
              >
                <FileText className="h-3.5 w-3.5" /> Lihat Berkas
              </button>
            </Item>
            <Item label="Nominal">
              {feeInfo.fee != null ? (
                <span className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 bg-emerald-50 text-emerald-700">
                  {fmtIDR(feeInfo.fee)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 text-slate-600">
                  Nominal: –
                </span>
              )}
            </Item>
          </div>
          {/* Footer actions */}
          <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border text-black border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-white transition-all"
            >
              Tutup
            </button>
            {isVerified ? (
              <button
                disabled
                className="rounded-xl px-5 py-2.5 text-sm font-bold bg-slate-200 text-slate-500 cursor-not-allowed"
              >
                Sudah Disetujui
              </button>
            ) : (
              <button
                onClick={() => onApprove?.("verify")}
                disabled={!hasProof}
                className={[
                  "rounded-xl px-5 py-2.5 text-sm font-bold transition-all",
                  hasProof ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                           : "bg-slate-200 text-slate-500 cursor-not-allowed"
                ].join(" ")}
              >
                Setujui
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function Item({ label, value, children }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold">{label}</div>
      <div className="mt-1 text-black">{children ?? value}</div>
    </div>
  );
}
function Badge({ className="", children }) {
  const base = "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold bg-gradient-to-r border-transparent";
  return <span className={`${base} ${className}`} >{children}</span>;
}

/* ====== PAGE: UI SAJA, LOGIKA DI-IMPORT ====== */
export default function AdminPembayaranPage() {
  const logic = usePembayaranLogic();
  useVerifiedWaEffect();

  const [showViewer, setShowViewer] = useState(false);
  const [viewerRow, setViewerRow] = useState(null);
  const [activeKey, setActiveKey] = useState("kk");

  const [showProof, setShowProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [proofRow, setProofRow] = useState(null);

  // Row detail modal
  const [showRowDetail, setShowRowDetail] = useState(false);
  const [rowDetail, setRowDetail] = useState(null);

  // Filter modal (mobile)
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Deteksi mobile (≤ 767px). Hanya mobile yang boleh buka modal detail via klik nama/NISN.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const openViewer = async (r) => {
    const nisn = r.username || r.id;
    const data = await logic.fetchPPDB(nisn);
    setViewerRow(r);
    const fm = data?.filesMeta || {};
    const keys = Object.keys(fm);
    const firstAvail = keys.find((k) => fm[k]?.url) || keys[0] || "kk";
    setActiveKey(firstAvail);
    setShowViewer(true);
  };

  const openRowDetail = (r) => {
    // Buka hanya di mobile
    if (!isMobile) return;
    setRowDetail(r);
    setShowRowDetail(true);
  };

  useEffect(() => {
    // Prefetch PPDB (irit read)
    const rows = logic.filteredRows.slice(0, 50);
    rows.forEach((r) => {
      const nisn = r.username || r.id;
      if (!logic.ppdbMap?.[nisn] && !logic.loadingPPDB?.[nisn]) {
        logic.fetchPPDB(nisn);
      }
    });
  }, [logic.filteredRows, logic.ppdbMap, logic.loadingPPDB, logic.fetchPPDB]);

  const openProof = (r) => {
    if (!r?.registrationPaymentProof) return;
    setProofRow(r);
    setProofUrl(r.registrationPaymentProof);
    setShowProof(true);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Header Section */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">Dashboard Pembayaran</h1>
            <p className="text-slate-700">Kelola dan verifikasi pembayaran pendaftaran siswa</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-5 text-white shadow-lg shadow-violet-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-violet-100 text-sm font-medium">Online Terverifikasi</span>
              <Check className="h-5 w-5 text-violet-200" />
            </div>
            <div className="text-3xl font-bold mb-1">{fmtIDR(logic.onlineAmount)}</div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg shadow-amber-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-100 text-sm font-medium">Offline Terverifikasi</span>
              <Check className="h-5 w-5 text-amber-200" />
            </div>
            <div className="text-3xl font-bold mb-1">{fmtIDR(logic.offlineAmount)}</div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-100 text-sm font-medium">Total Keseluruhan</span>
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
            </div>
            <div className="text-3xl font-bold">{fmtIDR(logic.totalDynamicAmount)}</div>
          </div>
        </div>

        {/* Rekap jumlah siswa (mengikuti filter verifikator) */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-600">Total siswa (sesuai verifikator)</div>
            <div className="mt-1 text-2xl font-bold text-black">{logic.totalSiswaByVerifier}</div>
          </div>
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-600">Terverifikasi</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{logic.totalVerifiedByVerifier}</div>
          </div>
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-600">Pending</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{logic.totalPendingByVerifier}</div>
          </div>
        </div>

        {/* Trigger Filter (mobile) */}
        <div className="md:hidden mb-6">
          <button
            onClick={() => setShowFilterModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-violet-700"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>

          {/* Badge admin */}
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold
                   bg-violet-100 text-violet-700 ring-1 ring-violet-200 shadow-sm">
              <User className="h-3.5 w-3.5" />
              <span className="max-w-[70vw] truncate" suppressHydrationWarning>
                {mounted ? (logic.adminName || logic.adminEmail || "").toString() : ""}
              </span>
            </span>
          </div>
        </div>

        {/* Filters Section (desktop/tablet) */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 mb-6">
          <div className="space-y-4">
            {/* Row 1: Search & Filters */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-black">
              <div className="md:col-span-3 col-span-12 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-4 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Cari Nama/NISN…"
                  value={logic.search}
                  onChange={(e)=>logic.setSearch(e.target.value)}
                />
              </div>

              <select
                className="md:col-span-2 col-span-6 h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                value={logic.statusFilter}
                onChange={(e)=>logic.setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="pending">Butuh Persetujuan</option>
                <option value="verified">Sudah Disetujui</option>
                <option value="unapproved_all">Belum Disetujui</option>
              </select>

              <select
                className="md:col-span-2 col-span-6 h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                value={logic.filterLevel}
                onChange={(e)=>logic.setFilterLevel((e.target.value||"").toLowerCase()==="all" ? "all" : e.target.value)}
              >
                <option value="all">Semua Jenjang</option>
                {logic.levelOptions.map((lv)=>(<option key={lv} value={lv}>{lv}</option>))}
              </select>

              <select
                className="md:col-span-2 col-span-6 h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                value={
                  logic.filterMethod === "online" ? "online" :
                  logic.filterMethod === "offline" ? "offline" :
                  logic.filterProof  === "with"   ? "withProof" :
                  logic.filterProof  === "without"? "withoutProof" : "all"
                }
                onChange={(e)=>{
                  const v = e.target.value;
                  logic.setFilterMethod("all"); logic.setFilterProof("all");
                  if      (v==="online")      logic.setFilterMethod("online");
                  else if (v==="offline")     logic.setFilterMethod("offline");
                  else if (v==="withProof")   logic.setFilterProof("with");
                  else if (v==="withoutProof")logic.setFilterProof("without");
                }}
              >
                <option value="all">Semua Kriteria</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="withProof">Dengan Bukti</option>
                <option value="withoutProof">Tanpa Bukti</option>
              </select>

              {/* Verifier filter – render selalu, sembunyikan sebelum mounted/allowed */}
              <div className="md:col-span-2 col-span-6" hidden={!mounted || !logic.canUseVerifierFilter} aria-hidden={!mounted || !logic.canUseVerifierFilter}>
                <select
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={logic.verifierFilter}
                  onChange={(e) => logic.setVerifierFilter(e.target.value)}
                  title="Filter berdasarkan verifikator (dari data)"
                >
                  <option value="all">Semua Verifikator</option>
                  {logic.verifierOptions.map((em) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 col-span-6 flex items-center gap-2">
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={logic.startDate}
                  onChange={(e)=>logic.setStartDate(e.target.value)}
                />
                <span className="text-slate-400">–</span>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={logic.endDate}
                  onChange={(e)=>logic.setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-black">
              <div className="flex items-center gap-2">
                <input
                  value={logic.adminName}
                  onChange={()=>{}}
                  className="h-10 rounded-xl border border-slate-300 px-4 text-sm bg-slate-50"
                  placeholder="Verifikator"
                  readOnly
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={logic.loadFirst}
                  className="inline-flex items-center gap-2 h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <select
                  className="h-10 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={logic.pageSize}
                  onChange={(e)=>logic.setPageSize(parseInt(e.target.value,10))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr className="text-left text-slate-800 font-semibold">
                  {/* No: kini tampil juga di mobile */}
                  <th className="p-4 w-16 text-center">No</th>
                  <th className="p-4">Nama</th>
                  <th className="p-4">NISN</th>
                  {/* sisanya disembunyikan di mobile */}
                  <th className="p-4 hidden md:table-cell">Jenjang</th>
                  <th className="p-4 hidden md:table-cell">ID Pendaftaran</th>
                  <th className="p-4 hidden md:table-cell">Bukti</th>
                  <th className="p-4 hidden md:table-cell">Metode</th>
                  <th className="p-4 hidden md:table-cell">Status</th>
                  <th className="p-4 hidden md:table-cell">Kelengkapan Data</th>
                  <th className="p-4 w-[200px] hidden md:table-cell">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {logic.filteredRows.map((r, idx) => {
                  const up = logic.uploading[r.id] || { busy:false, progress:0 };
                  const hasProof = !!r.registrationPaymentProof;
                  const isVerified = r.verifiedPayment === true;
                  const nisn = r.username || r.id;

                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      {/* No – kini tidak disembunyikan di mobile */}
                      <td className="p-4 text-center text-slate-700 font-medium">{idx + 1}</td>

                      {/* Nama – klik => modal detail (HANYA mobile) */}
                      <td
                        className="p-4 font-semibold text-black md:cursor-default cursor-pointer md:no-underline underline decoration-dotted underline-offset-4"
                        onClick={() => openRowDetail(r)}
                      >
                        {r.fullName || "-"}
                      </td>

                      {/* NISN – klik => modal detail (HANYA mobile) */}
                      <td
                        className="p-4 font-mono text-slate-800 md:cursor-default cursor-pointer md:no-underline underline decoration-dotted underline-offset-4"
                        onClick={() => openRowDetail(r)}
                      >
                        {nisn}
                      </td>

                      {/* Kolom lain – hanya desktop/tablet */}
                      <td className="p-4 text-slate-800 hidden md:table-cell">{r.registrationLevel || "-"}</td>
                      <td className="p-4 text-slate-700 hidden md:table-cell">{r.registrationId || "-"}</td>

                      <td className="p-4 hidden md:table-cell">
                        {isVerified ? (
                          hasProof ? (
                            <button
                              onClick={()=>openProof(r)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white px-4 py-2 text-xs font-bold hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Bukti Disetujui
                            </button>
                          ) : <span className="text-slate-400">-</span>
                        ) : (
                          <div className="flex items-center gap-2 text-black">
                            <label className={["inline-flex items-center gap-2 rounded-xl border px-4 py-2 cursor-pointer text-xs font-medium transition-all", up.busy ? "opacity-60 pointer-events-none" : "hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700", "border-slate-300"].join(" ")}>
                              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e)=>logic.handleUploadProof(r.id, e.target.files?.[0])} disabled={up.busy}/>
                              {up.busy ? (
                                <>
                                  <Upload className="h-3.5 w-3.5 animate-pulse" />
                                  <span>Mengunggah… {up.progress}%</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Upload Bukti</span>
                                </>
                              )}
                            </label>
                            {hasProof && (
                              <button
                                onClick={()=>openProof(r)}
                                className="inline-flex items-center gap-1 text-violet-700 hover:text-violet-800 text-xs font-semibold underline"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Lihat
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-black hidden md:table-cell">
                        <select
                          value={r._method}
                          onChange={(e)=>logic.setRowMethod(r.id, e.target.value)}
                          disabled={isVerified}
                          className={["rounded-xl border px-3 py-2 text-sm font-medium transition-all", isVerified ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "border-slate-300 hover:border-violet-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"].join(" ")}
                        >
                          <option value="online">Online (WA/Transfer)</option>
                          <option value="offline">Offline (Stand)</option>
                        </select>
                      </td>

                      <td className="p-4 hidden md:table-cell">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                            <Check className="h-3.5 w-3.5" />
                            Terverifikasi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold bg-amber-100 border-amber-300 text-amber-800">
                            <Clock className="h-3.5 w-3.5" />
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="p-4 hidden md:table-cell">
                        {(() => {
                          const kBusy = logic.loadingPPDB[nisn];
                          const kData = logic.ppdbMap[nisn];
                          if (kBusy) return <span className="text-slate-600 text-xs animate-pulse">memuat…</span>;
                          if (kData === undefined) {
                            return (
                              <button
                                onClick={() => logic.fetchPPDB(nisn)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                                   ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-700 transition">
                                <FileText className="h-3.5 w-3.5" />
                                Muat berkas
                              </button>
                            );
                          }
                          const n = Object.keys(kData?.filesMeta || {}).length;
                          const cls = n===0
                            ? "bg-rose-100 text-rose-700 ring-rose-200 hover:bg-rose-200"
                            : n<3
                              ? "bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200"
                              : "bg-emerald-100 text-emerald-700 ring-emerald-200 hover:bg-emerald-200";
                          return (
                            <button
                              onClick={() => openViewer(r)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ring-1 transition-all ${cls}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {n} berkas • Lihat
                            </button>
                          );
                        })()}
                      </td>

                      <td className="p-4 hidden md:table-cell">
                        {isVerified ? (
                          <button
                            disabled
                            className="rounded-xl px-4 py-2 text-sm font-bold bg-slate-200 text-slate-500 cursor-not-allowed"
                          >
                            Sudah Disetujui
                          </button>
                        ) : (
                          <button
                            onClick={()=>logic.openConfirm(r.id)}
                            disabled={!r.registrationPaymentProof || (logic.uploading[r.id]?.busy)}
                            className={[
                              "rounded-xl px-4 py-2 text-sm font-bold transition-all",
                              (!!r.registrationPaymentProof) && !logic.uploading[r.id]?.busy
                                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                                : "bg-slate-200 text-slate-500 cursor-not-allowed"
                            ].join(" ")}
                            title={!r.registrationPaymentProof ? "Upload bukti dulu" : "Setujui pembayaran"}
                          >
                            Setujui
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!logic.filteredRows.length && !logic.loading && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
                      <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-700 font-medium">
                        {logic.filterLevel !== "all"
                          ? `Tidak ada data untuk jenjang ${logic.filterLevel}.`
                          : "Data tidak ditemukan."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-slate-800">
            Menampilkan <span className="font-bold text-violet-600">{logic.filteredRows.length}</span> akun (setelah filter)
          </div>
          <button
            onClick={logic.loadMore}
            disabled={!logic.hasMore || logic.loading}
            className="inline-flex items-center gap-2 rounded-xl text-black border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {logic.loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Memuat…
              </>
            ) : logic.hasMore ? (
              "Muat Lagi"
            ) : (
              "Semua Data Dimuat"
            )}
          </button>
        </div>

        {/* Alerts */}
        {logic.err && (
          <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-rose-900 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <X className="h-5 w-5 text-rose-600 mt-0.5" />
              <p className="flex-1 font-medium">{logic.err}</p>
            </div>
          </div>
        )}
        {Boolean(logic.ok) && (
          <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
              <p className="flex-1 font-medium">{logic.ok}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal konfirmasi verifikasi */}
      {logic.askPwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/50 animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-black mb-2">Konfirmasi Verifikasi</h3>
              <p className="text-sm text-slate-700">
                Masukkan <span className="font-semibold text-black">password konfirmasi admin</span> untuk menyetujui pembayaran.
              </p>
            </div>
            <div className="px-6 pb-2">
              <input
                type="password"
                autoFocus
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="Password konfirmasi"
                value={logic.askPwValue}
                onChange={(e)=>logic.setAskPwValue(e.target.value)}
                onKeyDown={(e)=>{ if (e.key === "Enter") logic.confirmAndVerify(); }}
              />
              {!!logic.askPwErr && (
                <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 flex items-start gap-2">
                  <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{logic.askPwErr}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-5 bg-slate-50">
              <button
                onClick={logic.closeConfirm}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-white transition-all"
              >
                Batal
              </button>
              <button
                onClick={logic.confirmAndVerify}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                Konfirmasi & Setujui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal kelengkapan dokumen */}
      <ModalViewer
        open={showViewer}
        onClose={()=>setShowViewer(false)}
        row={viewerRow}
        data={logic.ppdbMap[viewerRow?.username || viewerRow?.id]}
        activeKey={activeKey}
        setActiveKey={setActiveKey}
      />

      {/* Modal bukti pembayaran – nominal SELALU terlihat */}
      <ProofModal
        open={showProof}
        onClose={()=>setShowProof(false)}
        row={proofRow}
        url={proofUrl}
      />

      {/* ===== MOBILE/ALL: ROW DETAIL MODAL (CENTERED) ===== */}
      <RowDetailModal
        open={showRowDetail}
        onClose={()=>setShowRowDetail(false)}
        row={rowDetail}
        onOpenViewer={() => {
          if (!rowDetail) return;
          // Tutup detail dulu supaya tidak menutup layar
          setShowRowDetail(false);
          // Buka viewer (centered)
          openViewer(rowDetail);
        }}
        onOpenProof={() => {
          if (!rowDetail) return;
          setShowRowDetail(false);
          openProof(rowDetail);
        }}
        onApprove={(action, payload) => {
          if (!rowDetail) return;
          if (action === "setMethod") {
            logic.setRowMethod(rowDetail.id, payload);
            setRowDetail({ ...rowDetail, _method: payload });
          } else if (action === "verify") {
            logic.openConfirm(rowDetail.id);
          }
        }}
      />

      {/* ===== MOBILE FILTER MODAL ===== */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setShowFilterModal(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200
                      animate-in fade-in zoom-in-95 duration-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 font-bold text-black">
                  <Filter className="h-4 w-4" /> Filter
                </div>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>

              {/* ==== ISI FILTER ==== */}
              <div className="space-y-3 text-black">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-4 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    placeholder="Cari Nama/NISN…"
                    value={logic.search}
                    onChange={(e)=>logic.setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={logic.statusFilter}
                  onChange={(e)=>logic.setStatusFilter(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Butuh Persetujuan</option>
                  <option value="verified">Sudah Disetujui</option>
                  <option value="unapproved_all">Belum Disetujui</option>
                </select>

                <select
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={logic.filterLevel}
                  onChange={(e)=>logic.setFilterLevel((e.target.value||"").toLowerCase()==="all" ? "all" : e.target.value)}
                >
                  <option value="all">Semua Jenjang</option>
                  {logic.levelOptions.map((lv)=>(<option key={lv} value={lv}>{lv}</option>))}
                </select>

                <select
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  value={
                    logic.filterMethod === "online" ? "online" :
                    logic.filterMethod === "offline" ? "offline" :
                    logic.filterProof  === "with"   ? "withProof" :
                    logic.filterProof  === "without"? "withoutProof" : "all"
                  }
                  onChange={(e)=>{
                    const v = e.target.value;
                    logic.setFilterMethod("all"); logic.setFilterProof("all");
                    if      (v==="online")      logic.setFilterMethod("online");
                    else if (v==="offline")     logic.setFilterMethod("offline");
                    else if (v==="withProof")   logic.setFilterProof("with");
                    else if (v==="withoutProof")logic.setFilterProof("without");
                  }}
                >
                  <option value="all">Semua Kriteria</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="withProof">Dengan Bukti</option>
                  <option value="withoutProof">Tanpa Bukti</option>
                </select>

                <div hidden={!mounted || !logic.canUseVerifierFilter} aria-hidden={!mounted || !logic.canUseVerifierFilter}>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    value={logic.verifierFilter}
                    onChange={(e) => logic.setVerifierFilter(e.target.value)}
                    title="Filter berdasarkan verifikator (dari data)"
                  >
                    <option value="all">Semua Verifikator</option>
                    {logic.verifierOptions.map((em) => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    value={logic.startDate}
                    onChange={(e)=>logic.setStartDate(e.target.value)}
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    value={logic.endDate}
                    onChange={(e)=>logic.setEndDate(e.target.value)}
                  />
                </div>

                <input
                  value={logic.adminName}
                  onChange={()=>{}}
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm bg-slate-50"
                  placeholder="Verifikator"
                  readOnly
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>{ logic.loadFirst(); setShowFilterModal(false); }}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 transition-all"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Terapkan / Refresh
                  </button>
                  <select
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    value={logic.pageSize}
                    onChange={(e)=>logic.setPageSize(parseInt(e.target.value,10))}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
