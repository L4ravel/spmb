"use client";

import { useEffect, useState } from "react";

/**
 * Props:
 * - open: boolean
 * - target: row data (harus punya nisn/_id)
 * - onClose: () => void
 * - onSave: (form) => Promise<void>
 * - saving: boolean
 */
export default function EditModal({ open, target, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    // users_app
    name: "",
    registrationLevel: "",
    finalDecision: "",
    registrationPaymentStatus: "",
    examAccessStatus: "",
    examAllowed: false,
    // ppdb
    nama: "",
    jenjang: "",
    ayahNama: "",
    ibuNama: "",
    hpSiswa: "",
    waliWa: "",
    ayahIncome: "",
    ibuIncome: "",
    alamat: "",
  });

  useEffect(() => {
    if (!open || !target) return;
    setForm({
      // users_app (prefill dari target / fallback dari ppdb)
      name: target?.name ?? target?.nama ?? "",
      registrationLevel:
        target?._regLevel ?? target?.registrationLevel ?? target?.jenjang ?? "",
      finalDecision: target?.finalDecision ?? "",
      registrationPaymentStatus: target?._regPayStatus ?? target?.registrationPaymentStatus ?? "",
      examAccessStatus: target?.examAccessStatus ?? "",
      examAllowed: !!target?.examAllowed,

      // ppdb
      nama: target?.nama ?? target?.name ?? "",
      jenjang: target?.jenjang ?? target?._regLevel ?? "",
      ayahNama: target?.ayahNama ?? "",
      ibuNama: target?.ibuNama ?? "",
      hpSiswa: target?.hpSiswa ?? "",
      waliWa: target?.waliWa ?? "",
      ayahIncome: target?.ayahIncome ?? "",
      ibuIncome: target?.ibuIncome ?? "",
      alamat: target?.alamat ?? "",
    });
  }, [open, target]);

  if (!open || !target) return null;

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* overlay sedikit lebih terang agar konten panel kontras */}
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute inset-0 flex items-start justify-center overflow-y-auto p-2 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt-0 sm:mt-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-base md:text-lg font-semibold text-slate-900">
              Edit Data — {target?.nama || target?.name || "-"} (
              {String(target?.nisn || target?._id || "-")})
            </h3>
            <button
              onClick={onClose}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>

          {/* Form */}
          <div className="px-5 py-4 space-y-6">
            {/* USERS_APP */}
            <section>
              <div className="mb-2 text-sm font-semibold text-slate-900">
                Data Akun (users_app)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="Nama (users_app/name)"
                  value={form.name}
                  onChange={(v) => set("name", v)}
                />
                <Field
                  label="Level/Jenjang (users_app/registrationLevel)"
                  value={form.registrationLevel}
                  onChange={(v) => set("registrationLevel", v)}
                  placeholder="mis: SMP PUTRA"
                />
                <Select
                  label="Keputusan Akhir (users_app/finalDecision)"
                  value={form.finalDecision}
                  onChange={(v) => set("finalDecision", v)}
                  options={[
                    { value: "", label: "(kosong)" },
                    { value: "LULUS", label: "LULUS" },
                    { value: "TIDAK", label: "TIDAK" },
                  ]}
                />
                <Field
                  label="Status Bayar (users_app/registrationPaymentStatus)"
                  value={form.registrationPaymentStatus}
                  onChange={(v) => set("registrationPaymentStatus", v)}
                  placeholder="verified / (kosong)"
                />
                <Field
                  label="Status Akses Ujian (users_app/examAccessStatus)"
                  value={form.examAccessStatus}
                  onChange={(v) => set("examAccessStatus", v)}
                  placeholder="mis: pending/ready/closed"
                />
                <Checkbox
                  label="Ijinkan Ujian (users_app/examAllowed)"
                  checked={!!form.examAllowed}
                  onChange={(v) => set("examAllowed", v)}
                />
              </div>
            </section>

            {/* PPDB */}
            <section>
              <div className="mb-2 text-sm font-semibold text-slate-900">
                Data Formulir (ppdb)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nama (ppdb/nama)" value={form.nama} onChange={(v) => set("nama", v)} />
                <Field
                  label="Jenjang (ppdb/jenjang)"
                  value={form.jenjang}
                  onChange={(v) => set("jenjang", v)}
                  placeholder="mis: SMP PUTRA"
                />
                <Field
                  label="Ayah (ppdb/ayahNama)"
                  value={form.ayahNama}
                  onChange={(v) => set("ayahNama", v)}
                />
                <Field
                  label="Ibu (ppdb/ibuNama)"
                  value={form.ibuNama}
                  onChange={(v) => set("ibuNama", v)}
                />
                <Field
                  label="HP Siswa (ppdb/hpSiswa)"
                  value={form.hpSiswa}
                  onChange={(v) => set("hpSiswa", v)}
                />
                <Field
                  label="WA Wali (ppdb/waliWa)"
                  value={form.waliWa}
                  onChange={(v) => set("waliWa", v)}
                />
                <Field
                  label="Income Ayah (ppdb/ayahIncome)"
                  value={form.ayahIncome}
                  onChange={(v) => set("ayahIncome", v)}
                  placeholder="cth: 1 - 2 juta"
                />
                <Field
                  label="Income Ibu (ppdb/ibuIncome)"
                  value={form.ibuIncome}
                  onChange={(v) => set("ibuIncome", v)}
                  placeholder="cth: 1 - 2 juta"
                />
                <Field
                  label="Alamat (ppdb/alamat)"
                  value={form.alamat}
                  onChange={(v) => set("alamat", v)}
                />
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              onClick={onClose}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              disabled={!!saving}
              onClick={() => onSave(form)}
              className="rounded bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== SMALL INPUTS ===================== */

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-sm text-slate-900">
      <span className="text-xs font-semibold text-slate-900">{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                   placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
    </label>
  );
}

function Select({ label, value, onChange, options = [] }) {
  return (
    <label className="block text-sm text-slate-900">
      <span className="text-xs font-semibold text-slate-900">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                   outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-900 select-none">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
      />
      <span className="text-xs font-semibold text-slate-900">{label}</span>
    </label>
  );
}
