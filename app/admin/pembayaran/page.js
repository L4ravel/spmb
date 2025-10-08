"use client";


import { useAdminPayments } from "./ppdbPaymentsAdmin";
import { useEffect, useState, useCallback } from "react";

/* ====== Firebase client init ====== */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
} from "firebase/firestore";

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
const app = getFirebaseApp();
const db = getFirestore(app);

/* ====== Utils ====== */
const REQUIRED_KEYS = ["kk", "akta", "ijazah", "foto", "kip"];
const countFilled = (filesMeta = {}) =>
  REQUIRED_KEYS.reduce((n, k) => (filesMeta?.[k]?.path ? n + 1 : n), 0);

const toDateStr = (ts) => {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    if (!d) return "—";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return "—";
  }
};
const classify = (meta) => {
  const ct = (meta?.contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf" || ct.includes("pdf")) return "pdf";
  return "other";
};
const looksLikePdfUrl = (url = "") => /\.pdf(\?|#|$)/i.test(url);

/* ====== Modal Viewer Kelengkapan ====== */
function ModalViewer({ open, onClose, row, data, activeKey, setActiveKey }) {
  const escHandler = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", escHandler);
    return () => document.removeEventListener("keydown", escHandler);
  }, [open, escHandler]);

  if (!open || !row) return null;
  const filesMeta = data?.filesMeta || {};
  const available = REQUIRED_KEYS.filter((k) => filesMeta?.[k]?.url);
  const currentKey = available.includes(activeKey) ? activeKey : (available[0] || "kk");
  const meta = filesMeta[currentKey];

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-5xl rounded-2xl bg-white text-black shadow-2xl ring-1 ring-slate-200">
          {/* header */}
          <div className="flex items-start justify-between gap-3 p-4 md:p-5 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Kelengkapan Dokumen • NISN</div>
              <div className="text-lg md:text-xl font-semibold text-slate-900">
                {row.username || row.id} <span className="text-slate-500 font-normal">• {row.fullName || "-"}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Dibuat: {toDateStr(data?.createdAt)} • Diperbarui: {toDateStr(data?.updatedAt)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>

          {/* tabs dokumen */}
          <div className="px-4 md:px-5 pt-3 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              {REQUIRED_KEYS.map((k) => {
                const ada = Boolean(filesMeta?.[k]?.url);
                const active = k === currentKey;
                return (
                  <button
                    key={k}
                    disabled={!ada}
                    onClick={() => ada && setActiveKey(k)}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs font-medium ring-1",
                      ada
                        ? active
                          ? "bg-violet-600 text-white ring-violet-600"
                          : "bg-white text-violet-700 ring-violet-200 hover:bg-violet-50"
                        : "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {k.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* body */}
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="px-4 md:px-5 py-3 border-b border-slate-200 text-sm">
              {meta ? (
                <div className="text-slate-600">
                  <div className="font-medium text-slate-900">{currentKey.toUpperCase()}</div>
                  <div className="mt-0.5 text-xs">
                    Tipe: {meta.contentType || "—"} • Ukuran: {meta.size ? `${meta.size} byte` : "—"}
                  </div>
                  <div className="mt-1">
                    <code className="text-[12px] text-slate-500">{meta.path}</code>
                  </div>
                </div>
              ) : (
                <div className="text-slate-600">Dokumen tidak tersedia.</div>
              )}
            </div>

            <div className="p-4 md:p-5">
              {!meta ? (
                <div className="text-slate-500">Tidak ada yang ditampilkan.</div>
              ) : classify(meta) === "image" ? (
                <img src={meta.url} alt={currentKey} className="w-full h-auto rounded-lg border border-slate-200" />
              ) : classify(meta) === "pdf" ? (
                <iframe
                  src={meta.url}
                  title={currentKey}
                  className="w-full h-[70vh] rounded-lg border border-slate-200"
                />
              ) : (
                <div className="text-slate-600">
                  Format tidak didukung.{" "}
                  <a href={meta.url} target="_blank" rel="noreferrer" className="text-violet-700 underline">
                    Buka / Unduh berkas
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== Modal Viewer Bukti Pembayaran ====== */
function ProofModal({ open, onClose, row, url }) {
  const escHandler = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", escHandler);
    return () => document.removeEventListener("keydown", escHandler);
  }, [open, escHandler]);

  if (!open || !url) return null;

  const isPdf = looksLikePdfUrl(url);

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-4xl rounded-2xl bg-white text-black shadow-2xl ring-1 ring-slate-200">
          {/* header */}
          <div className="flex items-center justify-between gap-3 p-4 md:p-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-violet-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                Bukti Pembayaran
              </span>
              <span className="text-slate-900 font-medium">{row?.fullName || "-"}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-mono">{row?.username || row?.id}</span>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div className="max-h-[80vh] overflow-y-auto p-4 md:p-5">
            {isPdf ? (
              <iframe src={url} title="Bukti Pembayaran" className="w-full h-[70vh] rounded-lg border border-slate-200" />
            ) : (
              <img src={url} alt="Bukti Pembayaran" className="w-full h-auto rounded-lg border border-slate-200" />
            )}
            <div className="mt-3 text-xs text-slate-500 break-all">
              <code className="text-[11px]">{url}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== Halaman utama ====== */
function formatIDR(n) {
  try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n); }
  catch { return `Rp ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`; }
}

export default function AdminPembayaranPage() {
  const {
    rows, loading, err, ok, hasMore, recap, totalVerifiedAmount,
    pageSize, setPageSize, search, setSearch, adminName, setAdminName,
    statusFilter, setStatusFilter,
    filterMethod, setFilterMethod, filterProof, setFilterProof,
    filterLevel, setFilterLevel,
    startDate, setStartDate, endDate, setEndDate,
    loadFirst, loadMore, setRowMethod, handleUploadProof,
    openConfirm, closeConfirm, confirmAndVerify, canVerify,
    askPwOpen, askPwErr, askPwValue, setAskPwValue,
    uploading,
  } = useAdminPayments();

  // cache data kelengkapan ppdb per NISN
  const [ppdbMap, setPpdbMap] = useState({}); // { [nisn]: { filesMeta, createdAt, updatedAt, nama } }
  const [loadingK, setLoadingK] = useState({}); // { [nisn]: true/false }

  // modal kelengkapan
  const [showViewer, setShowViewer] = useState(false);
  const [viewerRow, setViewerRow] = useState(null);
  const [activeKey, setActiveKey] = useState("kk");

  // modal bukti
  const [showProof, setShowProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [proofRow, setProofRow] = useState(null);

  function setKriteria(val) {
    setFilterMethod("all"); setFilterProof("all");
    if (val === "online") setFilterMethod("online");
    else if (val === "offline") setFilterMethod("offline");
    else if (val === "withProof") setFilterProof("with");
    else if (val === "withoutProof") setFilterProof("without");
  }
  function getKriteria() {
    if (filterMethod === "online") return "online";
    if (filterMethod === "offline") return "offline";
    if (filterProof === "with") return "withProof";
    if (filterProof === "without") return "withoutProof";
    return "all";
  }

  async function fetchPPDB(nisn) {
    if (!nisn || ppdbMap[nisn] || loadingK[nisn]) return;
    setLoadingK((s) => ({ ...s, [nisn]: true }));
    try {
      const d = await getDoc(doc(db, "ppdb", String(nisn)));
      if (d.exists()) {
        const data = d.data();
        setPpdbMap((m) => ({ ...m, [nisn]: data }));
      } else {
        setPpdbMap((m) => ({ ...m, [nisn]: null })); // tidak ada
      }
    } finally {
      setLoadingK((s) => ({ ...s, [nisn]: false }));
    }
  }

  // Prefetch ringan untuk baris terlihat
  useEffect(() => {
    rows.slice(0, pageSize).forEach((r) => {
      const nisn = r.username || r.id; // username = NISN (sesuai portalmu)
      fetchPPDB(nisn);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pageSize]);

  async function openViewer(r) {
    const nisn = r.username || r.id;
    await fetchPPDB(nisn);
    setViewerRow(r);
    const data = ppdbMap[nisn];
    const firstAvail = REQUIRED_KEYS.find((k) => data?.filesMeta?.[k]?.url) || "kk";
    setActiveKey(firstAvail);
    setShowViewer(true);
  }

  function openProof(r) {
    const url = r?.registrationPaymentProof;
    if (!url) return;
    setProofRow(r);
    setProofUrl(url);
    setShowProof(true);
  }

  const subTitle = (
    <>
      {statusFilter === "verified" ? (
        <>Menampilkan akun yang <b>sudah disetujui</b>.</>
      ) : statusFilter === "all" ? (
        <>Menampilkan <b>semua akun</b> (campuran disetujui & butuh persetujuan).</>
      ) : (
        <>Menampilkan akun yang <b>butuh persetujuan</b>. <b>Online wajib upload bukti.</b></>
      )}
    </>
  );

  return (
    <div className="bg-white text-slate-900">  

      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem-4rem)]">
        {/* Toolbar */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <input
              className="md:col-span-3 col-span-12 h-9 rounded-lg border border-slate-300 px-3 text-xs"
              placeholder="Cari Nama/NISN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="md:col-span-2 col-span-6 h-9 rounded-lg border border-slate-300 px-2 text-xs"
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} title="Status">
              <option value="all">Semua Status</option>
              <option value="pending">Butuh Persetujuan</option>
              <option value="verified">Sudah Disetujui</option>
            </select>
            <select className="md:col-span-2 col-span-6 h-9 rounded-lg border border-slate-300 px-2 text-xs"
              value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} title="Jenjang">
              {["all","TK","SD","SMP","SMA","UNIVERSITAS"].map((lv) => (
                <option key={lv} value={lv}>{lv === "all" ? "Semua Jenjang" : lv}</option>
              ))}
            </select>
            <select className="md:col-span-2 col-span-6 h-9 rounded-lg border border-slate-300 px-2 text-xs"
              value={
                filterMethod === "online" ? "online" :
                filterMethod === "offline" ? "offline" :
                filterProof === "with" ? "withProof" :
                filterProof === "without" ? "withoutProof" : "all"
              }
              onChange={(e) => {
                const v = e.target.value;
                setFilterMethod("all"); setFilterProof("all");
                if (v === "online") setFilterMethod("online");
                else if (v === "offline") setFilterMethod("offline");
                else if (v === "withProof") setFilterProof("with");
                else if (v === "withoutProof") setFilterProof("without");
              }}
              title="Kriteria"
            >
              <option value="all">Semua Kriteria</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="withProof">Dengan Bukti</option>
              <option value="withoutProof">Tanpa Bukti</option>
            </select>
            <div className="md:col-span-3 col-span-6 flex items-center gap-1">
              <input type="date" className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs"
                value={startDate} onChange={(e) => setStartDate(e.target.value)} title="Mulai" />
              <span className="text-slate-500 text-xs">–</span>
              <input type="date" className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs"
                value={endDate} onChange={(e) => setEndDate(e.target.value)} title="Selesai" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 px-2.5 h-7 text-xs">
                Online ✔ {recap.online}
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2.5 h-7 text-xs">
                Offline ✔ {recap.offline}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2.5 h-7 text-xs">
                Total: {formatIDR(totalVerifiedAmount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 px-3 text-xs" placeholder="Verifikator" title="Verifikator" />
              <button onClick={loadFirst} className="h-9 rounded-lg border border-slate-300 px-3 text-xs hover:bg-slate-50">
                Refresh
              </button>
              <select className="h-9 rounded-lg border border-slate-300 px-2 text-xs"
                value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value, 10))} title="Jumlah/hal">
                <option value={10}>10</option><option value={25}>25</option>
                <option value={50}>50</option><option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABEL */}
        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-slate-700 font-semibold">
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3">Nama</th>
                <th className="p-3">NISN</th>
                <th className="p-3">Jenjang</th>
                <th className="p-3">ID Pendaftaran</th>
                <th className="p-3">Bukti</th>
                <th className="p-3">Metode</th>
                <th className="p-3">Status</th>
                <th className="p-3">Kelengkapan Data</th>
                <th className="p-3 w-[200px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const up = uploading[r.id] || { busy: false, progress: 0 };
                const hasProof  = !!r.registrationPaymentProof;
                const isVerified = r.verifiedPayment === true;

                const nisn = r.username || r.id;
                const kData = ppdbMap[nisn];
                const kBusy = loadingK[nisn];

                return (
                  <tr key={r.id} className="border-t text-slate-800">
                    <td className="p-3 text-center">{idx + 1}</td>
                    <td className="p-3 font-medium">{r.fullName || "-"}</td>
                    <td className="p-3 font-mono">{nisn}</td>
                    <td className="p-3">{r.registrationLevel || "-"}</td>
                    <td className="p-3">{r.registrationId || "-"}</td>

                    {/* BUKTI */}
                    <td className="p-3">
                      {r._method === "offline" ? (
                        <span className="text-slate-600">Tidak diperlukan (offline)</span>
                      ) : isVerified ? (
                        hasProof ? (
                          <button
                            onClick={() => openProof(r)}
                            className="inline-flex items-center rounded-full bg-violet-600 text-white ring-1 ring-violet-600 px-3 py-1.5 text-xs font-semibold hover:bg-violet-700"
                            title="Lihat bukti pembayaran"
                          >
                            Bukti Sudah Disetujui
                          </button>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className={[
                            "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer",
                            up.busy ? "opacity-60 pointer-events-none" : "hover:bg-slate-50",
                            "border-slate-300"
                          ].join(" ")}>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => handleUploadProof(r.id, e.target.files?.[0])}
                              disabled={up.busy}
                            />
                            {up.busy ? (
                              <span className="text-slate-600 text-xs">Mengunggah… {up.progress}%</span>
                            ) : (
                              <span className="text-slate-700 text-xs">Upload Bukti</span>
                            )}
                          </label>
                          {hasProof && (
                            <button
                              onClick={() => openProof(r)}
                              className="text-violet-700 underline text-xs"
                              title="Lihat bukti pembayaran"
                            >
                              Lihat
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* METODE */}
                    <td className="p-3">
                      <select
                        value={r._method}
                        onChange={(e) => setRowMethod(r.id, e.target.value)}
                        disabled={isVerified}
                        className={[
                          "rounded-lg border border-slate-300 px-2 py-1 text-sm",
                          isVerified && "bg-slate-100 text-slate-500 cursor-not-allowed"
                        ].join(" ")}
                      >
                        <option value="online">Online (WA/Transfer)</option>
                        <option value="offline">Offline (Stand)</option>
                      </select>
                    </td>

                    {/* STATUS */}
                    <td className="p-3">
                      {isVerified ? (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-100 border-emerald-300 text-emerald-800">
                          Terverifikasi
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-100 border-amber-300 text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* KELENGKAPAN */}
                    <td className="p-3">
                      {kBusy ? (
                        <span className="text-slate-500 text-xs">memuat…</span>
                      ) : kData === null ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 bg-rose-100 text-rose-700 ring-rose-200">
                          0/5 berkas
                        </span>
                      ) : (
                        <button
                          onClick={() => openViewer(r)}
                          className={[
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1",
                            (kData ? countFilled(kData.filesMeta) : 0) === 5
                              ? "bg-green-100 text-green-700 ring-green-200"
                              : (kData ? countFilled(kData.filesMeta) : 0) === 0
                              ? "bg-rose-100 text-rose-700 ring-rose-200"
                              : "bg-amber-100 text-amber-800 ring-amber-200",
                          ].join(" ")}
                          title="Lihat dokumen"
                        >
                          {countFilled(kData?.filesMeta) ?? 0}/5 • Lihat
                        </button>
                      )}
                    </td>

                    {/* AKSI */}
                    <td className="p-3 space-x-2">
                      {isVerified ? (
                        <button
                          disabled
                          className="rounded-lg px-3 py-1.5 text-sm font-semibold bg-slate-200 text-slate-500 cursor-not-allowed"
                          title="Sudah disetujui"
                        >
                          Sudah Disetujui
                        </button>
                      ) : (
                        <button
                          onClick={() => openConfirm(r.id)}
                          disabled={! (r._method === "offline" || (r._method === "online" && r.registrationPaymentProof)) || (uploading[r.id]?.busy)}
                          className={[
                            "rounded-lg px-3 py-1.5 text-sm font-semibold",
                            (r._method === "offline" || (r._method === "online" && r.registrationPaymentProof)) && !uploading[r.id]?.busy
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-slate-200 text-slate-500 cursor-not-allowed"
                          ].join(" ")}
                          title={r._method === "online" && !r.registrationPaymentProof ? "Upload bukti dulu" : "Setujui pembayaran"}
                        >
                          Setujui
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!rows.length && !loading && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-600">
                    {statusFilter === "verified"
                      ? "Belum ada yang disetujui."
                      : statusFilter === "all"
                      ? "Data tidak ditemukan."
                      : "Tidak ada akun pending / belum terverifikasi."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-700">Menampilkan <b>{rows.length}</b> akun (setelah filter).</div>
          <button onClick={loadMore} disabled={!hasMore || loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
            {loading ? "Memuat…" : hasMore ? "Muat Lagi" : "Habis"}
          </button>
        </div>

        {/* Alerts */}
        {err && <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900">{err}</div>}
        {ok  && <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">{ok}</div>}
      </div>

      {/* Modal konfirmasi verifikasi */}
      {askPwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="px-5 pt-5">
              <h3 className="text-lg font-semibold text-slate-900">Konfirmasi Verifikasi</h3>
              <p className="mt-1 text-sm text-slate-600">Masukkan <b>password konfirmasi admin</b> untuk menyetujui pembayaran.</p>
            </div>
            <div className="px-5 pb-1 pt-3">
              <input type="password" autoFocus className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Password konfirmasi" value={askPwValue} onChange={(e) => setAskPwValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmAndVerify(); }} />
              {!!askPwErr && <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{askPwErr}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button onClick={closeConfirm} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Batal</button>
              <button onClick={confirmAndVerify} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Konfirmasi & Setujui</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal kelengkapan dokumen */}
      <ModalViewer
        open={showViewer}
        onClose={() => setShowViewer(false)}
        row={viewerRow}
        data={ppdbMap[viewerRow?.username || viewerRow?.id]}
        activeKey={activeKey}
        setActiveKey={setActiveKey}
      />

      {/* Modal bukti pembayaran */}
      <ProofModal
        open={showProof}
        onClose={() => setShowProof(false)}
        row={proofRow}
        url={proofUrl}
      />
    </div>
  );
}
