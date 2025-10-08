"use client";
import React, { useEffect, useMemo, useState } from "react";

/** Kelompok jenjang
 * - Universitas: HANYA yang berakhiran (S1)
 * - Sekolah: sisanya (termasuk PPS* & Ula Ita*)
 */
const GROUPS = {
  Sekolah: [
    { value: "TK", label: "TK" },
    { value: "SD Putra", label: "SD Putra" },
    { value: "SD Putri", label: "SD Putri" },
    { value: "SMP Putra", label: "SMP Putra" },
    { value: "SMP Putri", label: "SMP Putri" },
    { value: "SMA Putra", label: "SMA Putra" },
    { value: "SMA Putri", label: "SMA Putri" },
    { value: "PPS Ula", label: "PPS Ula" },
    { value: "Ula Ita Putra", label: "Ula Ita Putra" },
    { value: "Ula Ita Putri", label: "Ula Ita Putri" },
    { value: "PPS Wustho", label: "PPS Wustho" },
    { value: "PPS Ulya", label: "PPS Ulya" },
  ],
  Universitas: [
    { value: "PGMI Putra (S1)", label: "PGMI Putra (S1)" },
    { value: "PGMI Putri (S1)", label: "PGMI Putri (S1)" },
    { value: "MPI Putra (S1)", label: "MPI Putra (S1)" },
    { value: "MPI Putri (S1)", label: "MPI Putri (S1)" },
    { value: "PIAUD Putra (S1)", label: "PIAUD Putra (S1)" },
    { value: "PIAUD Putri (S1)", label: "PIAUD Putri (S1)" },
  ],
};

// 🔸 Tambahkan named export agar bisa dipakai di halaman lain (kuota, ppdb, dsb)
export { GROUPS };
export const JENJANG_OPTIONS = [...GROUPS.Sekolah, ...GROUPS.Universitas];

const GROUP_NAMES = Object.keys(GROUPS);

function inferGroupFromValue(val) {
  if (!val) return "Sekolah";
  return GROUP_NAMES.find((g) => GROUPS[g].some((o) => o.value === val)) || "Sekolah";
}

/** Komponen picker (tetap sama) */
export default function JenjangPicker({
  value,
  onChange,
  label = "Klasifikasi & Jenjang",
  required = true,
  disabled = false,
  lockAfterSelect = true,
  showReset = true,
}) {
  const [group, setGroup] = useState(() => inferGroupFromValue(value));

  useEffect(() => {
    const inferred = inferGroupFromValue(value);
    setGroup((g) => (value ? inferred : g));
  }, [value]);

  const options = useMemo(() => GROUPS[group], [group]);
  const isLocked = lockAfterSelect && !!value;

  const setValue = (val) => !disabled && onChange?.(val);
  const resetValue = () => !disabled && onChange?.("");

  const switchGroup = (g) => {
    if (disabled) return;
    if (g === group) return;
    if (isLocked) return;
    setGroup(g);
    if (value && !GROUPS[g].some((o) => o.value === value)) onChange?.("");
  };

  return (
    <div className="block">
      <div className="flex items-end justify-between gap-3">
        <span className="block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-rose-600">*</span>}
        </span>
        {showReset && !!value && !disabled && (
          <button
            type="button"
            onClick={resetValue}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
            title="Ubah pilihan"
          >
            Batal / Ubah pilihan
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3" role="tablist" aria-label="Pilih klasifikasi">
        {GROUP_NAMES.map((g) => {
          const isActiveTab = g === group;
          const selectedInThisGroup = !!value && GROUPS[g].some((o) => o.value === value);
          return (
            <button
              key={g}
              type="button"
              onClick={() => switchGroup(g)}
              disabled={disabled || (isLocked && !selectedInThisGroup)}
              className={[
                "rounded-xl border px-3 py-2 text-sm text-left",
                "text-slate-900 shadow-sm transition-transform duration-150",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                selectedInThisGroup
                  ? "border-indigo-600 bg-indigo-50 font-semibold"
                  : isActiveTab
                  ? "border-indigo-300 bg-white font-semibold"
                  : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5",
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              {g}
            </button>
          );
        })}
      </div>

      <div
        className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        role="radiogroup"
        aria-label={`Pilih jenjang - ${group}`}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          const cardDisabled = disabled || (isLocked && !selected);
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={cardDisabled}
              onClick={() => {
                if (!cardDisabled) setValue(opt.value);
              }}
              className={[
                "rounded-xl border px-3 py-2 text-sm text-left",
                "text-slate-900 shadow-sm transition-transform duration-150",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                selected
                  ? "border-indigo-600 bg-indigo-50 font-semibold"
                  : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5",
                cardDisabled && !selected ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              title={opt.label}
            >
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "inline-block h-2.5 w-2.5 rounded-full",
                    selected ? "bg-indigo-600" : "bg-slate-300",
                  ].join(" ")}
                  aria-hidden="true"
                />
                <span className="truncate">{opt.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {isLocked && !disabled && (
        <p className="mt-2 text-xs text-slate-500">
          Pilihan terkunci. Klik <b>Batal / Ubah pilihan</b> untuk mengganti.
        </p>
      )}
    </div>
  );
}
