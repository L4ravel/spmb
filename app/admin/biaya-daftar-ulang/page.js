"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, RefreshCw, Save, X, Plus, Wallet, FileText, Sparkles, AlertTriangle } from "lucide-react";
import JenjangPicker, { JENJANG_OPTIONS } from "@/app/spmb/JenjangPicker";
import ExcelImport, { toIDR, safeNum } from "./excel";

async function apiGet() {
  const r = await fetch("/api/re_registration_fees", { cache: "no-store" });
  if (!r.ok) throw new Error("Gagal memuat data");
  return r.json();
}
async function apiPost(payload) {
  const r = await fetch("/api/re_registration_fees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error || "Gagal menyimpan");
  }
  return r.json();
}

const BP_FIELDS = [
  { key: "pakaian", label: "Pakaian" },
  { key: "sarpras", label: "Sarpras" },
  { key: "kasur", label: "Kasur" },
  { key: "kitab", label: "Kitab" },
  { key: "bp3", label: "BP3" },
];

// 🔁 Satu sumber kebenaran: daftar jenjang valid
const VALID_JENJANG = new Set(
  (JENJANG_OPTIONS || []).map((x) => String(x?.value || "").trim()).filter(Boolean)
);

function StatCard({ label, value, Icon }) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-none">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-700 uppercase">{label}</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
        </div>
        {Icon && <Icon className="h-6 w-6 text-slate-500" />}
      </div>
    </div>
  );
}

