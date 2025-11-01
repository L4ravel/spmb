"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
  limit as qLimit,
} from "firebase/firestore";
import { CreditCard, Landmark } from "lucide-react";

/* ================== Firebase ================== */
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

/* ================== Date helpers ================== */
const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const atEndOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const addDays      = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek  = (d) => { const x=atStartOfDay(d); const delta=(x.getDay()+6)%7; x.setDate(x.getDate()-delta); return x; };
const endOfWeek    = (d) => addDays(startOfWeek(d),6);
const startOfMonth = (d) => { const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; };
const endOfMonth   = (d) => { const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(23,59,59,999); return x; };

const fmtDay   = (d)=>new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short"}).format(d);
const fmtWeek  = (s,e)=>`${fmtDay(s)}—${fmtDay(e)}`;
const fmtMonth = (d)=>new Intl.DateTimeFormat("id-ID",{month:"short",year:"numeric"}).format(d);
const pad2 = (n) => String(n).padStart(2, "0");
const dateInputLocal = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* ================== Buckets ================== */
function createDailyBuckets(from, to) {
  const res = [];
  let cur = atStartOfDay(from);
  const end = atStartOfDay(to);
  while (cur <= end) {
    res.push({ key: cur.toISOString(), label: fmtDay(cur), start: atStartOfDay(cur), end: atEndOfDay(cur) });
    cur = addDays(cur, 1);
  }
  return res;
}
function buildWeeklyBuckets(count = 12) {
  const res = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const ref = addDays(today, -7 * i);
    const s = startOfWeek(ref); const e = endOfWeek(ref);
    res.push({ key: s.toISOString(), label: fmtWeek(s,e), start: s, end: atEndOfDay(e) });
  }
  return res;
}
function buildMonthlyBuckets(count = 12) {
  const res = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const s = startOfMonth(ref); const e = endOfMonth(ref);
    res.push({ key: s.toISOString(), label: fmtMonth(s), start: s, end: e });
  }
  return res;
}

/* ================== Count helpers ================== */
async function countPaidRange(start, end, method, timeField = "createdAt") {
  const col = collection(db, "users_app");
  const qPaid = query(
    col,
    where("registrationPaymentMethod", "==", method),
    where(timeField, ">=", start),
    where(timeField, "<=", end)
  );
  const snap = await getCountFromServer(qPaid);
  return snap.data().count || 0;
}
async function countTotalRange(start, end, timeField = "createdAt") {
  const col = collection(db, "users_app");
  const qT = query(col, where(timeField, ">=", start), where(timeField, "<=", end));
  const snap = await getCountFromServer(qT);
  return snap.data().count || 0;
}

/* ====== fees: ambil label → fee ====== */
async function fetchFeesMap() {
  const snap = await getDocs(query(collection(db, "fees"), qLimit(2000)));
  const map = new Map();
  snap.forEach((d) => {
    const data = d.data() || {};
    const label = String(data.label || "").trim();
    const fee = Number(data.fee || 0);
    if (label) map.set(label, fee);
  });
  return map;
}

/* ====== count paid by level ====== */
async function countPaidByLevelInRange(level, start, end, timeField = "createdAt") {
  const col = collection(db, "users_app");
  const qLvPaid = query(
    col,
    where("registrationPaymentMethod", "in", ["online", "offline"]),
    where("registrationLevel", "==", level),
    where(timeField, ">=", start),
    where(timeField, "<=", end)
  );
  const snap = await getCountFromServer(qLvPaid);
  return snap.data().count || 0;
}
async function countPaidByLevelAndMethodInRange(level, start, end, method, timeField = "createdAt") {
  const col = collection(db, "users_app");
  const qLvPaid = query(
    col,
    where("registrationPaymentMethod", "==", method),
    where("registrationLevel", "==", level),
    where(timeField, ">=", start),
    where(timeField, "<=", end)
  );
  const snap = await getCountFromServer(qLvPaid);
  return snap.data().count || 0;
}

