"use client";
import React, { useEffect, useMemo, useState } from "react";

/** Hierarki jenjang (3 kelompok: Sekolah, LKSA, Ma'had Aly) */
export const HIERARCHY = {
  REGULER: [
    { key: "TK", label: "TK", values: [{ value: "TK", label: "TK" }] },
    {
      key: "SD",
      label: "SD",
      values: [
        { value: "SD Putra", label: "Putra" },
        { value: "SD Putri", label: "Putri" },
      ],
    },
    {
      key: "SMP",
      label: "SMP",
      values: [
        { value: "SMP Putra", label: "Putra" },
        { value: "SMP Putri", label: "Putri" },
      ],
    },
    {
      key: "SMA",
      label: "SMA",
      values: [
        { value: "SMA Putra", label: "Putra" },
        { value: "SMA Putri", label: "Putri" },
      ],
    },
  ],

  LKSA: [
    {
      key: "UlaIta",
      label: "PPS Ula",
      values: [
        { value: "PPS Ula Putra", label: "Putra" },
        { value: "PPS Ula Putri", label: "Putri" },
      ],
    },
    { key: "Wustho", label: "PPS Wustho", values: [{ value: "PPS Wustho", label: "PPS Wustho" }] },
    // { key: "Ulya", label: "PPS Ulya", values: [{ value: "PPS Ulya", label: "PPS Ulya" }] },
  ],

  "STIT / MA'HAD ALY": [
    {
      key: "PGMI",
      label: "PGMI (S1)",
      values: [
        { value: "PGMI Putra (S1)", label: "Putra" },
        { value: "PGMI Putri (S1)", label: "Putri" },
      ],
    },
    {
      key: "MPI",
      label: "MPI (S1)",
      values: [
        { value: "MPI Putra (S1)", label: "Putra" },
        { value: "MPI Putri (S1)", label: "Putri" },
      ],
    },
    {
      key: "PIAUD",
      label: "PIAUD (S1)",
      values: [
        { value: "PIAUD Putra (S1)", label: "Putra" },
        { value: "PIAUD Putri (S1)", label: "Putri" },
      ],
    },
  ],
};

export const JENJANG_OPTIONS = Object.values(HIERARCHY).flat().flatMap((p) => p.values);

