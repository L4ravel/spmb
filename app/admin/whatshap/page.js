'use client';

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc,
  serverTimestamp, limit as qlimit
} from "firebase/firestore";
import { JENJANG_OPTIONS } from "@/app/spmb/JenjangPicker";

/* Firebase init (client) */
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

/* Utils */
const toKey = (s) => (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");
const isValidWa = (url) => {
  try {
    const u = new URL(url);
    return ["https:"].includes(u.protocol) && (u.hostname.endsWith("whatsapp.com") || u.hostname === "wa.me" || true);
  } catch { return false; }
};
const humanTime = (ts) => ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString("id-ID") : "—";

/* Page */
export default function WhatsapPage() {
  const [level, setLevel] = useState("");
  const [link, setLink] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const sekolahOpts = useMemo(() => JENJANG_OPTIONS.filter((o) => !/\(S1\)/i.test(o.value)), []);
  const univOpts = useMemo(() => JENJANG_OPTIONS.filter((o) => /\(S1\)/i.test(o.value)), []);

  async function load() {
    setLoading(true); setErr("");
    try {
      const snap = await getDocs(collection(db, "wa_groups"), /* @ts-ignore */ qlimit(1000));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.label.localeCompare(b.label, "id"));
      setRows(list);
    } catch (e) { setErr(e?.message || "Gagal memuat data"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const label = (level || "").trim();
    if (!label) return alert("Pilih jenjang terlebih dahulu.");
    if (!link || !isValidWa(link)) return alert("Masukkan link WhatsApp yang valid (https).");
    const key = toKey(label);
    const ref = doc(db, "wa_groups", key);
    try {
      await setDoc(ref, { key, label, link: link.trim(), updatedAt: serverTimestamp() }, { merge: true });
      setLink(""); setLevel(""); await load();
    } catch (e) { alert("Gagal menyimpan: " + e.message); }
  }
  async function removeRow(row) {
    if (!confirm(`Hapus link WA untuk "${row.label}"?`)) return;
    try { await deleteDoc(doc(db, "wa_groups", row.id)); await load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="text-black">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Grup WhatsApp per Jenjang</h1>
        <p className="text-sm text-slate-700">
          Tentukan link grup WA untuk setiap <b>registrationLevel</b>. Peserta akan diarahkan sesuai jenjangnya.
        </p>
      </div>

      {/* form */}
      <div className="rounded-2xl border border-slate-300 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Pilih Jenjang</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 bg-white">
              <option value="" disabled>— pilih jenjang —</option>
              <optgroup label="Sekolah">{sekolahOpts.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</optgroup>
              <optgroup label="Universitas">{univOpts.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</optgroup>
            </select>
            <div className="text-xs text-slate-500 mt-1">Key: {toKey(level || " ")}</div>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Link Grup WhatsApp</label>
            <input type="url" placeholder="https://chat.whatsapp.com/xxxxx  atau  https://wa.me/62812xxxx?text=…"
              value={link} onChange={(e) => setLink(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button onClick={save} className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold">Simpan / Perbarui</button>
        </div>
      </div>

      {/* list */}
      {loading ? (
        <div className="text-slate-600">Memuat…</div>
      ) : err ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 p-3">{err}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-300 p-4">
              <div className="text-xs uppercase text-slate-600">Jenjang</div>
              <div className="text-base md:text-lg font-bold text-slate-900">{r.label}</div>
              <div className="text-xs text-slate-500">Key: {r.key}</div>

              <div className="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-200 break-all">
                <span className="text-xs text-slate-600">Link:</span>
                <div className="text-sm font-medium text-slate-900">{r.link || "—"}</div>
              </div>

              <div className="mt-3 h-8 flex items-center text-xs text-slate-500">
                Terakhir diperbarui: {humanTime(r.updatedAt)}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <a href={r.link || "#"} target="_blank" rel="noreferrer"
                   className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                   onClick={(e) => { if (!r.link) e.preventDefault(); }}>
                  Buka
                </a>
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        onClick={async () => { try { await navigator.clipboard.writeText(r.link || ""); alert("Link disalin."); } catch { alert("Tidak bisa menyalin."); }}}>
                  Salin
                </button>
                <button className="ml-auto rounded-lg border border-rose-300 text-rose-700 px-3 py-1.5 text-sm hover:bg-rose-50"
                        onClick={() => removeRow(r)}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
