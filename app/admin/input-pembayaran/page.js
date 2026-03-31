"use client";

import { useEffect, useMemo, useState } from "react";
import JenjangPicker from "@/app/spmb/JenjangPicker";

function toIDR(n) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Number(n || 0));
  } catch {
    return `Rp${String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }
}

// Samakan kunci dokumen dengan gaya yang kita pakai di tempat lain
function toSafeUpperSnake(s) {
  return (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");
}

export default function InputPembayaranPage() {
  const [jenjang, setJenjang] = useState("");
  const [fee, setFee] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  async function fetchFees() {
    setLoading(true);
    try {
      const res = await fetch("/api/fees", { method: "GET" });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Gagal mengambil data biaya.");
      setRows(data.items || []);
    } catch (e) {
      alert("Gagal memuat data biaya. " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFees();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const f = Number(fee);
    if (!jenjang) return alert("Pilih jenjang dulu.");
    if (!Number.isFinite(f) || f < 0) return alert("Biaya tidak valid.");

    setSaving(true);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenjangLabel: jenjang, fee: f }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Gagal menyimpan biaya.");
      // reset fee saja (biar jenjang bisa input lanjut)
      setFee("");
      await fetchFees();
    } catch (e) {
      alert("Gagal menyimpan. " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-none w-full px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem-4rem)]">

        {/* Header */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />
          <div className="relative rounded-[26px] bg-white ring-1 ring-slate-200 overflow-hidden">
            <div className="p-6 md:p-8">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Input Biaya Pendaftaran Per Jenjang
              </h1>
              <p className="mt-1 text-slate-600">
                Masukkan/ubah biaya pendaftaran per jenjang. Nilai ini akan dipakai di halaman sukses/aktivasi akun.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <JenjangPicker
                  value={jenjang}
                  onChange={setJenjang}
                  label="Pilih Jenjang"
                  required
                  lockAfterSelect={false}
                  showReset={true}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Biaya (IDR) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="cth: 200000"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
                <div className="mt-1 text-xs text-slate-500">Tampilan: {toIDR(fee || 0)}</div>

                <button
                  type="submit"
                  disabled={!jenjang || !fee || saving}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan / Perbarui"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Tabel daftar biaya */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Daftar Biaya Saat Ini</h2>
            <button
              type="button"
              onClick={fetchFees}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="px-2 py-2.5">#</th>
                  <th className="px-2 py-2.5">Jenjang</th>
                  <th className="px-2 py-2.5">Key</th>
                  <th className="px-2 py-2.5">Biaya</th>
                  <th className="px-2 py-2.5">Diupdate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(rows || []).map((r, i) => (
                  <tr key={r.key || i} className="text-slate-800">
                    <td className="px-2 py-2.5">{i + 1}</td>
                    <td className="px-2 py-2.5">{r.label || "-"}</td>
                    <td className="px-2 py-2.5 font-mono">{r.key}</td>
                    <td className="px-2 py-2.5 font-semibold">{toIDR(r.fee)}</td>
                    <td className="px-2 py-2.5 text-slate-500">
                      {r.updatedAt
                        ? new Date(r.updatedAt._seconds ? r.updatedAt._seconds * 1000 : r.updatedAt).toLocaleString("id-ID")
                        : "-"}
                    </td>
                  </tr>
                ))}
                {!rows?.length && !loading && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-slate-500">
                      Belum ada data. Silakan input pertama kali.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-slate-500">
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
