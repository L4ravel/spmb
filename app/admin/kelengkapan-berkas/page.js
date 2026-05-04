"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  Loader2,
  FileText,
  Phone,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Download,
} from "lucide-react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

const PAGE_SIZES = [10, 25, 50, 100, 500];

function normalizePhone(raw) {
  let digits = String(raw || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  return digits;
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function getTimeValue(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value) {
  const ms = getTimeValue(value);
  if (!ms) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Makassar",
  }).format(new Date(ms));
}

export default function KelengkapanBerkasPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [filterJenjang, setFilterJenjang] = useState("ALL");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerNisn, setViewerNisn] = useState(null);
  const [viewerFileKey, setViewerFileKey] = useState(null);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [viewerZoom, setViewerZoom] = useState(1);

  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef(null);

  // Load semua dokumen ppdb sekali, lalu pagination & filter di client
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setErrorMsg("");

      try {
        const snap = await getDocs(collection(db, "ppdb"));
        if (cancelled) return;

        const docs = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const nisn = data.nisn || docSnap.id;
          const jenjang = data.jenjang || "-";
          const waliWa = data.waliWa || "";
          const filesMeta = data.filesMeta || {};
          const name =
            data.namaSantri ||
            data.namaLengkap ||
            data.nama ||
            data.name ||
            "-";

          const createdAtMs = getTimeValue(data.createdAt);

          docs.push({
            id: docSnap.id,
            nisn,
            jenjang,
            waliWa,
            filesMeta,
            name,
            createdAt: data.createdAt || null,
            createdAtMs,
          });
        });

        // Urutan: yang lama daftar/upload di atas, yang baru di bawah
        docs.sort((a, b) => {
          const timeA = Number(a.createdAtMs || 0);
          const timeB = Number(b.createdAtMs || 0);

          if (timeA !== timeB) {
            return timeA - timeB;
          }

          return String(a.nisn || "").localeCompare(String(b.nisn || ""));
        });

        setRows(docs);
        setPage(1);
      } catch (e) {
        console.error(e);
        setErrorMsg(e?.message || "Gagal memuat data kelengkapan berkas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter jenjang & search (nama + NISN)
  const filteredRows = useMemo(() => {
    let out = [...rows];

    if (filterJenjang !== "ALL") {
      out = out.filter((r) => (r.jenjang || "") === filterJenjang);
    }

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          String(r.nisn || "").toLowerCase().includes(s) ||
          String(r.name || "").toLowerCase().includes(s)
      );
    }

    return out;
  }, [rows, filterJenjang, search]);

  const totalPages = useMemo(() => {
    if (filteredRows.length === 0) return 1;
    return Math.max(1, Math.ceil(filteredRows.length / pageSize));
  }, [filteredRows, pageSize]);

  // Clamp page kalau filter berubah
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Jenjang diambil dari Firestore (unique dari rows)
  const jenjangOptions = useMemo(() => {
    const set = new Set();

    rows.forEach((r) => {
      if (r.jenjang) set.add(r.jenjang);
    });

    return Array.from(set).sort();
  }, [rows]);

  const currentViewerRow = useMemo(
    () => filteredRows.find((r) => r.nisn === viewerNisn) || null,
    [filteredRows, viewerNisn]
  );

  // Daftar key berkas untuk row yang sedang dibuka
  const currentFileKeys = useMemo(() => {
    if (!currentViewerRow) return [];
    return Object.keys(currentViewerRow.filesMeta || {});
  }, [currentViewerRow]);

  useEffect(() => {
    if (currentViewerRow) {
      if (!currentFileKeys.length) {
        setViewerFileKey(null);
        return;
      }

      if (!currentFileKeys.includes(viewerFileKey)) {
        setViewerFileKey(currentFileKeys[0]);
      }
    }
  }, [currentViewerRow, currentFileKeys, viewerFileKey]);

  const currentFileMeta =
    currentViewerRow && viewerFileKey
      ? currentViewerRow.filesMeta[viewerFileKey]
      : null;

  const handleReplaceFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentViewerRow || !viewerFileKey) return;

    setUploadBusy(true);

    try {
      const nisnForPath = currentViewerRow.nisn || currentViewerRow.id;
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `ppdb/${nisnForPath}/${viewerFileKey}-${Date.now()}-${safeName}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const newMeta = {
        contentType: file.type || "application/octet-stream",
        path,
        size: file.size,
        url,
      };

      await updateDoc(doc(db, "ppdb", currentViewerRow.id), {
        [`filesMeta.${viewerFileKey}`]: newMeta,
      });

      setRows((prev) =>
        prev.map((r) =>
          r.id === currentViewerRow.id
            ? {
                ...r,
                filesMeta: {
                  ...r.filesMeta,
                  [viewerFileKey]: newMeta,
                },
              }
            : r
        )
      );
    } catch (err) {
      console.error("Gagal mengganti berkas:", err);
      alert("Gagal mengganti berkas. Coba lagi.");
    } finally {
      setUploadBusy(false);
      if (event.target) event.target.value = "";
    }
  };

  const onOpenViewer = (row) => {
    setViewerNisn(row.nisn);
    setViewerOpen(true);

    const keys = Object.keys(row.filesMeta || {});
    setViewerFileKey(keys[0] || null);
    setViewerRotation(0);
    setViewerZoom(1);
  };

  const onCloseViewer = () => {
    setViewerOpen(false);
    setViewerNisn(null);
    setViewerFileKey(null);
    setViewerRotation(0);
    setViewerZoom(1);
  };

  // Next/Prev sekarang pindah antar BERKAS (fileMeta), bukan antar peserta
  const goFilePrev = () => {
    if (!currentFileKeys.length || !viewerFileKey) return;

    const idx = currentFileKeys.indexOf(viewerFileKey);
    if (idx <= 0) return;

    setViewerFileKey(currentFileKeys[idx - 1]);
    setViewerRotation(0);
    setViewerZoom(1);
  };

  const goFileNext = () => {
    if (!currentFileKeys.length || !viewerFileKey) return;

    const idx = currentFileKeys.indexOf(viewerFileKey);
    if (idx === -1 || idx >= currentFileKeys.length - 1) return;

    setViewerFileKey(currentFileKeys[idx + 1]);
    setViewerRotation(0);
    setViewerZoom(1);
  };

  const zoomIn = () => {
    setViewerZoom((z) => Math.min(3, z + 0.25));
  };

  const zoomOut = () => {
    setViewerZoom((z) => Math.max(0.5, z - 0.25));
  };

  const openWhatsApp = (row) => {
    if (typeof window === "undefined") return;

    const phone = normalizePhone(row.waliWa);

    if (!phone) {
      alert("Nomor WhatsApp wali tidak tersedia.");
      return;
    }

    const text =
      "Bismillah.%0A%0APanitia SPMB Pondok As Sunnah Lombok mengecek kelengkapan berkas an. " +
      encodeURIComponent(row.name || "-") +
      "%20(NISN%20" +
      encodeURIComponent(row.nisn) +
      "%2C%20" +
      encodeURIComponent(row.jenjang || "-") +
      ").";

    const url =
      "https://web.whatsapp.com/send?phone=" + phone + "&text=" + text;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative min-h-screen bg-slate-50/60 w-full pb-24">
      <div className="fixed inset-0 -z-10 bg-slate-50/60" />

      <div className="px-4 pt-6 md:pt-8">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
          Kelengkapan Berkas Peserta
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cek berkas yang diunggah peserta dan hubungi wali melalui WhatsApp.
        </p>
      </div>

      <div className="px-4 pt-4 pb-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Toolbar filter + search */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Jenjang</span>
                <select
                  value={filterJenjang}
                  onChange={(e) => {
                    setFilterJenjang(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="ALL">Semua</option>
                  {jenjangOptions.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Tampil</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} baris
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari NISN / nama..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Tabel utama */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">No</th>
                  <th className="px-4 py-2 text-left font-medium">NISN</th>
                  <th className="px-4 py-2 text-left font-medium">Nama</th>
                  <th className="px-4 py-2 text-left font-medium">Jenjang</th>
                  <th className="px-4 py-2 text-left font-medium">Berkas</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Waktu Pendaftaran
                  </th>
                  <th className="px-4 py-2 text-left font-medium">WhatsApp</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-slate-500 text-sm"
                    >
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memuat data…</span>
                      </div>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-slate-500 text-sm"
                    >
                      Tidak ada data untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={cls(
                        "border-t border-slate-100",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      )}
                    >
                      <td className="px-4 py-2 align-top text-xs text-slate-600">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      <td className="px-4 py-2 align-top text-xs font-mono text-slate-800">
                        {row.nisn}
                      </td>

                      <td className="px-4 py-2 align-top text-xs text-slate-800">
                        {row.name || "-"}
                      </td>

                      <td className="px-4 py-2 align-top text-xs text-slate-700">
                        {row.jenjang || "-"}
                      </td>

                      <td className="px-4 py-2 align-top text-xs">
                        {Object.keys(row.filesMeta || {}).length === 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                            Tidak ada berkas
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenViewer(row)}
                            className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Lihat ({Object.keys(row.filesMeta || {}).length})
                          </button>
                        )}
                      </td>

                      <td className="px-4 py-2 align-top text-xs text-slate-700 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>

                      <td className="px-4 py-2 align-top text-xs">
                        {row.waliWa ? (
                          <button
                            type="button"
                            onClick={() => openWhatsApp(row)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Hubungi
                          </button>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-400">
                            Tidak ada nomor
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-[11px] text-slate-500">
              Menampilkan <span className="font-semibold">{pageRows.length}</span>{" "}
              dari <span className="font-semibold">{filteredRows.length}</span>{" "}
              data · Halaman{" "}
              <span className="font-semibold">
                {page} / {totalPages}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cls(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px]",
                  page > 1 && !loading
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                )}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>

              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cls(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px]",
                  page < totalPages && !loading
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                )}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {errorMsg && <p className="mt-3 text-xs text-red-600">{errorMsg}</p>}
      </div>

      {/* Modal viewer berkas */}
      {viewerOpen && currentViewerRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleReplaceFile}
              />

              <div className="min-w-0">
                <div className="text-xs font-mono text-slate-500">
                  {currentViewerRow.nisn}
                </div>
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {currentViewerRow.name || "-"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Jenjang: {currentViewerRow.jenjang || "-"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={goFilePrev}
                  disabled={!currentFileKeys.length || !viewerFileKey}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileKeys.length > 0 &&
                      currentFileKeys.indexOf(viewerFileKey) > 0
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <ChevronLeft className="h-3 w-3" />
                  Prev Berkas
                </button>

                <button
                  type="button"
                  onClick={goFileNext}
                  disabled={
                    !currentFileKeys.length ||
                    !viewerFileKey ||
                    currentFileKeys.indexOf(viewerFileKey) ===
                      currentFileKeys.length - 1
                  }
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileKeys.length > 0 &&
                      viewerFileKey &&
                      currentFileKeys.indexOf(viewerFileKey) <
                        currentFileKeys.length - 1
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  Next Berkas
                  <ChevronRight className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewerRotation((r) => (r - 90 + 360) % 360)
                  }
                  disabled={!currentFileMeta}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileMeta
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <RotateCcw className="h-3 w-3" />
                  Rotasi Kiri
                </button>

                <button
                  type="button"
                  onClick={() => setViewerRotation((r) => (r + 90) % 360)}
                  disabled={!currentFileMeta}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileMeta
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <RotateCw className="h-3 w-3" />
                  Rotasi Kanan
                </button>

                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={!currentFileMeta}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileMeta
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <ZoomOut className="h-3 w-3" />
                  Zoom Out
                </button>

                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={!currentFileMeta}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileMeta
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <ZoomIn className="h-3 w-3" />
                  Zoom In
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!currentFileMeta || uploadBusy}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px]",
                    currentFileMeta && !uploadBusy
                      ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {uploadBusy ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <FileText className="h-3 w-3" />
                      Ganti Berkas
                    </>
                  )}
                </button>

                {currentFileMeta?.url && (
                  <a
                    href={currentFileMeta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
                    title="Buka di tab lain"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                )}

                <button
                  type="button"
                  onClick={onCloseViewer}
                  className="inline-flex items-center justify-center rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tabs jenis berkas */}
            <div className="flex border-b border-slate-200 overflow-x-auto px-4 py-2 gap-2">
              {currentFileKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setViewerFileKey(key);
                    setViewerRotation(0);
                    setViewerZoom(1);
                  }}
                  className={cls(
                    "inline-flex items-center rounded-full px-3 py-1 text-[11px] border whitespace-nowrap",
                    viewerFileKey === key
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Preview berkas */}
            <div className="flex-1 bg-slate-900/5 p-3 md:p-4 overflow-auto">
              {currentFileMeta ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className="max-h-full max-w-full"
                    style={{
                      transform: `rotate(${viewerRotation}deg) scale(${viewerZoom})`,
                      transformOrigin: "center center",
                      transition: "transform 0.15s ease-out",
                    }}
                  >
                    {currentFileMeta.contentType?.includes("pdf") ? (
                      <iframe
                        src={currentFileMeta.url}
                        className="w-[min(900px,80vw)] h-[min(650px,80vh)] rounded-lg border border-slate-300 bg-white"
                      />
                    ) : currentFileMeta.contentType?.startsWith("image/") ? (
                      <img
                        src={currentFileMeta.url}
                        alt={viewerFileKey || "Berkas"}
                        className="max-h-[80vh] max-w-[80vw] rounded-lg border border-slate-300 bg-white object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <a
                          href={currentFileMeta.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-violet-700 hover:underline"
                        >
                          Format berkas tidak bisa dipreview. Klik untuk membuka
                          di tab baru.
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
                  Tidak ada berkas yang dipilih.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
