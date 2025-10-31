// app/admin/kuota/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
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

// >>> Sinkron dengan JenjangPicker
import { HIERARCHY } from "@/app/spmb/JenjangPicker";

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

/** Susun urutan resmi berdasarkan kunci yang BENAR-BENAR ada di JenjangPicker */
const TOP_KEYS_AVAILABLE = Object.keys(HIERARCHY || {});
// preferensi urutan jika tersedia:
const PREFERRED = ["REGULER", "LKSA", "MA'HAD ALY", "STIT / MA'HAD ALY", "STIT", "STAI"];
const TOP_ORDER = [
  // kunci preferen yang ada
  ...PREFERRED.filter((k) => TOP_KEYS_AVAILABLE.includes(k)),
  // sisa kunci lain yang belum tercakup
  ...TOP_KEYS_AVAILABLE.filter((k) => !PREFERRED.includes(k)),
];

/** Temukan kunci grup yang cocok untuk Reguler / LKSA / Ma'had Aly/STIT */
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

// builder daftar label jenjang lengkap untuk sorting
function buildOrderedLabelList() {
  const ordered = [];
  for (const top of TOP_ORDER) {
    const parents = HIERARCHY[top] || [];
    for (const p of parents) {
      for (const v of p.values) {
        ordered.push(v.value); // sudah nama lengkap (mis. "SD Putra")
      }
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

// Ambil opsi <option> untuk setiap optgroup secara aman (dinamis)
const sekolahOpts = REG_KEY ? (HIERARCHY[REG_KEY] || []).flatMap((p) => p.values) : [];
const lksaOpts = LKSA_KEY ? (HIERARCHY[LKSA_KEY] || []).flatMap((p) => p.values) : [];
const mahadOpts = MAHAD_KEY ? (HIERARCHY[MAHAD_KEY] || []).flatMap((p) => p.values) : [];

// Label optgroup ramah
const labelReg = REG_KEY ? "Reguler" : null;
const labelLksa = LKSA_KEY ? "LKSA" : null;
const labelMahad =
  MAHAD_KEY && MAHAD_KEY.toUpperCase().includes("STIT") ? "STIT / Ma'had Aly" : (MAHAD_KEY ? "Ma'had Aly" : null);

export default function KuotaPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  const [form, setForm] = useState({
    label: "",
    limit: 0,
    open: true,
  });

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
        existingIds.add(u.id);
        const lvl = (u.data()?.registrationLevel || "").trim();
        if (lvl) countByLevel.set(lvl, (countByLevel.get(lvl) || 0) + 1);
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

  const totalLimit = rows.reduce((s, r) => s + (Number(r.limit) || 0), 0);
  const totalUsedValidated = rows.reduce((s, r) => s + (Number(r.usedValidated) || 0), 0);
  const totalRemain = rows.reduce(
    (s, r) => s + Math.max(0, (Number(r.limit) || 0) - (Number(r.usedValidated) || 0)),
    0
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Kuota Pendaftaran</h1>
            <p className="text-sm text-slate-700">
              Pilihan jenjang mengikuti <b>JenjangPicker</b> secara dinamis. Jika kamu ubah daftar di JenjangPicker, halaman ini ikut menyesuaikan.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={[
                "px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "grid" ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
              ].join(" ")}
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={[
                "px-3 py-2 text-sm font-semibold transition-colors border-l border-slate-300",
                viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
              ].join(" ")}
            >
              ≡ Tabel
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-slate-300 p-4 mb-6 text-black bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Pilih Jenjang</label>
              <select
                value={form.label}
                onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none bg-white"
              >
                <option value="" disabled>— pilih jenjang —</option>

                {REG_KEY && (
                  <optgroup label={labelReg}>
                    {sekolahOpts.map((o) => (
                      <option key={o.value} value={o.value}>{o.value}</option>
                    ))}
                  </optgroup>
                )}

                {LKSA_KEY && (
                  <optgroup label={labelLksa}>
                    {lksaOpts.map((o) => (
                      <option key={o.value} value={o.value}>{o.value}</option>
                    ))}
                  </optgroup>
                )}

                {MAHAD_KEY && (
                  <optgroup label={labelMahad}>
                    {mahadOpts.map((o) => (
                      <option key={o.value} value={o.value}>{o.value}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="text-xs text-slate-500 mt-1">Key: {toSafeUpperSnake(form.label || " ")}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Limit</label>
              <input
                type="number"
                min={0}
                value={form.limit}
                onChange={(e) => setForm((s) => ({ ...s, limit: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.open ? "open" : "closed"}
                onChange={(e) => setForm((s) => ({ ...s, open: e.target.value === "open" }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none bg-white"
              >
                <option value="open">Dibuka</option>
                <option value="closed">Ditutup</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={createOrUpdate}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold hover:bg-indigo-700 transition-colors"
            >
              Simpan / Perbarui
            </button>
          </div>
        </div>

        {/* List Kuota */}
        {loading ? (
          <div className="text-slate-600">Memuat…</div>
        ) : err ? (
          <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 p-3">{err}</div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((r) => {
                  const used = Number(r.usedValidated || 0);
                  const limit = Number(r.limit || 0);
                  const remain = Math.max(0, limit - used);
                  const percent = limit ? Math.round((used / limit) * 100) : 0;
                  return (
                    <div key={r.id} className="rounded-2xl border border-slate-300 p-4 bg-white shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs uppercase text-slate-600">Jenjang</div>
                          <div className="text-base md:text-lg font-bold text-slate-900">{r.label}</div>
                          <div className="text-xs text-slate-500">Key: {r.key}</div>
                        </div>
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                            r.open
                              ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                              : "bg-slate-100 text-slate-800 ring-slate-300",
                          ].join(" ")}
                        >
                          {r.open ? "Dibuka" : "Ditutup"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Mini label="Limit" val={limit} />
                        <Mini label="Terpakai" val={used} />
                        <Mini label="Sisa" val={remain} />
                      </div>

                      <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
                      </div>

                      <div className="mt-3 flex items-center justify-between text-black">
                        <button
                          onClick={() => toggleOpen(r, !r.open)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
                        >
                          {r.open ? "Tutup Pendaftaran" : "Buka Pendaftaran"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">No</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Jenjang</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Key</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Limit</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Terpakai</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Sisa</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">% Terpakai</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Progress</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="px-4 py-8 text-center text-slate-700">Tidak ada data kuota.</td>
                        </tr>
                      ) : (
                        rows.map((r, idx) => {
                          const used = Number(r.usedValidated || 0);
                          const limit = Number(r.limit || 0);
                          const remain = Math.max(0, limit - used);
                          const percent = limit ? Math.round((used / limit) * 100) : 0;
                          return (
                            <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-slate-700">{idx + 1}</td>
                              <td className="px-4 py-3"><div className="text-sm font-semibold text-slate-900">{r.label}</div></td>
                              <td className="px-4 py-3">
                                <code className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{r.key}</code>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                                    r.open
                                      ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                                      : "bg-slate-100 text-slate-800 ring-slate-300",
                                  ].join(" ")}
                                >
                                  {r.open ? "Dibuka" : "Ditutup"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{human(limit)}</td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700">{human(used)}</td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{human(remain)}</td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{percent}%</td>
                              <td className="px-4 py-3">
                                <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                                  <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => toggleOpen(r, !r.open)}
                                  className={[
                                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                    r.open
                                      ? "bg-slate-100 text-slate-800 hover:bg-slate-200 ring-1 ring-slate-300"
                                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 ring-1 ring-emerald-300",
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
                      <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                        <td colSpan="4" className="px-4 py-3 text-sm text-slate-900">TOTAL</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">{human(totalLimit)}</td>
                        <td className="px-4 py-3 text-right text-sm text-indigo-700">{human(totalUsedValidated)}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">{human(totalRemain)}</td>
                        <td colSpan="3" className="px-4 py-3"></td>
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

function Mini({ label, val }) {
  return (
    <div className="rounded-lg border border-slate-300 p-3 text-center">
      <div className="text-[11px] font-medium text-slate-700">{label}</div>
      <div className="text-xl font-extrabold text-slate-900">
        {new Intl.NumberFormat("id-ID").format(val)}
      </div>
    </div>
  );
}
