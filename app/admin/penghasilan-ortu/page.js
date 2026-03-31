// app/admin/penghasilan-ortu/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BarChart3,
  Loader2,
  Maximize2,
  X,
  Briefcase,
} from "lucide-react";

// ==== Referensi UI dari PPDBFormUI (Section & Select) ====
import { Section, Select } from "@/app/spmb/PPDBFormUI"; // sesuaikan path jika beda struktur

/* ===================== Utils: Umum ===================== */
function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/* ===================== Utils: Penghasilan ===================== */
function parseIncomeToNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s0 = String(v).trim().toLowerCase();
  if (!s0) return null;
  if (/(tidak|kosong|null|none|n\/a|na|-|—)/i.test(s0)) return null;

  let s = s0.replace(/rp/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const mJuta = s.match(/^(\d+(\.\d+)?)\s*(jt|juta)$/i);
  if (mJuta) return Math.round(parseFloat(mJuta[1]) * 1_000_000);

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  const digits = s.match(/\d+/g);
  if (digits?.length) {
    const n = Number(digits.join(""));
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}
function formatRupiahShort(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}Jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(1)}Rb`;
  return `Rp ${n}`;
}
function median(nums) {
  const arr = nums.slice().sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function average(nums) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
const NUMERIC_BUCKETS = [
  { key: "<1jt", min: 0, max: 1_000_000 },
  { key: "1–<2jt", min: 1_000_000, max: 2_000_000 },
  { key: "2–<3jt", min: 2_000_000, max: 3_000_000 },
  { key: "3–<5jt", min: 3_000_000, max: 5_000_000 },
  { key: "5–<10jt", min: 5_000_000, max: 10_000_000 },
  { key: "≥10jt", min: 10_000_000, max: Infinity },
];
function putToNumericBucket(value) {
  for (const b of NUMERIC_BUCKETS) if (value >= b.min && value < b.max) return b.key;
  return "Lainnya";
}

/* ===================== Utils: Pekerjaan ===================== */
// Normalisasi sebutan pekerjaan umum agar konsisten
function normalizeJob(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "Tidak Diisi";
  s = s.replace(/[^\p{L}\p{N}\s\-\/]/gu, ""); // buang simbol
  const low = s.toLowerCase();

  // mapping umum
  if (/^(pns|asn)$/i.test(low)) return "ASN/PNS";
  if (/(tni|polri)/i.test(low)) return "TNI/Polri";
  if (/^(guru|ustadz|ustaz|ustadha?|teacher|dosen)$/i.test(low)) return "Pendidik";
  if (/(wiraswasta|wirausaha|usaha|entrepreneur|dagang|pedagang)/i.test(low)) return "Wirausaha";
  if (/(swasta|karyawan|pegawai\s?swasta|staff)/i.test(low)) return "Karyawan Swasta";
  if (/^(buruh|tukang|kuli)/i.test(low)) return "Buruh/Tukang";
  if (/(petani|tani)/i.test(low)) return "Petani";
  if (/(nelayan)/i.test(low)) return "Nelayan";
  if (/(sopir|driver|ojek|kurir)/i.test(low)) return "Transportasi";
  if (/(perawat|bidan|dokter|nakes|tenaga\s?kesehatan)/i.test(low)) return "Tenaga Kesehatan";
  if (/(ibu rumah tangga|irt)/i.test(low)) return "Ibu Rumah Tangga";
  if (/(honorer|kontrak)/i.test(low)) return "Honorer/Kontrak";
  if (/(freelance|lepas|serabutan)/i.test(low)) return "Lepas/Serabutan";
  if (/(tidak\s*bekerja|penganggur|tanpa\s*kerja)/i.test(low)) return "Tidak Bekerja";

  return titleCase(s);
}

/* ===================== Visual: Warna & Chart ===================== */
const COLORS = [
  "#6D28D9", "#2563EB", "#059669", "#EA580C", "#DC2626", "#0EA5E9",
  "#7C3AED", "#1D4ED8", "#16A34A", "#D97706", "#B91C1C", "#0369A1",
];

function BarChart({
  data,
  height = 260,
  valueKey = "value",
  labelKey = "label",
  showPercent = false,
  className = "",
}) {
  const total = data.reduce((a, b) => a + (b[valueKey] || 0), 0);
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  const yTicks = 4;
  const barGap = 18;
  const barWidth = 36;
  const leftPad = 8;
  const bottomPad = 54;
  const width = Math.max(420, data.length * (barWidth + barGap) + barGap + leftPad);
  const y = (v) => Math.round((1 - v / max) * (height - 20));

  return (
    <div className={`overflow-x-auto ${className}`}>
      <svg width={width} height={height + bottomPad} role="img" aria-label="Bar chart">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = (max / yTicks) * i;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1="0" y1={yy} x2={width} y2={yy} stroke="#CBD5E1" strokeDasharray="4 4" />
              <text x="0" y={yy - 2} fontSize="12" fill="#334155">{Math.round(v)}</text>
            </g>
          );
        })}
        <line x1="0" y1={height} x2={width} y2={height} stroke="#64748B" />
        {data.map((d, i) => {
          const v = d[valueKey] || 0;
          const h = Math.max(6, height - y(v));
          const x = leftPad + barGap + i * (barWidth + barGap);
          const yTop = height - h;
          const col = COLORS[i % COLORS.length];
          const lbl = String(d[labelKey]);
          const pct = total ? Math.round((v / total) * 100) : 0;

          return (
            <g key={i}>
              <rect x={x} y={yTop} width={barWidth} height={h} fill={col} rx="8" />
              <g transform={`translate(${x + barWidth / 2 - 22}, ${yTop - 28})`}>
                <rect width="44" height="22" rx="6" fill="#111827" opacity="0.92" />
                <text x="22" y="15" textAnchor="middle" fontSize="12" fill="#FFF" fontWeight="700">
                  {showPercent ? `${pct}%` : v}
                </text>
              </g>
              <g transform={`translate(${x + barWidth / 2}, ${height + 6}) rotate(-35)`}>
                <text textAnchor="end" fontSize="13" fill="#0F172A" fontWeight="600" title={lbl}>
                  {lbl}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ===================== Modal (center & bawah) ===================== */
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 m-4 md:m-10 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 p-0">
          <div className="h-full w-full flex items-end justify-center overflow-x-auto">
            <div className="w-full max-w-[1200px] px-4 pb-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== Main Page ===================== */
export default function PenghasilanOrtuPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // data mentah
  const [rows, setRows] = useState([]); // {nisn, jenjang, ayahNum, ibuNum, ayahIncomeRaw, ibuIncomeRaw, ayahJob, ibuJob}

  // UI global
  const [tab, setTab] = useState("income"); // 'income' | 'jobs'
  const [jenjangFilter, setJenjangFilter] = useState("ALL");
  const [showPercent, setShowPercent] = useState(false);
  const [expanded, setExpanded] = useState(""); // modal chart key

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const snap = await getDocs(query(collection(db, "ppdb"), limit(5000)));
        const list = [];
        snap.forEach((d) => {
          const v = d.data() || {};
          const jenjang = (v.jenjang || v.registrationLevel || "").toString().trim();
          const ayahIncomeRaw = v.ayahIncome ?? v.penghasilanAyah ?? v.ayah_penghasilan ?? null;
          const ibuIncomeRaw = v.ibuIncome ?? v.penghasilanIbu ?? v.ibu_penghasilan ?? null;
          const ayahJob = normalizeJob(v.ayahKerja ?? v.pekerjaanAyah ?? v.ayah_pekerjaan ?? "");
          const ibuJob = normalizeJob(v.ibuKerja ?? v.pekerjaanIbu ?? v.ibu_pekerjaan ?? "");

          list.push({
            nisn: d.id,
            jenjang,
            ayahIncomeRaw,
            ibuIncomeRaw,
            ayahNum: parseIncomeToNumber(ayahIncomeRaw),
            ibuNum: parseIncomeToNumber(ibuIncomeRaw),
            ayahJob,
            ibuJob,
          });
        });
        setRows(list);
      } catch (e) {
        console.error(e);
        setErr("Gagal memuat data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- Common filters ---------- */
  const jenjangOptions = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.jenjang && s.add(r.jenjang));
    return ["ALL", ...Array.from(s).sort((a, b) => a.localeCompare(b, "id"))];
  }, [rows]);

  const view = useMemo(() => {
    if (jenjangFilter === "ALL") return rows;
    return rows.filter((r) => r.jenjang === jenjangFilter);
  }, [rows, jenjangFilter]);

  /* ---------- INCOME computations ---------- */
  const incomeSummary = useMemo(() => {
    const ayahNums = view.map((r) => r.ayahNum).filter(Number.isFinite);
    const ibuNums = view.map((r) => r.ibuNum).filter(Number.isFinite);
    const totalNums = view
      .map((r) =>
        Number.isFinite(r.ayahNum) || Number.isFinite(r.ibuNum)
          ? (r.ayahNum || 0) + (r.ibuNum || 0)
          : null
      )
      .filter(Number.isFinite);
    return {
      ayah: { median: median(ayahNums), avg: average(ayahNums) },
      ibu: { median: median(ibuNums), avg: average(ibuNums) },
      keluarga: { median: median(totalNums), avg: average(totalNums) },
      count: view.length,
    };
  }, [view]);

  function normalizeIncomeCategory(v) {
    const s = (v == null ? "" : String(v)).trim();
    if (!s) return "Tidak Diisi";
    if (/^(<\s*1\s*juta|<\s*1\s*jt)$/i.test(s)) return "<1jt";
    if (/^(1-2|1\s*-\s*2)\s*juta/i.test(s)) return "1–<2jt";
    if (/^(2-3|2\s*-\s*3)\s*juta/i.test(s)) return "2–<3jt";
    if (/^(3-5|3\s*-\s*5)\s*juta/i.test(s)) return "3–<5jt";
    if (/^(5-10|5\s*-\s*10)\s*juta/i.test(s)) return "5–<10jt";
    if (/^(>=?\s*10\s*juta|10\+|>\s*10\s*jt)/i.test(s)) return "≥10jt";
    return s;
  }

  function buildIncomeDistribution(kind /* 'ayah' | 'ibu' | 'keluarga' */) {
    const counter = new Map();
    for (const r of view) {
      if (kind === "keluarga") {
        const sum =
          (Number.isFinite(r.ayahNum) ? r.ayahNum : null) +
          (Number.isFinite(r.ibuNum) ? r.ibuNum : null);
        if (!Number.isFinite(sum)) {
          const label = "Tidak Diisi";
          counter.set(label, (counter.get(label) || 0) + 1);
        } else {
          const label = putToNumericBucket(sum);
          counter.set(label, (counter.get(label) || 0) + 1);
        }
        continue;
      }
      const raw = kind === "ayah" ? r.ayahIncomeRaw : r.ibuIncomeRaw;
      const num = parseIncomeToNumber(raw);
      if (Number.isFinite(num)) {
        const label = putToNumericBucket(num);
        counter.set(label, (counter.get(label) || 0) + 1);
      } else {
        const label = normalizeIncomeCategory(raw);
        counter.set(label, (counter.get(label) || 0) + 1);
      }
    }
    const numericOrder = new Map(NUMERIC_BUCKETS.map((b, i) => [b.key, i]));
    const arr = Array.from(counter.entries()).map(([label, value]) => ({ label, value }));
    arr.sort((a, b) => {
      const ai = numericOrder.has(a.label) ? numericOrder.get(a.label) : 999;
      const bi = numericOrder.has(b.label) ? numericOrder.get(b.label) : 999;
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label, "id");
    });
    return arr;
  }

  const distAyahIncomeRaw = useMemo(() => buildIncomeDistribution("ayah"), [view]);
  const distIbuIncomeRaw = useMemo(() => buildIncomeDistribution("ibu"), [view]);
  const distKeluargaIncomeRaw = useMemo(() => buildIncomeDistribution("keluarga"), [view]);

  // Global filter untuk income
  const allIncomeBuckets = useMemo(() => {
    const s = new Set();
    [...distAyahIncomeRaw, ...distIbuIncomeRaw, ...distKeluargaIncomeRaw].forEach((d) =>
      s.add(d.label)
    );
    const order = new Map(NUMERIC_BUCKETS.map((b, i) => [b.key, i]));
    return Array.from(s).sort((a, b) => {
      const ai = order.has(a) ? order.get(a) : 999;
      const bi = order.has(b) ? order.get(b) : 999;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b, "id");
    });
  }, [distAyahIncomeRaw, distIbuIncomeRaw, distKeluargaIncomeRaw]);

  const [incomeSelectedBuckets, setIncomeSelectedBuckets] = useState(null); // null => semua
  useEffect(() => setIncomeSelectedBuckets(null), [allIncomeBuckets.map(String).join("|")]);

  const incomeActiveBuckets = incomeSelectedBuckets ?? allIncomeBuckets;
  const distAyahIncome = useMemo(
    () => distAyahIncomeRaw.filter((d) => incomeActiveBuckets.includes(d.label)),
    [distAyahIncomeRaw, incomeActiveBuckets]
  );
  const distIbuIncome = useMemo(
    () => distIbuIncomeRaw.filter((d) => incomeActiveBuckets.includes(d.label)),
    [distIbuIncomeRaw, incomeActiveBuckets]
  );
  const distKeluargaIncome = useMemo(
    () => distKeluargaIncomeRaw.filter((d) => incomeActiveBuckets.includes(d.label)),
    [distKeluargaIncomeRaw, incomeActiveBuckets]
  );

  /* ---------- JOBS computations ---------- */
  function buildJobDistribution(kind /* 'ayah' | 'ibu' | 'gabungan' */) {
    const counter = new Map();
    for (const r of view) {
      if (kind === "gabungan") {
        const arr = [r.ayahJob, r.ibuJob].map(normalizeJob);
        arr.forEach((label) => {
          const key = label || "Tidak Diisi";
          counter.set(key, (counter.get(key) || 0) + 1);
        });
        continue;
      }
      const label = normalizeJob(kind === "ayah" ? r.ayahJob : r.ibuJob) || "Tidak Diisi";
      counter.set(label, (counter.get(label) || 0) + 1);
    }
    const arr = Array.from(counter.entries()).map(([label, value]) => ({ label, value }));
    // Urutkan by count desc, lalu alfabetis — tampilkan Top 30 agar ringkas
    arr.sort((a, b) => (b.value - a.value) || a.label.localeCompare(b.label, "id"));
    return arr.slice(0, 30);
  }

  const distAyahJobRaw = useMemo(() => buildJobDistribution("ayah"), [view]);
  const distIbuJobRaw = useMemo(() => buildJobDistribution("ibu"), [view]);
  const distGabunganJobRaw = useMemo(() => buildJobDistribution("gabungan"), [view]);

  // Global filter untuk jobs
  const allJobLabels = useMemo(() => {
    const s = new Set();
    [...distAyahJobRaw, ...distIbuJobRaw, ...distGabunganJobRaw].forEach((d) => s.add(d.label));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
  }, [distAyahJobRaw, distIbuJobRaw, distGabunganJobRaw]);

  const [jobSelectedCats, setJobSelectedCats] = useState(null); // null => semua
  useEffect(() => setJobSelectedCats(null), [allJobLabels.map(String).join("|")]);

  const jobActiveCats = jobSelectedCats ?? allJobLabels;
  const distAyahJob = useMemo(
    () => distAyahJobRaw.filter((d) => jobActiveCats.includes(d.label)),
    [distAyahJobRaw, jobActiveCats]
  );
  const distIbuJob = useMemo(
    () => distIbuJobRaw.filter((d) => jobActiveCats.includes(d.label)),
    [distIbuJobRaw, jobActiveCats]
  );
  const distGabunganJob = useMemo(
    () => distGabunganJobRaw.filter((d) => jobActiveCats.includes(d.label)),
    [distGabunganJobRaw, jobActiveCats]
  );

  /* ===================== Render ===================== */
  const Header = (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          {tab === "income" ? "Penghasilan Orang Tua" : "Pekerjaan Orang Tua"}
        </h1>
        <p className="mt-1 text-base text-slate-700">
          Sumber data: <code className="rounded bg-slate-100 px-1.5 py-0.5">ppdb/&lt;nisn&gt;</code>{" "}
          — field jenjang + {tab === "income" ? "ayahIncome, ibuIncome" : "ayahKerja, ibuKerja"}.
        </p>
      </div>
      {tab === "income" ? (
        <BarChart3 className="h-6 w-6 text-violet-700" />
      ) : (
        <Briefcase className="h-6 w-6 text-violet-700" />
      )}
    </div>
  );

  const Tabs = (
    <div className="mb-4 flex items-center gap-2">
      <button
        className={`rounded-lg px-4 py-2 text-sm font-semibold ring-1 ${
          tab === "income"
            ? "bg-violet-600 text-white ring-violet-700"
            : "bg-white text-slate-800 ring-slate-300 hover:bg-slate-50"
        }`}
        onClick={() => setTab("income")}
      >
        Penghasilan
      </button>
      <button
        className={`rounded-lg px-4 py-2 text-sm font-semibold ring-1 ${
          tab === "jobs"
            ? "bg-violet-600 text-white ring-violet-700"
            : "bg-white text-slate-800 ring-slate-300 hover:bg-slate-50"
        }`}
        onClick={() => setTab("jobs")}
      >
        Pekerjaan
      </button>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-white px-4 py-6 md:px-8">
      {Header}
      {Tabs}

      {/* ===== Filter bar — gaya PPDBFormUI ===== */}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Section title="Filter Jenjang" desc="Terapkan ke semua grafik">
          <div className="md:col-span-2">
            <label className="text-[13px] font-medium text-slate-700">Pilih jenjang</label>
            <Select
              value={jenjangFilter}
              onChange={(e) => setJenjangFilter(e.target.value)}
              className="mt-1"
            >
              {jenjangOptions.map((j) => (
                <option key={j} value={j}>
                  {j === "ALL" ? "Semua Jenjang" : j}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-slate-700">Tampilan angka</label>
            <div className="mt-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showPercent}
                  onChange={(e) => setShowPercent(e.target.checked)}
                />
                Tampilkan Persentase (%)
              </label>
            </div>
            <div className="mt-2 text-sm text-slate-700">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat…
                </span>
              ) : err ? (
                <span className="text-rose-700">{err}</span>
              ) : (
                <span>
                  Data terlihat: <b>{view.length}</b> entri
                </span>
              )}
            </div>
          </div>
        </Section>

        {/* Bucket/Kategori Filter — menyesuaikan tab aktif dengan pola Section */}
        {tab === "income" ? (
          <Section title="Bucket Penghasilan (Global)" desc="Checklist untuk menyaring kategori">
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setIncomeSelectedBuckets(
                    (incomeSelectedBuckets ?? []).length === allIncomeBuckets.length
                      ? []
                      : [...allIncomeBuckets]
                  )
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
              >
                {(incomeSelectedBuckets ?? allIncomeBuckets).length === allIncomeBuckets.length
                  ? "Kosongkan"
                  : "Pilih semua"}
              </button>
              <button
                onClick={() => setIncomeSelectedBuckets(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
            <div className="md:col-span-2 max-h-28 overflow-auto rounded-md border border-slate-200 p-2">
              {allIncomeBuckets.map((lbl) => {
                const active = (incomeSelectedBuckets ?? allIncomeBuckets).includes(lbl);
                return (
                  <label key={lbl} className="mr-3 inline-flex items-center gap-2 text-sm text-slate-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={active}
                      onChange={() =>
                        setIncomeSelectedBuckets((prev) => {
                          const base = prev ? [...prev] : [...allIncomeBuckets];
                          const i = base.indexOf(lbl);
                          if (i >= 0) base.splice(i, 1);
                          else base.push(lbl);
                          return allIncomeBuckets.filter((x) => base.includes(x));
                        })
                      }
                    />
                    {lbl}
                  </label>
                );
              })}
            </div>
          </Section>
        ) : (
          <Section title="Kategori Pekerjaan (Global)" desc="Checklist untuk menyaring label">
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setJobSelectedCats(
                    (jobSelectedCats ?? []).length === allJobLabels.length ? [] : [...allJobLabels]
                  )
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
              >
                {(jobSelectedCats ?? allJobLabels).length === allJobLabels.length
                  ? "Kosongkan"
                  : "Pilih semua"}
              </button>
              <button
                onClick={() => setJobSelectedCats(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
            <div className="md:col-span-2 max-h-28 overflow-auto rounded-md border border-slate-200 p-2">
              {allJobLabels.map((lbl) => {
                const active = (jobSelectedCats ?? allJobLabels).includes(lbl);
                return (
                  <label key={lbl} className="mr-3 inline-flex items-center gap-2 text-sm text-slate-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={active}
                      onChange={() =>
                        setJobSelectedCats((prev) => {
                          const base = prev ? [...prev] : [...allJobLabels];
                          const i = base.indexOf(lbl);
                          if (i >= 0) base.splice(i, 1);
                          else base.push(lbl);
                          return allJobLabels.filter((x) => base.includes(x));
                        })
                      }
                    />
                    {lbl}
                  </label>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* ===== TAB: PENGHASILAN ===== */}
      {tab === "income" && (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-violet-100 p-3 ring-1 ring-violet-300">
              <div className="text-slate-800">Ayah (median)</div>
              <div className="text-xl font-extrabold text-violet-900">
                {formatRupiahShort(incomeSummary.ayah.median)}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-100 p-3 ring-1 ring-emerald-300">
              <div className="text-slate-800">Ibu (median)</div>
              <div className="text-xl font-extrabold text-emerald-900">
                {formatRupiahShort(incomeSummary.ibu.median)}
              </div>
            </div>
            <div className="rounded-lg bg-sky-100 p-3 ring-1 ring-sky-300">
              <div className="text-slate-800">Keluarga (rata2)</div>
              <div className="text-xl font-extrabold text-sky-900">
                {formatRupiahShort(incomeSummary.keluarga.avg)}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Distribusi Penghasilan Ayah" desc="Bucket otomatis + kategori asli">
              <div className="flex items-center justify-end md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExpanded("income-ayah")}
                >
                  <Maximize2 className="h-4 w-4" /> Perbesar
                </button>
              </div>
              <div className="md:col-span-2">
                <BarChart data={distAyahIncome} showPercent={showPercent} className="mt-2" />
              </div>
            </Section>

            <Section title="Distribusi Penghasilan Ibu" desc="Bucket otomatis + kategori asli">
              <div className="flex items-center justify-end md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExpanded("income-ibu")}
                >
                  <Maximize2 className="h-4 w-4" /> Perbesar
                </button>
              </div>
              <div className="md:col-span-2">
                <BarChart data={distIbuIncome} showPercent={showPercent} className="mt-2" />
              </div>
            </Section>

            <Section title="Total Penghasilan Keluarga" desc="Penjumlahan ayah + ibu (jika numerik)">
              <div className="flex items-center justify-end md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExpanded("income-keluarga")}
                >
                  <Maximize2 className="h-4 w-4" /> Perbesar
                </button>
              </div>
              <div className="md:col-span-2">
                <BarChart data={distKeluargaIncome} showPercent={showPercent} className="mt-2" />
              </div>
            </Section>
          </div>
        </>
      )}

      {/* ===== TAB: PEKERJAAN (diselaraskan ke PPDBFormUI) ===== */}
      {tab === "jobs" && (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-violet-100 p-3 ring-1 ring-violet-300">
              <div className="text-slate-800">Kategori Ayah (unik)</div>
              <div className="text-xl font-extrabold text-violet-900">
                {new Set(view.map((r) => r.ayahJob)).size}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-100 p-3 ring-1 ring-emerald-300">
              <div className="text-slate-800">Kategori Ibu (unik)</div>
              <div className="text-xl font-extrabold text-emerald-900">
                {new Set(view.map((r) => r.ibuJob)).size}
              </div>
            </div>
            <div className="rounded-lg bg-sky-100 p-3 ring-1 ring-sky-300">
              <div className="text-slate-800">Data</div>
              <div className="text-xl font-extrabold text-sky-900">{view.length}</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Pekerjaan Ayah" desc="Kategori teratas">
              <div className="flex items-center justify-end md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExpanded("jobs-ayah")}
                >
                  <Maximize2 className="h-4 w-4" /> Perbesar
                </button>
              </div>
              <div className="md:col-span-2">
                <BarChart data={distAyahJob} showPercent={showPercent} className="mt-2" />
              </div>
            </Section>

            <Section title="Pekerjaan Ibu" desc="Kategori teratas">
              <div className="flex items-center justify-end md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExpanded("jobs-ibu")}
                >
                  <Maximize2 className="h-4 w-4" /> Perbesar
                </button>
              </div>
              <div className="md:col-span-2">
                <BarChart data={distIbuJob} showPercent={showPercent} className="mt-2" />
              </div>
            </Section>

            <Section title="Gabungan (Ayah + Ibu)" desc="Kategori teratas">
              <div className="flex items-center justify-end md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setExpanded("jobs-gabungan")}
                >
                  <Maximize2 className="h-4 w-4" /> Perbesar
                </button>
              </div>
              <div className="md:col-span-2">
                <BarChart data={distGabunganJob} showPercent={showPercent} className="mt-2" />
              </div>
            </Section>
          </div>
        </>
      )}

      {/* ===== Modals (tetap center bawah saat diperbesar) ===== */}
      <Modal
        open={expanded === "income-ayah"}
        title="Distribusi Penghasilan Ayah — Perbesar"
        onClose={() => setExpanded("")}
      >
        <BarChart data={distAyahIncome} showPercent={showPercent} height={360} />
      </Modal>
      <Modal
        open={expanded === "income-ibu"}
        title="Distribusi Penghasilan Ibu — Perbesar"
        onClose={() => setExpanded("")}
      >
        <BarChart data={distIbuIncome} showPercent={showPercent} height={360} />
      </Modal>
      <Modal
        open={expanded === "income-keluarga"}
        title="Total Penghasilan Keluarga — Perbesar"
        onClose={() => setExpanded("")}
      >
        <BarChart data={distKeluargaIncome} showPercent={showPercent} height={360} />
      </Modal>

      <Modal
        open={expanded === "jobs-ayah"}
        title="Pekerjaan Ayah — Perbesar"
        onClose={() => setExpanded("")}
      >
        <BarChart data={distAyahJob} showPercent={showPercent} height={360} />
      </Modal>
      <Modal
        open={expanded === "jobs-ibu"}
        title="Pekerjaan Ibu — Perbesar"
        onClose={() => setExpanded("")}
      >
        <BarChart data={distIbuJob} showPercent={showPercent} height={360} />
      </Modal>
      <Modal
        open={expanded === "jobs-gabungan"}
        title="Pekerjaan Gabungan (Ayah+Ibu) — Perbesar"
        onClose={() => setExpanded("")}
      >
        <BarChart data={distGabunganJob} showPercent={showPercent} height={360} />
      </Modal>
    </div>
  );
}
