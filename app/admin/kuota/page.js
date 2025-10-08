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

// ⬇️ Ambil sumber opsi langsung dari JenjangPicker agar 100% sinkron
import { JENJANG_OPTIONS } from "@/app/spmb/JenjangPicker";

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

const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

export default function KuotaPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // form state
  const [form, setForm] = useState({
    label: "",
    limit: 0,
    open: true,
  });

  // pecah opsi jadi 2 grup untuk optgroup
  const sekolahOpts = useMemo(
    () => JENJANG_OPTIONS.filter((o) => !/\(S1\)/i.test(o.value)),
    []
  );
  const univOpts = useMemo(
    () => JENJANG_OPTIONS.filter((o) => /\(S1\)/i.test(o.value)),
    []
  );

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const snap = await getDocs(collection(db, "quotas"), /* @ts-ignore */ qlimit(1000));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.label.localeCompare(b.label, "id"));
      setRows(list);
    } catch (e) {
      setErr(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createOrUpdate() {
    const label = (form.label || "").trim();
    const limit = Number(form.limit) || 0;
    if (!label || limit < 0) return alert("Pilih jenjang & isi limit >= 0.");

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

      // jika belum ada -> set used:0; jika ada -> jangan sentuh used
      await setDoc(cur.exists() ? ref : ref, cur.exists() ? base : { ...base, used: 0 }, { merge: true });

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

  return (
    <div className="min-h-screen bg-white flex flex-col">      
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Kuota Pendaftaran</h1>
          <p className="text-sm text-slate-700">Atur batas pendaftar per jenjang & buka/tutup pendaftaran.</p>
        </div>

        {/* Form tambah/ubah */}
        <div className="rounded-2xl border border-slate-300 p-4 mb-6 text-black">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Dropdown jenjang */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Pilih Jenjang</label>
              <select
                value={form.label}
                onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none bg-white"
              >
                <option value="" disabled>
                  — pilih jenjang —
                </option>
                <optgroup label="Sekolah">
                  {sekolahOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Universitas">
                  {univOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="text-xs text-slate-500 mt-1">Key: {toSafeUpperSnake(form.label || " ")}</div>
            </div>

            {/* Limit */}
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

            {/* Status */}
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
            <button onClick={createOrUpdate} className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold">
              Simpan / Perbarui
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-slate-600">Memuat…</div>
        ) : err ? (
          <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 p-3">{err}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r) => {
              const remain = Math.max(0, (r.limit || 0) - (r.used || 0));
              const percent = r.limit ? Math.round(((r.used || 0) / r.limit) * 100) : 0;
              return (
                <div key={r.id} className="rounded-2xl border border-slate-300 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase text-slate-600">Jenjang</div>
                      <div className="text-base md:text-lg font-bold text-slate-900">{r.label}</div>
                      <div className="text-xs text-slate-500">Key: {r.key}</div>
                    </div>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                        r.open ? "bg-emerald-100 text-emerald-800 ring-emerald-300" : "bg-slate-100 text-slate-800 ring-slate-300",
                      ].join(" ")}
                    >
                      {r.open ? "Dibuka" : "Ditutup"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Mini label="Limit" val={r.limit || 0} />
                    <Mini label="Terpakai" val={r.used || 0} />
                    <Mini label="Sisa" val={remain} />
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-black">
                    <button
                      onClick={() => toggleOpen(r, !r.open)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      {r.open ? "Tutup Pendaftaran" : "Buka Pendaftaran"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
