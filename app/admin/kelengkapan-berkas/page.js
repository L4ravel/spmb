"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

/* ================= Firebase Client (public read) ================= */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
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

/* ================= Utils ================= */
// jumlah berkas mengikuti keys yang ada pada filesMeta dari route
const countFiles = (filesMeta = {}) => Object.keys(filesMeta || {}).length;

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

// Label tampilan untuk tiap key dokumen
const DOC_LABELS = {
  ijazah: "SUKET AKTIF SEKOLAH", // permintaan khusus
  ktpWali: "KTP WALI",
  // tambahkan mapping lain bila perlu…
};
const getDocLabel = (k = "") =>
  DOC_LABELS[k] || String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toUpperCase();

/* ================= Modal (Viewer) ================= */
function Modal({ open, onClose, row, activeKey, setActiveKey }) {
  const escHandler = useCallback(
    (e) => {
      if (e.key === "Escape") onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", escHandler);
    return () => document.removeEventListener("keydown", escHandler);
  }, [open, escHandler]);

  if (!open || !row) return null;

  const filesMeta = row.filesMeta || {};
  const availableKeys = Object.keys(filesMeta);
  const currentKey = availableKeys.includes(activeKey) ? activeKey : availableKeys[0];
  const currentMeta = currentKey ? filesMeta[currentKey] : null;

  const nextKey = () => {
    if (!availableKeys.length) return;
    const i = availableKeys.indexOf(currentKey);
    const ni = (i + 1) % availableKeys.length;
    setActiveKey(availableKeys[ni]);
  };
  const prevKey = () => {
    if (!availableKeys.length) return;
    const i = availableKeys.indexOf(currentKey);
    const pi = (i - 1 + availableKeys.length) % availableKeys.length;
    setActiveKey(availableKeys[pi]);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      {/* panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-5xl rounded-2xl bg-white text-black shadow-2xl ring-1 ring-slate-200">
          {/* header */}
          <div className="flex items-start justify-between gap-3 p-4 md:p-5 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Kelengkapan Dokumen • NISN</div>
              <div className="text-lg md:text-xl font-semibold text-slate-900">
                {row.nisn || row.id}{" "}
                <span className="text-slate-500 font-normal">• {row.nama || row.name || "—"}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Dibuat: {toDateStr(row.createdAt)} • Diperbarui: {toDateStr(row.updatedAt)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg ring-1 ring-slate-200 hover:bg-slate-50"
              aria-label="Tutup"
              title="Tutup (Esc)"
            >
              ✕
            </button>
          </div>

          {/* toolbar dok + switcher */}
          <div className="px-4 md:px-5 pt-3 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              {availableKeys.length === 0 ? (
                <span className="text-slate-500 text-sm">Tidak ada dokumen.</span>
              ) : (
                availableKeys.map((k) => {
                  const ada = Boolean(filesMeta?.[k]?.url);
                  const isActive = k === currentKey;
                  return (
                    <button
                      key={k}
                      disabled={!ada}
                      onClick={() => ada && setActiveKey(k)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-medium ring-1",
                        ada
                          ? isActive
                            ? "bg-violet-600 text-white ring-violet-600"
                            : "bg-white text-violet-700 ring-violet-200 hover:bg-violet-50"
                          : "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {getDocLabel(k)}
                    </button>
                  );
                })
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={prevKey}
                  disabled={availableKeys.length < 2}
                  className="px-3 py-1.5 rounded-lg text-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  ◀ Prev
                </button>
                <button
                  onClick={nextKey}
                  disabled={availableKeys.length < 2}
                  className="px-3 py-1.5 rounded-lg text-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>

          {/* body (scrollable) */}
          <div className="max-h-[80vh] overflow-y-auto">
            {/* keterangan file */}
            <div className="px-4 md:px-5 py-3 border-b border-slate-200 text-sm">
              {currentMeta ? (
                <div className="text-slate-600">
                  <div className="font-medium text-slate-900">{getDocLabel(currentKey)}</div>
                  <div className="mt-0.5">
                    <span className="text-xs">
                      Tipe: {currentMeta.contentType || "—"} •{" "}
                      Ukuran: {currentMeta.size ? `${currentMeta.size} byte` : "—"} •{" "}
                      Diunggah: {toDateStr(currentMeta.uploadedAt)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <code className="text-[12px] text-slate-500">{currentMeta.path}</code>
                  </div>
                </div>
              ) : (
                <div className="text-slate-600">Dokumen tidak tersedia.</div>
              )}
            </div>

            {/* viewer */}
            <div className="p-4 md:p-5">
              {!currentMeta ? (
                <div className="text-slate-500">Tidak ada yang ditampilkan.</div>
              ) : classify(currentMeta) === "image" ? (
                <div className="w-full">
                  <img
                    src={currentMeta.url}
                    alt={getDocLabel(currentKey)}
                    className="w-full h-auto rounded-lg border border-slate-200"
                  />
                </div>
              ) : classify(currentMeta) === "pdf" ? (
                <div className="w-full">
                  <iframe
                    src={currentMeta.url}
                    title={getDocLabel(currentKey)}
                    className="w-full h-[70vh] rounded-lg border border-slate-200"
                  />
                </div>
              ) : (
                <div className="text-slate-600">
                  Format tidak didukung untuk pratinjau.{" "}
                  <a
                    href={currentMeta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-700 underline"
                  >
                    Buka / Unduh berkas
                  </a>
                </div>
              )}

              {/* daftar semua berkas (mini list) */}
              <div className="mt-6">
                <div className="text-xs font-semibold text-slate-500 mb-2">Semua Berkas</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableKeys.map((k) => {
                    const m = filesMeta?.[k];
                    const ada = Boolean(m?.url);
                    return (
                      <div
                        key={k}
                        className={[
                          "rounded-lg border p-3",
                          k === currentKey ? "border-violet-300 bg-violet-50/40" : "border-slate-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{getDocLabel(k)}</div>
                          <span
                            className={
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 " +
                              (ada
                                ? "bg-green-100 text-green-700 ring-green-200"
                                : "bg-rose-100 text-rose-700 ring-rose-200")
                            }
                          >
                            {ada ? "Ada" : "Belum"}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-500 mt-1 line-clamp-1">{m?.path || "-"}</div>
                        <div className="mt-2 flex gap-2">
                          <button
                            disabled={!ada}
                            onClick={() => ada && setActiveKey(k)}
                            className={[
                              "px-3 py-1.5 rounded-lg text-xs ring-1",
                              ada
                                ? "bg-white text-violet-700 ring-violet-200 hover:bg-violet-50"
                                : "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Lihat
                          </button>
                          {ada && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg text-xs ring-1 bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                            >
                              Buka di Tab
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {/* end body */}
        </div>
      </div>
    </div>
  );
}

/* ================= Page ================= */
export default function KelengkapanPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [userLevels, setUserLevels] = useState({});     
const [loadingLevels, setLoadingLevels] = useState({});
  const [pageSize, setPageSize] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const lastCursorRef = useRef(null);
  

  // filter jenjang
  const [levelFilter, setLevelFilter] = useState("ALL");

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeKey, setActiveKey] = useState("");

  const isDigits = (s) => /^\d+$/.test(s);
  const getName = (r) =>
    r.nama || r.name || r.fullname || r.profile?.fullName || r.profile?.name || "";

  // helper: terapkan filter jenjang di klien (hindari indeks komposit)
  const applyLevelFilter = (docs) =>
  levelFilter === "ALL"
    ? docs
    : docs.filter((d) => {
        const nisn = d.nisn || d.id;
        return (userLevels[nisn] || "").trim() === levelFilter;
      });

      const visibleRows = useMemo(
  () => applyLevelFilter(rows),
  [rows, levelFilter, userLevels]
);

  const fetchUserLevel = async (nisn) => {
  if (!nisn || userLevels[nisn] || loadingLevels[nisn]) return;
  setLoadingLevels((m) => ({ ...m, [nisn]: true }));
  try {
    // 1) coba 'user_app/{nisn}'
    let snap = await getDocs(
      query(collection(db, "user_app"), where("__name__", "==", String(nisn)), limit(1))
    );
    let data = !snap.empty ? snap.docs[0].data() : null;

    // 2) fallback: 'users_app/{nisn}'
    if (!data) {
      const snap2 = await getDocs(
        query(collection(db, "users_app"), where("__name__", "==", String(nisn)), limit(1))
      );
      data = !snap2.empty ? snap2.docs[0].data() : null;
    }

    const lv = String(data?.registrationLevel || "").trim();
    if (lv) setUserLevels((m) => ({ ...m, [nisn]: lv }));
  } finally {
    setLoadingLevels((m) => ({ ...m, [nisn]: false }));
  }
};

  async function loadFirst() {
    setLoading(true);
    setError("");
    try {
      const col = collection(db, "ppdb");
      const s = search.trim();
      let docs = [];
      let snap;

      if (s && isDigits(s)) {
        // 🔎 NISN prefix search
        snap = await getDocs(
          query(
            col,
            orderBy("nisn"),
            where("nisn", ">=", s),
            where("nisn", "<=", s + "\uf8ff"),
            limit(pageSize)
          )
        );
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs = applyLevelFilter(docs);
        lastCursorRef.current = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
        setHasMore(snap.docs.length === pageSize);
      } else if (s) {
        // 🔎 Nama mengandung (filter klien)
        snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(500)));
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ql = s.toLowerCase();
        docs = all.filter((r) => getName(r).toLowerCase().includes(ql));
        docs = applyLevelFilter(docs);
        lastCursorRef.current = null;
        setHasMore(false);
      } else {
        // default: tanpa pencarian → urut createdAt desc + paging
        snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(pageSize)));
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs = applyLevelFilter(docs);
        lastCursorRef.current = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
        setHasMore(snap.docs.length === pageSize);
      }

      setRows(docs);
      docs.forEach((r) => fetchUserLevel(r.nisn || r.id));
    } catch (e) {
      setError(e?.message || "Gagal memuat data.");
      setRows([]);
      lastCursorRef.current = null;
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || !lastCursorRef.current) return;
    setLoading(true);
    setError("");

    try {
      const col = collection(db, "ppdb");
      const s = search.trim();
      let snap;

      if (s && isDigits(s)) {
        // lanjutkan prefix NISN
        snap = await getDocs(
          query(
            col,
            orderBy("nisn"),
            where("nisn", ">=", s),
            where("nisn", "<=", s + "\uf8ff"),
            startAfter(lastCursorRef.current),
            limit(pageSize)
          )
        );
      } else {
        // mode nama tidak support "load more" (filter klien)
        setLoading(false);
        return;
      }

      let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs = applyLevelFilter(docs);

      setRows((r) => [...r, ...docs]);
      docs.forEach((r) => fetchUserLevel(r.nisn || r.id));
      lastCursorRef.current = snap.docs.length ? snap.docs[snap.docs.length - 1] : lastCursorRef.current;
      setHasMore(snap.docs.length === pageSize);
    } catch (e) {
      setError(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  // initial + saat page size berubah
  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // debounce search & ganti filter jenjang
  useEffect(() => {
    const t = setTimeout(() => {
      void loadFirst();
    }, 300);
    return () => clearTimeout(t);
    // ikut pageSize supaya ganti page-size ikut refresh
  }, [search, levelFilter, pageSize]);

  const openModal = (row) => {
    setSelectedRow(row);
    // set tab aktif pertama yang tersedia
    const keys = Object.keys(row?.filesMeta || {});
    const first = keys.find((k) => row?.filesMeta?.[k]?.url) || keys[0] || "";
    setActiveKey(first);
    setShowModal(true);
  };

  // kumpulkan opsi jenjang dari data yang sudah dimuat (agar selalu relevan)
  const levelOptions = useMemo(() => {
  const s = new Set();
  Object.values(userLevels).forEach((lv) => {
    const v = String(lv || "").trim();
    if (v) s.add(v);
  });
  return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
}, [userLevels]);

  return (
    <div className="bg-white">
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem-4rem)] text-black">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Tabel Kelengkapan PPDB</h1>
        <p className="text-sm text-slate-600 mt-1">
          Publik • menampilkan ringkas kelengkapan berkas per <b>NISN</b>.
        </p>

        {/* Toolbar */}
        <div className="mt-4 flex flex-col md:flex-row md:items-end gap-3 text-black">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Cari NISN / Nama</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cari NISN / Nama…"
              className="w-full sm:w-80 md:w-96 lg:w-[40rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />
          </div>

          {/* Filter Jenjang */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Filter Jenjang</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
            >
              <option value="ALL">Semua Jenjang</option>
              {levelOptions.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadFirst}
              className="rounded-lg bg-violet-600 text-white text-sm font-medium px-4 py-2 shadow hover:bg-violet-700"
            >
              Tampil
            </button>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="border border-slate-200 px-3 py-2 w-[60px]">No</th>
                <th className="border border-slate-200 px-3 py-2 w-[160px]">NISN</th>
                <th className="border border-slate-200 px-3 py-2">Nama</th>
                <th className="border border-slate-200 px-3 py-2">Jenjang</th>
                <th className="border border-slate-200 px-3 py-2 w-[180px]">Kelengkapan Data</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Memuat data…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-rose-700 bg-rose-50">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const no = idx + 1;
                  const nisn = r.nisn || r.id;
                  const nama = r.nama || r.name || r.fullname || "—";
                  const jenjang = userLevels[nisn] || "—";
                  const nBerkas = countFiles(r.filesMeta);

                  const badgeCls =
                    nBerkas === 0
                      ? "bg-rose-100 text-rose-700 ring-rose-200"
                      : nBerkas < 3
                      ? "bg-amber-100 text-amber-800 ring-amber-200"
                      : "bg-green-100 text-green-700 ring-green-200";

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => openModal(r)}
                      title="Klik untuk melihat detail dokumen"
                    >
                      <td className="border border-slate-200 px-3 py-2 text-center">{no}</td>
                      <td className="border border-slate-200 px-3 py-2 font-medium tracking-wide">{nisn}</td>
                      <td className="border border-slate-200 px-3 py-2">{nama}</td>
                      <td className="border border-slate-200 px-3 py-2">{jenjang}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 " +
                            badgeCls
                          }
                        >
                          {nBerkas} berkas • Lihat
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-center">
          {hasMore && !loading ? (
            <button
              onClick={loadMore}
              className="rounded-lg bg-white text-violet-700 ring-1 ring-violet-200 px-4 py-2 text-sm font-medium hover:bg-violet-50"
            >
              Muat lebih banyak
            </button>
          ) : null}
        </div>
      </div>

      {/* Modal Viewer */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        row={selectedRow}
        activeKey={activeKey}
        setActiveKey={setActiveKey}
      />
    </div>
  );
}
