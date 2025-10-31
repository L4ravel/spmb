// app/admin/whatsapp/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc,
  serverTimestamp, limit as qlimit
} from "firebase/firestore";
// ✅ gunakan HIERARCHY agar grup/jenjang dinamis & lengkap
import { HIERARCHY } from "@/app/spmb/JenjangPicker";

/* ================= Firebase init (client) ================= */
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
const toKey = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");
const isHttp = (v) => /^https?:\/\//i.test(v || "");
const isValidWa = (url) => {
  try {
    const u = new URL(url);
    return ["https:"].includes(u.protocol) && (u.hostname.endsWith("whatsapp.com") || u.hostname === "wa.me" || true);
  } catch { return false; }
};
const humanTime = (ts) => ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString("id-ID") : "—";

// normalisasi nomor Indonesia → 62xxxxxxxxxx
const normalizePhone = (raw = "") => {
  let s = String(raw).replace(/[^\d]/g, "");
  if (!s) return "";
  if (s.startsWith("0")) s = "62" + s.slice(1);
  else if (s.startsWith("8")) s = "62" + s;
  return s;
};
const toWaChatLink = (value = "") => {
  if (!value) return "";
  if (isHttp(value)) return value.trim();
  const num = normalizePhone(value);
  return num ? `https://wa.me/${num}` : "";
};

/* ================== Jenjang dinamis (sinkron JenjangPicker) ================== */
// kunci top-level yang tersedia
const TOP_KEYS_AVAILABLE = Object.keys(HIERARCHY || {});
// preferensi urutan jika ada
const PREFERRED = ["REGULER", "LKSA", "MA'HAD ALY", "STIT / MA'HAD ALY", "STIT", "STAI"];
const TOP_ORDER = [
  ...PREFERRED.filter((k) => TOP_KEYS_AVAILABLE.includes(k)),
  ...TOP_KEYS_AVAILABLE.filter((k) => !PREFERRED.includes(k)),
];

// temukan kunci grup yang cocok
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

// daftar label jenjang lengkap (untuk sorting resmi)
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
const byOfficialOrder = (aLabel, bLabel) => {
  const ia = ORDER_INDEX.has(aLabel) ? ORDER_INDEX.get(aLabel) : Infinity;
  const ib = ORDER_INDEX.has(bLabel) ? ORDER_INDEX.get(bLabel) : Infinity;
  if (ia !== ib) return ia - ib;
  return (aLabel || "").localeCompare(bLabel || "", "id");
};

// opsi per grup (optgroup)
const sekolahOpts = REG_KEY ? (HIERARCHY[REG_KEY] || []).flatMap((p) => p.values) : [];
const lksaOpts    = LKSA_KEY ? (HIERARCHY[LKSA_KEY] || []).flatMap((p) => p.values) : [];
const mahadOpts   = MAHAD_KEY ? (HIERARCHY[MAHAD_KEY] || []).flatMap((p) => p.values) : [];

// label optgroup ramah
const labelReg   = REG_KEY ? "Sekolah (Reguler/Lainnya)" : null;
const labelLksa  = LKSA_KEY ? "LKSA / PPS" : null;
const labelMahad = MAHAD_KEY && MAHAD_KEY.toUpperCase().includes("STIT")
  ? "STIT / Ma'had Aly"
  : (MAHAD_KEY ? "Ma'had Aly" : null);

