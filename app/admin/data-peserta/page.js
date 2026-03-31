"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit as qLimit,
  getCountFromServer,
} from "firebase/firestore";

/* =============== Firebase init =============== */
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

/* =============== Utils & Ordering =============== */
const human = (n) => new Intl.NumberFormat("id-ID").format(n);

// Kelompok untuk badge saja (tetap 2 seksi: Sekolah & Universitas)
const isUniv = (label) => /\(S1\)/i.test(label || "");
const groupNameOf = (label) => (isUniv(label) ? "Universitas" : "Sekolah");

// DEFINISI URUTAN KUSTOM (TK → … → LKSA → Universitas)
const ORDER_SCHOOL = [
  "TK",
  "SD Putra", "SD Putri",
  "SMP Putra", "SMP Putri",
  "SMA Putra", "SMA Putri",
];
const ORDER_LKSA = [
  "Ula Ita Putra", "Ula Ita Putri",
  "PPS Wustho", "PPS Ulya",
];
const ORDER_UNIV = [
  "PGMI Putra (S1)", "PGMI Putri (S1)",
  "MPI Putra (S1)",  "MPI Putri (S1)",
  "PIAUD Putra (S1)","PIAUD Putri (S1)",
];

// prioritas: TK…SMA (0xx) → LKSA (2xx) → Lain non-univ (4xx) → Universitas (8xx)
function priorityOf(label) {
  const s = String(label || "");
  let idx = ORDER_SCHOOL.indexOf(s);
  if (idx >= 0) return 10 + idx;                     // 010–…
  idx = ORDER_LKSA.indexOf(s);
  if (idx >= 0) return 210 + idx;                    // 210–…
  if (isUniv(s)) {
    idx = ORDER_UNIV.indexOf(s);
    return 810 + (idx >= 0 ? idx : 99);              // 810–… (universitas)
  }
  return 410;                                        // non-univ tak dikenal → setelah LKSA, sebelum Univ
}

// robust: definisi “paid” (untuk filter query)
const paidStatusValues = ["verified", "settled", "paid", "confirm", "confirmed"];

/* ---- Ambil daftar jenjang dari fees (field `label`) ---- */
async function fetchFeeLabels() {
  const snap = await getDocs(query(collection(db, "fees"), qLimit(2000)));
  const set = new Set();
  snap.forEach((d) => {
    const label = String(d.data()?.label || "").trim();
    if (label) set.add(label);
  });
  // Tidak perlu sort alfabet; kita akan sort dengan priorityOf saat menyusun summary
  return Array.from(set);
}

/* ---- Hitung count per jenjang TANPA muat dokumen users_app ----
   total: where(registrationLevel == label)
   paid : (A) where(verifiedPayment == true)
          (B) where(registrationPaymentStatus in paidStatusValues)
   paid_final = max(count(A), count(B))  (hindari double-count sederhana)
------------------------------------------------------------------ */
async function countByLevel(label) {
  const baseCol = collection(db, "users_app");

  // total
  const qTotal = query(baseCol, where("registrationLevel", "==", label));
  const total = (await getCountFromServer(qTotal)).data().count || 0;

  // paid via verifiedPayment
  const qPaidA = query(
    baseCol,
    where("registrationLevel", "==", label),
    where("verifiedPayment", "==", true)
  );
  const paidA = (await getCountFromServer(qPaidA)).data().count || 0;

  // paid via registrationPaymentStatus in [...]
  const qPaidB = query(
    baseCol,
    where("registrationLevel", "==", label),
    where("registrationPaymentStatus", "in", paidStatusValues)
  );
  const paidB = (await getCountFromServer(qPaidB)).data().count || 0;

  const paid = Math.max(paidA, paidB);
  const unpaid = Math.max(0, total - paid);
  const percent = total ? Math.round((paid / total) * 100) : 0;

  return { label, total, paid, unpaid, percent, group: groupNameOf(label), _prio: priorityOf(label) };
}