/* UI kecil */
function Pill({ active, children, category }) {
  const colors = getColorClasses(category);
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide",
        active ? `${colors.pill} text-white` : "bg-slate-100 text-slate-800",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/* Tombol kelompok atas */
function TopButton({ label, active, onClick, category }) {
  const colors = getColorClasses(category);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex-1 rounded-2xl px-4 py-3 text-[13px] font-bold tracking-wide transition border",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        "transition-transform duration-150 active:scale-[.98]",
        active
          // DIPILIH = fill solid pakai warna varian akhir (Putra/Putri)
          ? `${colors.variantActiveBorder} ${colors.variantActiveBg} ${colors.variantActiveText} shadow-sm`
          // NORMAL = terang; PRESSED = fill solid sama seperti dipilih
          : [
              "border-slate-300 bg-white text-slate-900",
              colors.topHoverBorder, colors.topHoverBg,
              colors.pressBorder, colors.pressBg, colors.pressText
            ].join(" "),
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function CardButton({ title, subtitle, active, onClick, disabled, category }) {
  const colors = getColorClasses(category);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={[
        "w-full rounded-xl border px-3 py-2 text-left transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        "transition-transform duration-150", disabled ? "" : "active:scale-[.98]",
        active
          // DIPILIH = fill solid pakai warna varian akhir
          ? `${colors.variantActiveBorder} ${colors.variantActiveBg} ${colors.variantActiveText} shadow-sm`
          // NORMAL + PRESSED
          : [
              "border-slate-300 bg-white text-slate-900",
              colors.cardHoverBorder, colors.cardHoverBg,
              colors.pressBorder, colors.pressBg, colors.pressText
            ].join(" "),
        disabled && "opacity-60 cursor-not-allowed",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="truncate">
          <div className="font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-[12px] text-slate-700">{subtitle}</div>}
        </div>
      
      </div>
    </button>
  );
}

/* Palet warna per kategori – pakai warna dari filemu; tambah kelas :active yang cocok */
function getColorClasses(category) {
  const colors = {
    SEKOLAH: {
      pill: "bg-green-700",
      topHoverBorder: "hover:border-green-500",
      topHoverBg: "hover:bg-green-50",
      cardHoverBorder: "hover:border-green-500",
      cardHoverBg: "hover:bg-green-50",

      variantBorder: "border-green-200",
      variantBg: "bg-green-50",
      variantText: "text-green-800",
      variantButtonBorder: "border-green-700",
      variantButtonHoverBorder: "hover:border-green-500",
      variantButtonHoverBg: "hover:bg-green-50/60",
      variantActiveBg: "bg-green-600",
      variantActiveText: "text-white",
      variantActiveBorder: "border-green-600",

      // pressed = fill solid sama seperti varian aktif
      pressBorder: "active:border-green-600",
      pressBg: "active:bg-green-600",
      pressText: "active:text-white",
    },
    LKSA: {
      pill: "bg-violet-700",
      topHoverBorder: "hover:border-violet-500",
      topHoverBg: "hover:bg-violet-50",
      cardHoverBorder: "hover:border-violet-500",
      cardHoverBg: "hover:bg-violet-50",

      variantBorder: "border-violet-200",
      variantBg: "bg-violet-50",
      variantText: "text-violet-800",
      variantButtonBorder: "border-violet-700",
      variantButtonHoverBorder: "hover:border-violet-500",
      variantButtonHoverBg: "hover:bg-violet-50/60",
      variantActiveBg: "bg-violet-600",
      variantActiveText: "text-white",
      variantActiveBorder: "border-violet-600",

      pressBorder: "active:border-violet-600",
      pressBg: "active:bg-violet-600",
      pressText: "active:text-white",
    },
    "MA'HAD ALY": {
      pill: "bg-orange-700",
      topHoverBorder: "hover:border-orange-500",
      topHoverBg: "hover:bg-orange-50",
      cardHoverBorder: "hover:border-orange-500",
      cardHoverBg: "hover:bg-orange-50",

      variantBorder: "border-orange-200",
      variantBg: "bg-orange-50",
      variantText: "text-orange-800",
      variantButtonBorder: "border-orange-700",
      variantButtonHoverBorder: "hover:border-orange-500",
      variantButtonHoverBg: "hover:bg-orange-50/60",
      variantActiveBg: "bg-orange-600",
      variantActiveText: "text-white",
      variantActiveBorder: "border-orange-600",

      pressBorder: "active:border-orange-600",
      pressBg: "active:bg-orange-600",
      pressText: "active:text-white",
    },
  };
  return colors[category] || colors.SEKOLAH;
}

/* Helper */
function findPathByValue(value) {
  if (!value) return null;
  for (const [top, parents] of Object.entries(HIERARCHY)) {
    for (const parent of parents) {
      if (parent.values.some((v) => v.value === value)) {
        return { top, parentKey: parent.key };
      }
    }
  }
  return null;
}

/* Komponen utama */
export default function JenjangPicker({
  value,
  onChange,
  label = "Klasifikasi & Jenjang",
  required = true,
  disabled = false,
}) {
  const initial = useMemo(() => findPathByValue(value), [value]);
  const [activeTop, setActiveTop] = useState(initial?.top || "REGULER");
  const [openParent, setOpenParent] = useState(initial?.parentKey || null);

  useEffect(() => {
    const p = findPathByValue(value);
    if (p) {
      setActiveTop(p.top);
      setOpenParent(p.parentKey);
    }
  }, [value]);

  const parents = HIERARCHY[activeTop];

  const handleParentClick = (parent) => {
    if (disabled) return;
    // Reset pilihan sebelumnya
    onChange?.("");
    if (parent.values.length === 1) {
      onChange?.(parent.values[0].value);
      setOpenParent(null);
      return;
    }
    setOpenParent((k) => (k === parent.key ? null : parent.key));
  };

  const isParentSelected = (p) => p.key === openParent || p.values.some((v) => v.value === value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-semibold text-slate-900">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
        {!!value && !disabled && (
          <button
            type="button"
            onClick={() => { onChange?.(""); setOpenParent(null); }}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-800 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus-visible:ring-2"
            title="Reset pilihan"
          >
            Reset
          </button>
        )}
      </div>

      {/* 3 tombol utama */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {Object.keys(HIERARCHY).map((top) => (
          <TopButton
            key={top}
            label={top}
            active={activeTop === top}
            onClick={() => { setActiveTop(top); setOpenParent(null); }}
            category={top}
          />
        ))}
      </div>

      {/* Level berikutnya */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {parents.map((p) => (
            <CardButton
              key={p.key}
              title={p.label}
              active={isParentSelected(p)}
              onClick={() => handleParentClick(p)}
              disabled={disabled}
              category={activeTop}
            />
          ))}
        </div>

        {/* Varian Putra/Putri jika ada */}
        {openParent && (() => {
          const parent = parents.find((x) => x.key === openParent);
          if (!parent || parent.values.length <= 1) return null;
          const colors = getColorClasses(activeTop);
          return (
            <div className={`mt-3 rounded-xl border ${colors.variantBorder} ${colors.variantBg} p-3`}>
              <div className={`mb-2 text-xs font-bold ${colors.variantText}`}>
                Pilih {parent.label}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {parent.values.map((v) => {
                  const selected = value === v.value;
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => onChange?.(v.value)}
                      aria-pressed={selected}
                      className={[
                        "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
                        "transition-transform duration-150 active:scale-[.98]",
                        selected
                          // aktif (selected) = fill solid
                          ? `${colors.variantActiveBorder} ${colors.variantActiveBg} ${colors.variantActiveText} shadow-sm`
                          // tidak aktif: hover ringan; tekan = fill solid
                          : [
                              "border-slate-300 bg-white text-slate-900",
                              colors.variantButtonHoverBorder, colors.variantButtonHoverBg,
                              colors.pressBorder, colors.pressBg, colors.pressText
                            ].join(" "),
                      ].join(" ")}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