/* ================== Charts ================== */
function BarChart({ series, labels, height = 420 }) {
  const allData = series.flatMap((s) => s.data);
  const rawMax = Math.max(1, ...allData);
  let yMax;
  if (rawMax <= 5) yMax = 5;
  else if (rawMax <= 10) yMax = 10;
  else if (rawMax <= 25) yMax = 25;
  else if (rawMax <= 50) yMax = 50;
  else if (rawMax <= 100) yMax = 100;
  else yMax = rawMax;

  const barWidth = 56;
  const groupGap = 44;
  const barGap = 10;
  const numGroups = labels.length;
  const groupWidth = series.length * barWidth + (series.length - 1) * barGap;
  const width = Math.max(900, numGroups * (groupWidth + groupGap) + 120);
  const pad = 60;
  const chartHeight = height - pad * 2;

  const nf = (n) => new Intl.NumberFormat("id-ID", { notation: "compact", compactDisplay: "short" }).format(n);
  const tickVals = [0, 0.25, 0.5, 0.75, 1].map(r => Math.round(yMax * (1 - r)));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
        const y = pad + chartHeight * ratio;
        const val = tickVals[idx];
        return (
          <g key={ratio}>
            <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
            <text x={pad - 12} y={y + 5} textAnchor="end" fontSize="12" fill="#64748b">{nf(val)}</text>
          </g>
        );
      })}
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#94a3b8" strokeWidth="2" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#94a3b8" strokeWidth="2" />

      {labels.map((label, i) => {
        const groupX = pad + i * (groupWidth + groupGap) + groupGap;
        return (
          <g key={i}>
            {series.map((s, sIdx) => {
              const val = s.data[i];
              const barH = (val / yMax) * chartHeight;
              const barY = height - pad - barH;
              const barX = groupX + sIdx * (barWidth + barGap);
              return (
                <g key={sIdx}>
                  <rect x={barX} y={barY} width={barWidth} height={barH} fill={s.color} opacity="0.92" rx="8" />
                  {val > 0 && (
                    <text x={barX + barWidth / 2} y={barY - 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e293b">
                      {nf(val)}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={groupX + groupWidth / 2} y={height - pad + 24} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="500">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RevenueBarChart({ data, labels, height = 280 }) {
  const max = Math.max(1, ...data);
  const barWidth = 50;
  const gap = 30;
  const numBars = labels.length;
  const width = Math.max(600, numBars * (barWidth + gap) + 100);
  const pad = 50;
  const chartHeight = height - pad * 2;

  const rupShort = (n) => {
    if (n >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toFixed(1)}M`;
    if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
    return `Rp${n}`;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = pad + chartHeight * ratio;
        const val = Math.round(max * (1 - ratio));
        return (
          <g key={ratio}>
            <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
            <text x={pad - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{rupShort(val)}</text>
          </g>
        );
      })}
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#94a3b8" strokeWidth="2" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#94a3b8" strokeWidth="2" />
      {labels.map((label, i) => {
        const x = pad + i * (barWidth + gap) + gap;
        const val = data[i];
        const barH = (val / max) * chartHeight;
        const barY = height - pad - barH;
        return (
          <g key={i}>
            <rect x={x} y={barY} width={barWidth} height={barH} fill="#f59e0b" rx="6" opacity="0.9" />
            {val > 0 && (
              <text x={x + barWidth / 2} y={barY - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#92400e">
                {rupShort(val)}
              </text>
            )}
            <text x={x + barWidth / 2} y={height - pad + 20} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="500">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ================== Page ================== */
export default function StatistikPembayaranPage() {
  const [activeTab, setActiveTab] = useState("daily");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = addDays(new Date(), -6);
    return dateInputLocal(atStartOfDay(d));
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = atStartOfDay(new Date());
    return dateInputLocal(today);
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [labels, setLabels] = useState([]);
  const [paidOnline, setPaidOnline] = useState([]);
  const [paidOffline, setPaidOffline] = useState([]);
  const [unpaid, setUnpaid] = useState([]);
  const [totalPaidSeries, setTotalPaidSeries] = useState([]);
  const [totalRegistrants, setTotalRegistrants] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [revenueOffline, setRevenueOffline] = useState([]);

  // NEW: Fullscreen overlay ("count" | "revenue" | null)
  const [fullscreen, setFullscreen] = useState(null);

  // NEW: tinggi viewport agar chart pas 1 layar (tanpa scroll)
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const on = () => setVh(typeof window !== "undefined" ? window.innerHeight : 0);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // header overlay ~60px + padding dsb → sisa untuk chart container
  const FS_CARD_PADDING = 160; // aman untuk mobile/desktop
  const countFSHeight   = Math.max(360, vh - FS_CARD_PADDING);
  const revenueFSHeight = Math.max(320, vh - FS_CARD_PADDING);

  const sumPaidOnline   = useMemo(() => paidOnline.reduce((a, b) => a + b, 0), [paidOnline]);
  const sumPaidOffline  = useMemo(() => paidOffline.reduce((a, b) => a + b, 0), [paidOffline]);
  const sumUnpaid       = useMemo(() => unpaid.reduce((a, b) => a + b, 0), [unpaid]);
  const sumTotReg       = useMemo(() => totalRegistrants.reduce((a, b) => a + b, 0), [totalRegistrants]);
  const sumTotalPaid    = useMemo(() => totalPaidSeries.reduce((a, b) => a + b, 0), [totalPaidSeries]);
  const sumRevenue      = useMemo(() => revenue.reduce((a, b) => a + b, 0), [revenue]);
  const sumRevOffline   = useMemo(() => revenueOffline.reduce((a, b) => a + b, 0), [revenueOffline]);
  const sumRevOnline    = useMemo(() => Math.max(0, sumRevenue - sumRevOffline), [sumRevenue, sumRevOffline]);

  async function load(kind = activeTab) {
    setLoading(true);
    setErr("");
    try {
      let buckets = [];
      if (kind === "daily") {
        const s = atStartOfDay(new Date(dateFrom));
        const e = atStartOfDay(new Date(dateTo));
        buckets = createDailyBuckets(s, e);
      } else if (kind === "weekly") {
        buckets = buildWeeklyBuckets(12);
      } else {
        buckets = buildMonthlyBuckets(12);
      }
      setLabels(buckets.map((b) => b.label));

      const PERIOD_FIELD = "createdAt";
      const resOn = [], resOff = [], resTotReg = [], resTotPaid = [], resUnpaid = [];

      const CONCURRENCY = 6;
      for (let i = 0; i < buckets.length; i += CONCURRENCY) {
        const slice = buckets.slice(i, i + CONCURRENCY);
        const part = await Promise.all(
          slice.map(async (b) => {
            const [on, off, ttReg] = await Promise.all([
              countPaidRange(b.start, b.end, "online",  PERIOD_FIELD),
              countPaidRange(b.start, b.end, "offline", PERIOD_FIELD),
              countTotalRange(b.start, b.end,  PERIOD_FIELD),
            ]);
            return { on, off, ttReg };
          })
        );
        part.forEach(({ on, off, ttReg }) => {
          const totPaid = on + off;
          const unp = Math.max(0, ttReg - totPaid);
          resOn.push(on);
          resOff.push(off);
          resTotReg.push(ttReg);
          resTotPaid.push(totPaid);
          resUnpaid.push(unp);
        });
      }
      setPaidOnline(resOn);
      setPaidOffline(resOff);
      setTotalRegistrants(resTotReg);
      setTotalPaidSeries(resTotPaid);
      setUnpaid(resUnpaid);

      // REVENUE
      const feesMap = await fetchFeesMap();
      const feeLabels = Array.from(feesMap.keys());
      const revAll = [];
      const revOff = [];

      for (const b of buckets) {
        let sumRpAll = 0;
        let sumRpOff = 0;
        const LCHUNK = 8;

        for (let i = 0; i < feeLabels.length; i += LCHUNK) {
          const slice = feeLabels.slice(i, i + LCHUNK);
          const countsPaid = await Promise.all(
            slice.map((label) => countPaidByLevelInRange(label, b.start, b.end, PERIOD_FIELD))
          );
          const countsOff = await Promise.all(
            slice.map((label) => countPaidByLevelAndMethodInRange(label, b.start, b.end, "offline", PERIOD_FIELD))
          );
          countsPaid.forEach((cnt, idx) => {
            const label = slice[idx];
            const fee = feesMap.get(label) || 0;
            sumRpAll += Number(cnt || 0) * Number(fee || 0);
          });
          countsOff.forEach((cnt, idx) => {
            const label = slice[idx];
            const fee = feesMap.get(label) || 0;
            sumRpOff += Number(cnt || 0) * Number(fee || 0);
          });
        }
        revAll.push(sumRpAll);
        revOff.push(sumRpOff);
      }
      setRevenue(revAll);
      setRevenueOffline(revOff);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Gagal memuat statistik.");
      setPaidOnline([]); setPaidOffline([]); setUnpaid([]); setTotalRegistrants([]); setTotalPaidSeries([]);
      setRevenue([]); setRevenueOffline([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load("daily"); }, []);

  const nf  = (n) => new Intl.NumberFormat("id-ID").format(n);
  const rup = (n) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);

  return (
    <div className="min-h-screen">
      <main className="w-full px-4 md:px-8 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-black">
              Statistik Pembayaran
            </h1>
          </div>
        </div>

        {/* Tab */}
        <div className="mb-6 bg-white rounded-2xl shadow-lg p-2 inline-flex gap-2">
          {[
            { id: "daily", label: "📅 Harian" },
            { id: "weekly", label: "📊 Mingguan" },
            { id: "monthly", label: "📈 Bulanan" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); load(t.id); }}
              className={[
                "px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
                activeTab === t.id
                  ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-200 scale-105"
                  : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date Filter Harian */}
        {activeTab === "daily" && (
          <div className="mb-6 bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-800">Filter Periode</h3>
            </div>
            <div className="flex items-end gap-4 flex-wrap text-black">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal Mulai</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal Akhir</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all"
                />
              </div>
              <button
                onClick={() => load("daily")}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                Tampilkan
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white shadow-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-violet-200 border-t-violet-600 mb-4"></div>
            <p className="text-slate-600 font-medium">Memuat statistik...</p>
          </div>
        ) : err ? (
          <div className="rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 p-6 shadow-lg">
            <p className="font-semibold">⚠️ {err}</p>
          </div>
        ) : (
          <>
            {/* Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <SummaryCard label="Total Pendaftar" value={nf(sumTotReg)} color="violet" icon="👥" />
              <SummaryCard label="Pembayaran Online" value={nf(sumPaidOnline)} color="green" icon="💳" />
              <SummaryCard label="Bayar Offline" value={nf(sumPaidOffline)} color="blue" icon="🏦" />
              <SummaryCard label="Belum Bayar" value={nf(sumUnpaid)} color="red" icon="⏳" />
              <RevenueToggleCard offlineValue={rup(sumRevOffline)} onlineValue={rup(sumRevOnline)} />
            </div>

            {/* Revenue Total */}
            <div className="mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm font-medium mb-1">💰 Total Pendapatan (semua pembayaran)</p>
                  <p className="text-3xl md:text-4xl font-bold">{rup(sumRevenue)}</p>
                </div>
              </div>
            </div>

            {/* Chart: Count */}
            <div className="w-full rounded-2xl bg-white shadow-xl p-6 mb-6 border border-slate-200">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h2 className="text-xl font-bold text-slate-800">📊 Grafik Jumlah Pembayaran</h2>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex flex-wrap items-center gap-3 text-sm mr-2">
                    <Legend color="#10b981" text="Online" />
                    <Legend color="#3b82f6" text="Offline" />
                    <Legend color="#8b5cf6" text="Total Bayar" />
                    <Legend color="#ef4444" text="Belum Bayar" />
                  </div>
                  <button
                    onClick={() => setFullscreen("count")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title="Layar Penuh"
                  >
                    ⤢ Full Layar
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto bg-slate-50 rounded-xl p-4">
                <BarChart
                  series={[
                    { name: "Online",      color: "#10b981", data: paidOnline },
                    { name: "Offline",     color: "#3b82f6", data: paidOffline },
                    { name: "Total Bayar", color: "#8b5cf6", data: totalPaidSeries },
                    { name: "Belum Bayar", color: "#ef4444", data: unpaid },
                  ]}
                  labels={labels}
                  height={420}
                />
              </div>
            </div>

            {/* Chart: Revenue */}
            <div className="rounded-2xl bg-white shadow-xl p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h2 className="text-xl font-bold text-slate-800">💵 Grafik Pendapatan (Paid Only)</h2>
                <div className="flex items-center gap-2">
                  <Legend color="#f59e0b" text="Pendapatan (Rp)" />
                  <button
                    onClick={() => setFullscreen("revenue")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title="Layar Penuh"
                  >
                    ⤢ Full Layar
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto bg-slate-50 rounded-xl p-4">
                <RevenueBarChart data={revenue} labels={labels} height={280} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* ===== Fullscreen Overlay (tanpa scroll) ===== */}
      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-0 flex flex-col">
            {/* Header sticky */}
            <div className="sticky top-0 z-[101] bg-slate-900/80 text-white px-4 py-3 flex items-center justify-between ring-1 ring-white/10 backdrop-saturate-150">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">
                  {fullscreen === "count" ? "📊 Grafik Jumlah Pembayaran" : "💵 Grafik Pendapatan"}
                </span>
                {fullscreen === "count" ? (
                  <div className="hidden sm:flex items-center gap-3 text-xs">
                    <Legend color="#10b981" text="Online" />
                    <Legend color="#3b82f6" text="Offline" />
                    <Legend color="#8b5cf6" text="Total Bayar" />
                    <Legend color="#ef4444" text="Belum Bayar" />
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-3 text-xs">
                    <Legend color="#f59e0b" text="Pendapatan (Rp)" />
                  </div>
                )}
              </div>
              <button
                onClick={() => setFullscreen(null)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"
                title="Tutup"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Konten pas 1 layar */}
            {/* Konten pas 1 layar */}
<div className="flex-1 p-3 sm:p-6 overflow-hidden">
  {/* Mobile: center, Desktop: layout lama */}
  <div className="mx-auto w-full max-w-[1600px] h-full md:block flex items-center justify-center">
    <div className="rounded-xl bg-white shadow-2xl p-3 sm:p-6 md:h-full overflow-hidden
                    w-full md:w-auto max-w-[100%] md:max-w-none
                    my-4 md:my-0">
      {fullscreen === "count" ? (
        <div className="bg-slate-50 rounded-xl p-3 sm:p-6 overflow-hidden
                        md:h-full h-auto">
          <BarChart
            series={[
              { name: "Online",      color: "#10b981", data: paidOnline },
              { name: "Offline",     color: "#3b82f6", data: paidOffline },
              { name: "Total Bayar", color: "#8b5cf6", data: totalPaidSeries },
              { name: "Belum Bayar", color: "#ef4444", data: unpaid },
            ]}
            labels={labels}
            /* Desktop tetap memenuhi layar, Mobile punya margin atas-bawah agar tampak tengah */
            height={countFSHeight}
          />
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-3 sm:p-6 overflow-hidden
                        md:h-full h-auto">
          <RevenueBarChart
            data={revenue}
            labels={labels}
            height={revenueFSHeight}
          />
        </div>
      )}
    </div>
  </div>
</div>

          </div>
        </div>
      )}
    </div>
  );
}

/* ======= UI Components ======= */
function Legend({ color, text }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200">
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium text-slate-700">{text}</span>
    </span>
  );
}

function SummaryCard({ label, value, color, icon }) {
  const colorMap = {
    violet: "from-violet-500 to-purple-600",
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-cyan-600",
    red: "from-red-500 to-rose-600",
    orange: "from-amber-500 to-orange-600",
  };
  return (
    <div className="rounded-2xl bg-white shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-start justify-between mb-3">
        <p className="text-slate-600 text-sm font-medium">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
        {value}
      </p>
    </div>
  );
}

/* ======= Revenue Toggle Card ======= */
function RevenueToggleCard({ offlineValue, onlineValue }) {
  const [mode, setMode] = useState("offline"); // "offline" | "online"
  const isOffline = mode === "offline";
  return (
    <div className="rounded-2xl bg-white shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-start justify-between mb-3">
        <p className="text-slate-600 text-sm font-medium">
          {isOffline ? "Pendapatan Offline" : "Pendapatan Online"}
        </p>
        <button
          type="button"
          onClick={() => setMode(isOffline ? "online" : "offline")}
          title={isOffline ? "Lihat Pendapatan Online" : "Lihat Pendapatan Offline"}
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          {isOffline ? <Landmark className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
        </button>
      </div>
      <p className={`text-3xl font-bold bg-gradient-to-r ${isOffline ? "from-blue-500 to-blue-600" : "from-emerald-500 to-green-600"} bg-clip-text text-transparent`}>
        {isOffline ? offlineValue : onlineValue}
      </p>
    </div>
  );
}