/* =============== Page =============== */
export default function DataPesertaPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  const [summary, setSummary] = useState([]);    // array of {label,total,paid,unpaid,percent,group,_prio}

  // KPI total
  const totalAll = useMemo(() => summary.reduce((s, it) => s + it.total, 0), [summary]);
  const totalPaidAll = useMemo(() => summary.reduce((s, it) => s + it.paid, 0), [summary]);
  const percentPaidAll = totalAll ? Math.round((totalPaidAll / totalAll) * 100) : 0;

  async function loadData() {
    setLoading(true);
    setErr("");
    try {
      const labels = await fetchFeeLabels(); // master jenjang dari fees

      // paralel: count per label (batasi concurrency ringan)
      const chunks = [];
      const CONCURRENCY = 6;
      for (let i = 0; i < labels.length; i += CONCURRENCY) {
        const part = labels.slice(i, i + CONCURRENCY);
        // eslint-disable-next-line no-await-in-loop
        const res = await Promise.all(part.map((label) => countByLevel(label)));
        chunks.push(...res);
      }

      // urutkan sesuai prioritas (TK → … → LKSA → (lain non-univ) → Universitas)
      chunks.sort((a, b) => a._prio - b._prio || a.label.localeCompare(b.label, "id"));
      setSummary(chunks);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Gagal memuat rekap pembayaran.");
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Split sections (grid) – urutan dalam setiap seksi mengikuti summary yang sudah diprioritaskan
  const sections = useMemo(() => {
    const sekolah = [];
    const univ = [];
    summary.forEach((it) => (it.group === "Universitas" ? univ : sekolah).push(it));
    return [
      { name: "Sekolah", items: sekolah },
      { name: "Universitas", items: univ },
    ];
  }, [summary]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Rekap Pembayaran per Jenjang
            </h1>
                     </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={[
                  "px-3 py-2 text-sm font-semibold transition-colors",
                  viewMode === "grid"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                ].join(" ")}
                title="Tampilan Grid"
              >
                ⊞ Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={[
                  "px-3 py-2 text-sm font-semibold transition-colors border-l border-slate-300",
                  viewMode === "table"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                ].join(" ")}
                title="Tampilan Tabel"
              >
                ≡ Tabel
              </button>
            </div>
            <button
              onClick={loadData}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              title="Muat ulang data"
            >
              ↻ Muat Ulang
            </button>
          </div>
        </div>

        {/* KPI total */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <KPI label="Total Pendaftar" value={human(totalAll)} border="border-slate-300" />
          <KPI label="Sudah Bayar (Verified/Settled)" value={human(totalPaidAll)} border="border-emerald-300" />
          <KPI label="% Bayar" value={`${percentPaidAll}%`} border="border-indigo-300" />
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-300 p-4">
                <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="mt-3 h-8 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="mt-2 h-4 w-32 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {err && !loading && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 p-3 mb-4 font-medium">
            {err}
          </div>
        )}

        {/* Content */}
        {!loading && !err && (
          <>
            {viewMode === "grid" ? (
              sections.map((sec) => (
                <section key={sec.name} className="mb-10">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900">{sec.name}</h2>
                    <span className="text-sm font-medium text-slate-700">
                      {human(sec.items.reduce((s, it) => s + it.total, 0))} peserta •{" "}
                      {human(sec.items.reduce((s, it) => s + it.paid, 0))} bayar
                    </span>
                  </div>

                  {sec.items.length === 0 ? (
                    <div className="rounded-lg border border-slate-300 p-4 text-slate-800">Tidak ada data.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sec.items.map((it) => (
                        <Card key={it.label} category={sec.name} label={it.label}>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <MiniStat title="Pendaftar" value={human(it.total)} />
                            <MiniStat
                              title="Bayar"
                              value={human(it.paid)}
                              strong
                              border="border-emerald-300"
                              valueClass="text-emerald-700"
                            />
                            <MiniStat title="% Bayar" value={`${it.percent}%`} />
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-emerald-600 transition-all"
                              style={{ width: `${it.percent}%` }}
                              aria-label={`Progress bayar ${it.percent}%`}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">No</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Jenjang</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Kategori</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Total</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Sudah Bayar</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Belum Bayar</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">% Bayar</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-4 py-8 text-center text-slate-700">Tidak ada data.</td>
                        </tr>
                      ) : (
                        summary.map((it, idx) => (
                          <tr key={it.label} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-700">{idx + 1}</td>
                            <td className="px-4 py-3"><div className="text-sm font-semibold text-slate-900">{it.label}</div></td>
                            <td className="px-4 py-3 text-center">
                              <span className={[
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                                it.group === "Universitas"
                                  ? "bg-indigo-100 text-indigo-800 ring-indigo-300"
                                  : "bg-slate-100 text-slate-800 ring-slate-300",
                              ].join(" ")}>
                                {it.group}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{human(it.total)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">{human(it.paid)}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700">{human(it.unpaid)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{it.percent}%</td>
                            <td className="px-4 py-3">
                              <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${it.percent}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                        <td colSpan="3" className="px-4 py-3 text-sm text-slate-900">TOTAL KESELURUHAN</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">{human(totalAll)}</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-700">{human(totalPaidAll)}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">{human(totalAll - totalPaidAll)}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">{percentPaidAll}%</td>
                        <td className="px-4 py-3">
                          <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${percentPaidAll}%` }} />
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ========= presentational small components ========= */
function KPI({ label, value, border = "border-slate-300" }) {
  return (
    <div className={`rounded-2xl border ${border} bg-white p-4 shadow-sm`}>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-1 text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
    </div>
  );
}

function Card({ category, label, children }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600">Jenjang</div>
          <div className="text-base md:text-lg font-bold text-slate-900 leading-snug">{label}</div>
        </div>
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
            category === "Universitas"
              ? "bg-indigo-100 text-indigo-800 ring-indigo-300"
              : "bg-slate-100 text-slate-800 ring-slate-300",
          ].join(" ")}
        >
          {category}
        </span>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ title, value, strong = false, border = "border-slate-300", valueClass = "" }) {
  const wrap = ["rounded-lg border", border, "p-3 text-center", strong ? "bg-emerald-50 ring-1 ring-emerald-300" : ""].join(" ");
  const titleCls = ["text-[11px]", strong ? "font-semibold text-emerald-800" : "font-medium text-slate-700"].join(" ");
  const valCls = ["text-xl md:text-2xl font-extrabold tracking-tight", strong ? "text-emerald-800" : "text-slate-900", valueClass].join(" ");
  return (
    <div className={wrap}>
      <div className={titleCls}>{title}</div>
      <div className={valCls}>{value}</div>
    </div>
  );
}