export default function PageBiayaDaftarUlang() {
  const [jenjang, setJenjang] = useState("");
  const [spp, setSpp] = useState("");
  const [bp, setBp] = useState({ pakaian: "", sarpras: "", kasur: "", kitab: "", bp3: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const totalUangPangkal = useMemo(
    () => safeNum(bp.pakaian) + safeNum(bp.sarpras) + safeNum(bp.kasur) + safeNum(bp.kitab) + safeNum(bp.bp3),
    [bp]
  );
  const grandTotal = useMemo(() => totalUangPangkal + safeNum(spp), [totalUangPangkal, spp]);

  async function loadItems() {
    try {
      setLoading(true);
      const res = await apiGet();
      if (res?.success) setRows(res.items || []);
    } catch (e) {
      alert(e.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadItems();
  }, []);

  // Helper: cek validitas jenjang
  const isJenjangValid = (val) => VALID_JENJANG.has(String(val || "").trim());

  async function handleSubmit() {
    if (!jenjang) return alert("Pilih jenjang terlebih dahulu.");
    if (!isJenjangValid(jenjang)) {
      return alert(
        `Jenjang tidak valid. Gunakan salah satu dari: ${Array.from(VALID_JENJANG).join(", ")}`
      );
    }
    if (safeNum(spp) <= 0) {
      return alert("SPP harus lebih dari 0.");
    }

    setSaving(true);
    try {
      await apiPost({
        jenjangLabel: jenjang, // kirim label/value yang sama persis dengan picker
        spp: safeNum(spp),
        uangPangkal: {
          pakaian: safeNum(bp.pakaian),
          sarpras: safeNum(bp.sarpras),
          kasur: safeNum(bp.kasur),
          kitab: safeNum(bp.kitab),
          bp3: safeNum(bp.bp3),
        },
      });
      resetForm();
      loadItems();
      alert("Data berhasil disimpan!");
    } catch (e) {
      alert(e.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setJenjang("");
    setSpp("");
    setBp({ pakaian: "", sarpras: "", kasur: "", kitab: "", bp3: "" });
    setEditMode(false);
  }

  function onRowEdit(r) {
    // r.label berasal dari API; diasumsikan sama dengan value di picker
    setJenjang(r.label || "");
    setSpp(String(r?.spp ?? ""));
    setBp({
      pakaian: String(r?.uangPangkal?.pakaian ?? ""),
      sarpras: String(r?.uangPangkal?.sarpras ?? ""),
      kasur: String(r?.uangPangkal?.kasur ?? ""),
      kitab: String(r?.uangPangkal?.kitab ?? ""),
      bp3: String(r?.uangPangkal?.bp3 ?? ""),
    });
    setEditMode(true);
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full space-y-6 p-0 sm:p-6 lg:p-8">
        {/* Header + Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Biaya Daftar Ulang</h1>
            <p className="text-sm text-slate-700 mt-1">
              SPP terpisah dari Uang Pangkal (pakaian, sarpras, kasur, kitab, BP3).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:border-blue-400 hover:bg-blue-50"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Sembunyikan" : "Tambah"}
            </button>
            <button
              onClick={loadItems}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Import Excel (template sudah mengikuti JENJANG_OPTIONS) */}
        <ExcelImport
          endpoint="/api/re_registration_fees"
          title="Import Massal Biaya Daftar Ulang (XLS/CSV/TSV)"
          onAfterImport={() => loadItems()}
        />

        {/* Form input satuan */}
        {showForm && (
          <div className="rounded-none sm:rounded-2xl border-0 sm:border-2 border-slate-300 bg-white p-4 sm:p-8 shadow-none">

            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{editMode ? "Edit Data Biaya" : "Tambah Data Biaya"}</h2>
              {editMode && (
                <button onClick={resetForm} className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900">
                  <X className="h-4 w-4" />
                  <span>Batal</span>
                </button>
              )}
            </div>

            <div className="space-y-6">
              {/* 🔁 Komponen Picker yang sama */}
              <JenjangPicker
                value={jenjang}
                onChange={setJenjang}
                label="Pilih Jenjang"
                required
                lockAfterSelect={false}
                showReset
              />
              {!isJenjangValid(jenjang) && jenjang && (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Jenjang tidak ada di daftar resmi. Pilih dari opsi yang tersedia.
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800">
                  SPP (IDR) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="Contoh: 200000"
                  value={spp}
                  onChange={(e) => setSpp(e.target.value)}
                />
                <div className="text-sm font-semibold text-blue-700">{toIDR(spp || 0)}</div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Uang Pangkal (rincian)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BP_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">{f.label}</label>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        placeholder="0"
                        value={bp[f.key]}
                        onChange={(e) => setBp((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                      <div className="text-xs text-slate-700">{toIDR(bp[f.key] || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Total Uang Pangkal" value={toIDR(totalUangPangkal)} Icon={Wallet} />
                <StatCard label="SPP" value={toIDR(spp || 0)} Icon={FileText} />
                <StatCard label="Grand Total" value={toIDR(grandTotal)} Icon={Sparkles} />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={!jenjang || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? "Menyimpan..." : editMode ? "Perbarui Data" : "Simpan Data"}</span>
                </button>
                {editMode && (
                  <button
                    onClick={resetForm}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <X className="h-5 w-5" />
                    <span>Batal</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabel data */}
      <div className="rounded-none sm:rounded-2xl border-0 sm:border-2 border-slate-300 bg-white p-4 sm:p-8 shadow-none">

  <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Daftar Biaya Terdaftar</h2>
            <p className="text-sm text-slate-700">Total: {rows.length} jenjang</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-800 border-b border-slate-300">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Jenjang</th>
                  <th className="px-4 py-3 font-semibold">Key</th>
                  <th className="px-4 py-3 font-semibold">SPP</th>
                  <th className="px-4 py-3 font-semibold">Pakaian</th>
                  <th className="px-4 py-3 font-semibold">Sarpras</th>
                  <th className="px-4 py-3 font-semibold">Kasur</th>
                  <th className="px-4 py-3 font-semibold">Kitab</th>
                  <th className="px-4 py-3 font-semibold">BP3</th>
                  <th className="px-4 py-3 font-semibold">Total Pangkal</th>
                  <th className="px-4 py-3 font-semibold">Grand Total</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {(rows || []).map((r, i) => {
                  const up = r.uangPangkal || {};
                  const totalPangkal =
                    safeNum(up.pakaian) + safeNum(up.sarpras) + safeNum(up.kasur) + safeNum(up.kitab) + safeNum(up.bp3);
                  const grand = totalPangkal + safeNum(r.spp);
                  const valid = isJenjangValid(r.label);
                  return (
                    <tr key={r.key || i} className="odd:bg-white even:bg-slate-50 hover:bg-slate-100">
                      <td className="px-4 py-3 text-slate-700">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {r.label}
                        {!valid && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            di luar daftar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.key}</td>
                      <td className="px-4 py-3 text-blue-700 font-semibold">{toIDR(r.spp)}</td>
                      <td className="px-4 py-3">{toIDR(up.pakaian)}</td>
                      <td className="px-4 py-3">{toIDR(up.sarpras)}</td>
                      <td className="px-4 py-3">{toIDR(up.kasur)}</td>
                      <td className="px-4 py-3">{toIDR(up.kitab)}</td>
                      <td className="px-4 py-3">{toIDR(up.bp3)}</td>
                      <td className="px-4 py-3 text-emerald-700 font-semibold">{toIDR(totalPangkal)}</td>
                      <td className="px-4 py-3 text-slate-900 font-extrabold">{toIDR(grand)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onRowEdit(r)}
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rows?.length && !loading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-slate-700">
                      Belum ada data
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-slate-700">
                      Memuat data…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
