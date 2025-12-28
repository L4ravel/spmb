// app/admin/kuota/page.js
"use client";

import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  limit as qlimit,
} from "firebase/firestore";

import { HIERARCHY } from "@/app/spmb/JenjangPicker";
import { Users, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

/* ========= Firebase init ========= */
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

/* ========= Helpers ========= */
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

const TOP_KEYS_AVAILABLE = Object.keys(HIERARCHY || {});
const PREFERRED = ["REGULER", "LKSA", "MA'HAD ALY", "STIT / MA'HAD ALY", "STIT", "STAI"];
const TOP_ORDER = [
  ...PREFERRED.filter((k) => TOP_KEYS_AVAILABLE.includes(k)),
  ...TOP_KEYS_AVAILABLE.filter((k) => !PREFERRED.includes(k)),
];

const REG_KEY =
  TOP_ORDER.find((k) => k.toUpperCase().includes("REGULER")) || TOP_ORDER[0] || null;
const LKSA_KEY =
  TOP_ORDER.find((k) => k.toUpperCase().includes("LKSA")) ||
  TOP_ORDER.find((k) => k.toUpperCase().includes("PPS")) ||
  null;
const MAHAD_KEY =
  TOP_ORDER.find((k) => k.toUpperCase().includes("MA'HAD ALY")) ||
  TOP_ORDER.find((k) => k.toUpperCase().includes("STIT")) ||
  TOP_ORDER.find((k) => k.toUpperCase().includes("ALY")) ||
  null;

function buildOrderedLabelList() {
  const ordered = [];
  for (const top of TOP_ORDER) {
    const parents = HIERARCHY[top] || [];
    for (const p of parents) {
      for (const v of p.values) ordered.push(v.value);
    }
  }
  return ordered;
}
const ORDERED_LABELS = buildOrderedLabelList();
const ORDER_INDEX = new Map(ORDERED_LABELS.map((lab, i) => [lab, i]));

function compareByOfficialOrder(aLabel, bLabel) {
  const ia = ORDER_INDEX.has(aLabel) ? ORDER_INDEX.get(aLabel) : Infinity;
  const ib = ORDER_INDEX.has(bLabel) ? ORDER_INDEX.get(bLabel) : Infinity;
  if (ia !== ib) return ia - ib;
  return (aLabel || "").localeCompare(bLabel || "", "id");
}

export default function KuotaPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [form, setForm] = useState({ label: "", limit: 0, open: true });

  

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [quotaSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "quotas"), qlimit(1000)),
        getDocs(collection(db, "users_app"), qlimit(5000)),
      ]);

      const existingIds = new Set();
      const countByLevel = new Map();
     usersSnap.forEach((u) => {
  const data = u.data();
  const lvl = (data?.registrationLevel || "").trim();
  const decision = data?.finalDecision;

  if (lvl && decision === "LULUS") {
    countByLevel.set(lvl, (countByLevel.get(lvl) || 0) + 1);
  }
});

      const list = quotaSnap.docs.map((d) => {
        const q = { id: d.id, ...d.data() };
        const label = (q.label ?? "").trim();

        let usedValidated = 0;
        if (Array.isArray(q.assignedUsernames)) {
          usedValidated = q.assignedUsernames.filter((u) =>
            existingIds.has(String(u))
          ).length;
        } else if (q.usedBy && typeof q.usedBy === "object") {
          usedValidated = Object.keys(q.usedBy).filter((u) =>
            existingIds.has(String(u))
          ).length;
        } else if (label) {
          usedValidated = Number(countByLevel.get(label) || 0);
        }

        return { ...q, usedValidated };
      });

      list.sort((a, b) => compareByOfficialOrder(a.label, b.label));
      setRows(list);
    } catch (e) {
      setErr(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createOrUpdate() {
    const label = (form.label || "").trim();
    const limit = Number(form.limit) || 0;
    if (!label || limit < 0) return alert("Pilih jenjang & isi limit >= 0.");
    if (!ORDER_INDEX.has(label)) return alert("Label jenjang tidak dikenal. Pilih dari daftar.");

    const key = toSafeUpperSnake(label);
    const ref = doc(db, "quotas", key);

    try {
      const cur = await getDoc(ref);
      const base = {
        key,
        label,
        limit,
        open: !!form.open,
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, cur.exists() ? base : { ...base, used: 0 }, { merge: true });

      setForm({ label: "", limit: 0, open: true });
      await load();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
  }

  async function toggleOpen(row, val) {
    try {
      await updateDoc(doc(db, "quotas", row.id), {
        open: !!val,
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  const human = (n) => new Intl.NumberFormat("id-ID").format(n);

  // Warna progress per-kartu
  const getColorScheme = (percent) => {
    if (percent > 110) {
      return {
        border: "border-red-500",
        hoverBorder: "hover:border-red-600",
        gradient: "from-red-50",
        iconBg: "bg-red-100",
        iconBgHover: "group-hover:bg-red-500",
        iconColor: "text-red-600",
        iconColorHover: "group-hover:text-white",
        bar: "bg-red-500",
        barHover: "group-hover:bg-red-600",
        text: "text-red-700",
        icon: AlertTriangle,
        status: "Melebihi Kuota"
      };
    } else if (percent >= 90 && percent <= 110) {
      return {
        border: "border-yellow-500",
        hoverBorder: "hover:border-yellow-600",
        gradient: "from-yellow-50",
        iconBg: "bg-yellow-100",
        iconBgHover: "group-hover:bg-yellow-500",
        iconColor: "text-yellow-600",
        iconColorHover: "group-hover:text-white",
        bar: "bg-yellow-500",
        barHover: "group-hover:bg-yellow-600",
        text: "text-yellow-700",
        icon: CheckCircle,
        status: "Target"
      };
    } else {
      return {
        border: "border-green-500",
        hoverBorder: "hover:border-green-600",
        gradient: "from-green-50",
        iconBg: "bg-green-100",
        iconBgHover: "group-hover:bg-green-500",
        iconColor: "text-green-600",
        iconColorHover: "group-hover:text-white",
        bar: "bg-green-500",
        barHover: "group-hover:bg-green-600",
        text: "text-green-700",
        icon: TrendingUp,
        status: "Proses"
      };
    }
  };

  

  // Aggregates
  const totalLimit = rows.reduce((s, r) => s + (Number(r.limit) || 0), 0);
const totalUsedValidated = rows.reduce((s, r) => s + (Number(r.usedValidated) || 0), 0);
const totalExcess = rows.reduce(
  (s, r) => s + Math.max(0, (Number(r.usedValidated) || 0) - (Number(r.limit) || 0)),
  0
);

// hitung persen dulu
const percentOverall =
  totalLimit > 0
    ? Math.round((totalUsedValidated / totalLimit) * 100)
    : (totalUsedValidated > 0 ? 100 : 0);

// lalu clamp ke 0–100 untuk donut
const pct = Math.min(100, Math.max(0, percentOverall));

  return (
    <div className="min-h-screen bg-white">
      <main className="w-full px-4 md:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
              Monitoring Pendaftaran
            </h1>            
          </div>
          <div className="flex rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setViewMode("grid")}
              className={[
                "px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                viewMode === "grid" 
                  ? "bg-slate-900 text-white shadow-inner" 
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={[
                "px-4 py-2.5 text-sm font-semibold transition-all duration-200 border-l-2 border-slate-300",
                viewMode === "table" 
                  ? "bg-slate-900 text-white shadow-inner" 
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              ≡ Tabel
            </button>
          </div>
        </div>

        {/* Summary Cards (dengan persentase total) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {/* Total Kuota */}
          <div className="bg-slate-50 rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <p className="text-xs text-slate-600 font-medium">Target Kuota</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{human(totalLimit)}</p>
            <p className="text-[11px] text-slate-600 mt-1">Target keseluruhan (100%)</p>
          </div>

          <div className="relative overflow-hidden rounded-lg border-l-4 border-indigo-500 bg-slate-50 p-4 shadow-sm">
  <p className="text-xs font-medium text-slate-600">Lulus</p>

  <div className="mt-1 flex items-center justify-between gap-3">
    {/* Kiri: jumlah lulus + badge % di sampingnya */}
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl md:text-3xl font-extrabold text-indigo-700">
          {new Intl.NumberFormat("id-ID").format(totalUsedValidated)}
        </span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
          {pct}%
        </span>
      </div>

      {/* badge kecil “X dari Y” */}
      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
        {new Intl.NumberFormat("id-ID").format(totalUsedValidated)} dari {new Intl.NumberFormat("id-ID").format(totalLimit)}
      </span>
    </div>

    {/* Kanan: donut progress lebih menonjol + glow */}
    <div className="relative h-20 w-20 md:h-24 md:w-24 shrink-0">
      {/* glow belakang */}
      <div className="absolute inset-0 rounded-full blur-xl opacity-20 bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500" />
      {/* ring donut */}
      <div
        className="relative h-full w-full rounded-full shadow-lg"
        style={{ background: `conic-gradient(#5b21b6 ${pct}%, #e5e7eb 0)` }}
        aria-label={`Terpakai ${pct} persen dari total kuota`}
        role="img"
      >
        <div className="absolute inset-[12%] rounded-full bg-slate-50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-extrabold text-slate-800">{pct}%</span>
        </div>
      </div>
    </div>
  </div>

  {/* Aksen bar di bawah */}
  <div className="mt-3">
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600"
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
</div>

          {/* Melebihi */}
          <div className="bg-slate-50 rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
            <p className="text-xs text-slate-600 font-medium">Melebihi</p>
            <p className="text-2xl font-bold text-purple-700 mt-0.5">{human(totalExcess)}</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Lulus di atas kuota
            </p>
          </div>
        </div>

        {/* Form Tambah/Update Kuota */}
        <div className="bg-slate-50 rounded-lg shadow-sm border border-slate-200 p-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Tambah / Update Kuota</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenjang</label>
              <select
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full text-black rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">-- Pilih Jenjang --</option>
                {ORDERED_LABELS.map((lab) => (
                  <option key={lab} value={lab}>{lab}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Limit Kuota</label>
              <input
                type="number"
                min="0"
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
                className="w-full text-black rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={form.open ? "true" : "false"}
                onChange={(e) => setForm({ ...form, open: e.target.value === "true" })}
                className="w-full text-black rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="true">Dibuka</option>
                <option value="false">Ditutup</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={createOrUpdate}
                className="w-full rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-700 transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>

        {/* GRID VIEW */}
        {viewMode === "grid" ? (
          loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900"></div>
              <p className="text-slate-600 mt-4">Memuat data...</p>
            </div>
          ) : err ? (
            <div className="rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-800 p-5 shadow-md">
              <p className="font-semibold">Error:</p>
              <p>{err}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {rows.map((r) => {
                const used = Number(r.usedValidated || 0);
                const limit = Number(r.limit || 0);
                const excess = Math.max(0, used - limit);
                const percent = limit ? Math.round((used / limit) * 100) : (used > 0 ? 100 : 0);
                
                const colors = getColorScheme(percent);
                const StatusIcon = colors.icon;

                return (
                  <div
                    key={r.id}
                    className={`group bg-slate-50 rounded-lg shadow-sm hover:shadow-md p-3 border-l-4 ${colors.border} ${colors.hoverBorder} transition-all duration-300 hover:scale-[1.01] relative overflow-hidden`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.iconBg} ${colors.iconBgHover} transition-all duration-300 group-hover:scale-110 shadow-sm flex-shrink-0`}>
                            <StatusIcon className={`${colors.iconColor} ${colors.iconColorHover} transition-colors duration-300`} size={18} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 leading-tight truncate">
                              {r.label}
                            </h3>
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${colors.text} bg-opacity-20 ${colors.iconBg}`}>
                              {colors.status}
                            </span>
                          </div>
                        </div>
                        <span
                          className={[
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1",
                            r.open
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                              : "bg-slate-100 text-slate-700 ring-slate-300",
                          ].join(" ")}
                        >
                          {r.open ? "●" : "○"}
                        </span>
                      </div>

                      {/* Main Stats */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Lulus / Target</p>
                          <div className="flex items-baseline gap-1">
                            <p className="text-xl font-black text-slate-900">{human(used)}</p>
                            <p className="text-xs text-slate-500 font-medium">/ {human(limit)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Melebihi</p>
                          <p className={`text-xl font-bold ${excess > 0 ? colors.text : 'text-slate-400'}`}>
                            {human(excess)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Progress</p>
                          <p className={`text-xl font-bold ${colors.text}`}>{percent}%</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className={`h-2 rounded-full transition-all duration-700 ease-out ${colors.bar} ${colors.barHover} shadow-sm`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => toggleOpen(r, !r.open)}
                          className="rounded-md text-black border border-slate-300 px-2.5 py-1 text-[10px] font-semibold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-200"
                        >
                          {r.open ? "Tutup" : "Buka"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {/* TABLE VIEW (tetap) */}
        {viewMode === "table" && (
          loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900"></div>
              <p className="text-slate-600 mt-4">Memuat data...</p>
            </div>
          ) : err ? (
            <div className="rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-800 p-5 shadow-md">
              <p className="font-semibold">Error:</p>
              <p>{err}</p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-4 py-4 text-left text-sm font-bold">No</th>
                      <th className="px-4 py-4 text-left text-sm font-bold">Jenjang</th>
                      <th className="px-4 py-4 text-left text-sm font-bold">Key</th>
                      <th className="px-4 py-4 text-center text-sm font-bold">Status</th>
                      <th className="px-4 py-4 text-right text-sm font-bold">Limit</th>
                      <th className="px-4 py-4 text-right text-sm font-bold">Lulus</th>
                      <th className="px-4 py-4 text-right text-sm font-bold">Melebihi</th>
                      <th className="px-4 py-4 text-right text-sm font-bold">% Persentase</th>
                      <th className="px-4 py-4 text-left text-sm font-bold">Progress</th>
                      <th className="px-4 py-4 text-center text-sm font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-600">
                          Tidak ada data kuota.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, idx) => {
                        const used = Number(r.usedValidated || 0);
                        const limit = Number(r.limit || 0);
                        const excess = Math.max(0, used - limit);
                        const percent = limit ? Math.round((used / limit) * 100) : (used > 0 ? 100 : 0);
                        const colors = getColorScheme(percent);

                        return (
                          <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 text-sm text-slate-700 font-medium">{idx + 1}</td>
                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                            </td>
                            <td className="px-4 py-4">
                              <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded font-mono">
                                {r.key}
                              </code>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-2",
                                  r.open
                                    ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                                    : "bg-slate-100 text-slate-700 ring-slate-300",
                                ].join(" ")}
                              >
                                {r.open ? "Dibuka" : "Ditutup"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {human(limit)}
                            </td>
                            <td className="px-4 py-4 text-right text-sm font-semibold text-indigo-700">
                              {human(used)}
                            </td>
                            <td className={`px-4 py-4 text-right text-sm font-semibold ${colors.text}`}>
                              {human(excess)}
                            </td>
                            <td className={`px-4 py-4 text-right text-sm font-bold ${colors.text}`}>
                              {percent}%
                            </td>
                            <td className="px-4 py-4">
                              <div className="w-32 h-3 rounded-full bg-slate-200 overflow-hidden shadow-inner">
                                <div 
                                  className={`h-3 rounded-full transition-all duration-500 ${colors.bar}`}
                                  style={{ width: `${Math.min(percent, 100)}%` }} 
                                />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => toggleOpen(r, !r.open)}
                                className={[
                                  "rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ring-2",
                                  r.open
                                    ? "bg-slate-100 text-slate-800 hover:bg-slate-200 ring-slate-300"
                                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 ring-emerald-300",
                                ].join(" ")}
                              >
                                {r.open ? "Tutup" : "Buka"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold">
                      <td colSpan={4} className="px-4 py-4 text-sm">TOTAL</td>
                      <td className="px-4 py-4 text-right text-sm">{human(totalLimit)}</td>
                      <td className="px-4 py-4 text-right text-sm text-indigo-300">{human(totalUsedValidated)}</td>
                      <td className="px-4 py-4 text-right text-sm text-purple-300">{human(totalExcess)}</td>
                      <td className="px-4 py-4 text-right text-sm">{percentOverall}%</td>
                      <td colSpan={2} className="px-4 py-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
