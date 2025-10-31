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
} from "firebase/firestore";
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

const PAGE_SIZES = [10, 25, 50];

function fmtIDR(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
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
    if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(s)) return "approved";
    if (["REJECTED", "DENIED", "DECLINED"].includes(s)) return "rejected";
    return "pending";
  } catch {
    return "pending";
  }
}

/* ========= MODAL ========= */
function ImageModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={imageUrl}
          alt="Bukti Pembayaran"
          className="w-full h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
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

  const [statusFilter, setStatusFilter] = useState("pending"); // 'pending' | 'approved' | 'rejected' | 'all'
  const selectedKey = useMemo(() => String(selectedNisn ?? ""), [selectedNisn]);

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
          qref = query(collectionGroup(db, "payments"), orderBy("createdAt", "desc"), limit(pageSize + 1));
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
  }, [pageSize, selectedKey, statusFilter]);

  const act = async (row, action /* 'approve' | 'reject' */) => {
    try {
      setBusyId(row.id);
      const res = await fetch("/api/re_registration_payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nisn: row.nisn, paymentId: row.id, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Gagal memverifikasi pembayaran.");
      await loadPage("first", null);
    } catch (e) {
      alert(e.message || "Gagal memproses.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">
            Persetujuan Pembayaran {headerSuffix} {selectedKey ? `(NISN: ${selectedKey})` : ""}
            {" · "}
            <span className="font-normal text-slate-700">
              Filter: {statusFilter === "pending" ? "Pending" : statusFilter === "approved" ? "Disetujui" : statusFilter === "rejected" ? "Ditolak" : "Semua"}
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
                    statusFilter === it.key ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {it.label}
                </button>
              ))}
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
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
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-4 text-sm text-slate-700 inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-slate-700">Tidak ada data untuk filter ini.</div>
          ) : (
            rows.map((r) => {
              const s = normalizeStatus(r);
              const isPending = s === "pending";
              return (
                <div key={`${r.nisn}-${r.id}`} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">
                      {r.student?.name || "-"} <span className="text-slate-500 font-normal">({r.nisn})</span>
                    </div>
                    <div className="text-xs text-slate-600">{r.student?.level || "-"}</div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="text-slate-700">
                      Jumlah: <b>{fmtIDR(r.amount)}</b>
                      {r.note ? <span className="text-slate-500"> · {r.note}</span> : null}
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
                      onClick={() => act(r, "approve")}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                      title={isPending ? "" : "Sudah diproses"}
                    >
                      <BadgeCheck className="h-4 w-4" />
                      Setujui
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id || !isPending}
                      onClick={() => act(r, "reject")}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white text-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60"
                      title={isPending ? "" : "Sudah diproses"}
                    >
                      <XCircle className="h-4 w-4" />
                      Tolak
                    </button>
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

/* ========= HALAMAN UTAMA ========= */
export default function AdminDaftarUlangPage() {
  const [view, setView] = useState("PTK"); // 'PTK' | 'NON_PTK'
  const [levels, setLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(true);

  const [pageSize, setPageSize] = useState(10);
  const [jenjangFilter, setJenjangFilter] = useState("");

  const [selected, setSelected] = useState(null);

  // NEW: toggle visibilitas panel Potongan
  const [showPotongan, setShowPotongan] = useState(true);

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
        alive && setLevels(Array.from(seen).sort((a, b) => (a || "").localeCompare(b || "", "id")));
      } finally {
        alive && setLoadingLevels(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleAfterApprove = useCallback(() => {
    setSelected((s) => (s ? { ...s } : s));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/60 w-full">
      {/* === Judul sederhana (tanpa header/sticky) === */}
      <div className="px-4 pt-6 md:pt-8">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
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
                      view === "PTK" ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Daftar PTK
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("NON_PTK")}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
                      view === "NON_PTK" ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50"
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
                  title={view !== "PTK" ? "Hanya untuk tab PTK" : showPotongan ? "Sembunyikan Potongan" : "Tampilkan Potongan"}
                >
                  {showPotongan ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  {loadingLevels ? <Loader2 className="ml-2 h-4 w-4 animate-spin text-slate-500" /> : null}
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
              <PTKPanel db={db} jenjangFilter={jenjangFilter} pageSize={pageSize} onRowSelect={setSelected} />
            ) : (
              <NonPTKPanel db={db} jenjangFilter={jenjangFilter} pageSize={pageSize} onRowSelect={setSelected} />
            )}
          </div>
        </div>

        {/* Kanan */}
        <div className="xl:col-span-2 space-y-6">
          {/* Potongan hanya untuk PTK & jika toggle ON */}
          {view === "PTK" && showPotongan && selected ? (
            <KonfirmasiPotonganPanel
              db={db}
              selected={selected}
              onAfterApprove={handleAfterApprove}
              onRequestHide={() => setShowPotongan(false)}
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