/* ================== Page ================== */
export default function WhatsapPage() {
  const [level, setLevel] = useState("");
  const [link, setLink] = useState("");
  const [privateVal, setPrivateVal] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  // muat data
  async function load() {
    setLoading(true); setErr("");
    try {
      const snap = await getDocs(collection(db, "wa_groups"), qlimit(1000));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ✅ sort pakai urutan resmi dari JenjangPicker
      list.sort((a, b) => byOfficialOrder(a.label, b.label));
      setRows(list);
    } catch (e) {
      setErr(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const label = (level || "").trim();
    if (!label) return alert("Pilih jenjang terlebih dahulu.");
    if (!ORDER_INDEX.has(label)) return alert("Label jenjang tidak dikenal. Pilih dari daftar.");

    const hasGroup = !!(link && link.trim());
    const hasPrivate = !!(privateVal && privateVal.trim());
    if (!hasGroup && !hasPrivate) {
      return alert("Isi minimal salah satu: Link Grup atau Nomor/Link Chat Private.");
    }
    if (hasGroup && !isValidWa(link)) {
      return alert("Masukkan link Grup WhatsApp yang valid (https).");
    }

    const key = toKey(label);
    const ref = doc(db, "wa_groups", key);

    const privateLink = toWaChatLink(privateVal);
    try {
      await setDoc(
        ref,
        {
          key,
          label,
          ...(hasGroup ? { link: link.trim() } : { link: "" }),
          private: (privateVal || "").trim(),
          privateLink,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setLink(""); setPrivateVal(""); setLevel("");
      await load();
    } catch (e) {
      alert("Gagal menyimpan: " + e.message);
    }
  }

  async function removeRow(row) {
    if (!confirm(`Hapus konfigurasi WA untuk "${row.label}"?`)) return;
    try { await deleteDoc(doc(db, "wa_groups", row.id)); await load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="text-black">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">WhatsApp per Jenjang</h1>
          <p className="text-sm text-slate-700">
            Daftar jenjang & urutan mengikuti <b>JenjangPicker</b> secara dinamis (termasuk STIT/Ma'had Aly).
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={[
              "px-3 py-2 text-sm font-semibold transition-colors",
              viewMode === "grid" ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
            ].join(" ")}
            title="Tampilan Grid"
          >
            ⊞ Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={[
              "px-3 py-2 text-sm font-semibold transition-colors border-l border-slate-300",
              viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
            ].join(" ")}
            title="Tampilan Tabel"
          >
            ≡ Tabel
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-slate-300 p-4 mb-6 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Pilih Jenjang</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 bg-white outline-none"
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
            <div className="text-xs text-slate-500 mt-1">Key: {toKey(level || " ")}</div>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Link Grup WhatsApp</label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/xxxxx"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
            />
            <div className="text-xs text-slate-500 mt-1">Contoh: https://chat.whatsapp.com/…</div>
          </div>

          <div className="md:col-span-4">
            <label className="text-sm font-medium text-slate-700">Nomor/Link Chat Private (opsional)</label>
            <input
              type="text"
              placeholder="contoh: 0812xxxxxx atau https://wa.me/62812xxxxxx"
              value={privateVal}
              onChange={(e) => setPrivateVal(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
            />
            <div className="text-xs text-slate-500 mt-1">
              Jika isi nomor, otomatis disimpan sebagai tautan <code>wa.me</code> (contoh 0812… → 62812…).
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={save}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold hover:bg-indigo-700 transition-colors"
          >
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
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((r) => {
                const chatLink = r.privateLink || toWaChatLink(r.private || "");
                return (
                  <div key={r.id} className="rounded-2xl border border-slate-300 p-4 bg-white shadow-sm">
                    <div className="text-xs uppercase text-slate-600">Jenjang</div>
                    <div className="text-base md:text-lg font-bold text-slate-900">{r.label}</div>
                    <div className="text-xs text-slate-500">Key: {r.key}</div>

                    <div className="mt-3 space-y-2">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 break-all">
                        <span className="text-xs text-slate-600">Link Grup:</span>
                        <div className="text-sm font-medium text-slate-900">{r.link || "—"}</div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 break-all">
                        <span className="text-xs text-slate-600">Chat Private:</span>
                        <div className="text-sm font-medium text-slate-900">{r.private || chatLink || "—"}</div>
                      </div>
                    </div>

                    <div className="mt-3 h-8 flex items-center text-xs text-slate-500">
                      Terakhir diperbarui: {humanTime(r.updatedAt)}
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <a
                        href={r.link || "#"} target="_blank" rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        onClick={(e) => { if (!r.link) e.preventDefault(); }}
                      >
                        Buka Grup
                      </a>

                      <button
                        className="ml-auto rounded-lg border border-rose-300 text-rose-700 px-3 py-1.5 text-sm hover:bg-rose-50 transition-colors"
                        onClick={() => removeRow(r)}
                      >
                        Hapus
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
                      <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Link Grup WhatsApp</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Chat Private</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Terakhir Update</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-slate-900">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-slate-700">
                          Tidak ada data WhatsApp.
                        </td>
                      </tr>
                    ) : (
                      rows
                        .sort((a, b) => byOfficialOrder(a.label, b.label))
                        .map((r, idx) => {
                          const chatLink = r.privateLink || toWaChatLink(r.private || "");
                          return (
                            <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-slate-700">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                              </td>
                              <td className="px-4 py-3">
                                <code className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{r.key}</code>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-slate-900 break-all max-w-xs">{r.link || "—"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-slate-900 break-all max-w-xs">{r.private || chatLink || "—"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs text-slate-600">{humanTime(r.updatedAt)}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <a
                                    href={r.link || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={[
                                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                      r.link
                                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-1 ring-emerald-300"
                                        : "bg-slate-100 text-slate-400 cursor-not-allowed ring-1 ring-slate-300",
                                    ].join(" ")}
                                    onClick={(e) => { if (!r.link) e.preventDefault(); }}
                                  >
                                    Buka Grup
                                  </a>
                                  <button
                                    className="rounded-lg bg-rose-100 text-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-200 transition-colors ring-1 ring-rose-300"
                                    onClick={() => removeRow(r)}
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
