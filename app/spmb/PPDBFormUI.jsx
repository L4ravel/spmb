// PPDBFormUI.jsx
import React from "react";

export const Section = ({ title, desc, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
    <div className="mb-3">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {desc ? <div className="text-xs text-slate-600">{desc}</div> : null}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
  </div>
);

export const Field = ({ label, required, className = "", children }) => (
  <label className={`block ${className}`}>
    <span className="mb-1 inline-block text-[13px] font-medium text-slate-700">
      {label} {required ? <span className="text-rose-600">*</span> : null}
    </span>
    {children}
  </label>
);

/** Input:
 * - Tidak pakai placeholder normal.
 * - Jika ada error → tampilkan error sebagai placeholder & ring merah.
 */
export const Input = ({ className = "", error, id, name, ...props }) => {
  const ring = error ? "focus:ring-rose-500 ring-1 ring-rose-400" : "focus:ring-indigo-500";
  return (
    <input
      {...props}
      id={id || name}
      name={name}
      placeholder={error ? String(error) : ""}     // ⬅️ placeholder hanya saat error
      aria-invalid={!!error}
      className={[
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none",
        ring,
        error ? "placeholder-rose-500" : "",
        "disabled:bg-slate-100 disabled:text-slate-500",
        className,
      ].join(" ")}
    />
  );
};

/** Select:
 * - Tidak ada placeholder; jika error & belum memilih, tampilkan option disabled berisi pesan error.
 */
export const Select = ({ children, className = "", error, id, name, value, ...p }) => {
  const ring = error ? "focus:ring-rose-500 ring-1 ring-rose-400" : "focus:ring-indigo-500";
  const hasValue = value !== undefined && value !== null && String(value) !== "";
  return (
    <select
      {...p}
      id={id || name}
      name={name}
      value={value}
      aria-invalid={!!error}
      className={[
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none",
        ring,
        "disabled:bg-slate-100 disabled:text-slate-500",
        className,
      ].join(" ")}
    >
      {!hasValue && error ? (
        <option value="" disabled>
          {String(error)}
        </option>
      ) : null}
      {children}
    </select>
  );
};

export const IncomeSelect = (props) => (
  <Select {...props}>
    <option value="">— Pilih Penghasilan —</option>
    <option value="&lt; 1 Juta">{"< 1 Juta"}</option>
    <option value="1 - 2 Juta">1 - 2 Juta</option>
    <option value="2 - 3 Juta">2 - 3 Juta</option>
    <option value="3 - 5 Juta">3 - 5 Juta</option>
    <option value="5 - 10 Juta">5 - 10 Juta</option>
    <option value="&gt;= 10 Juta">{">= 10 Juta"}</option>
  </Select>
);

export const PekerjaanSelect = (props) => (
  <Select {...props}>
    <option value="">— Pilih Pekerjaan —</option>
    <option value="Petani">Petani</option>
    <option value="Buruh">Buruh</option>
    <option value="Wiraswasta">Wiraswasta</option>
    <option value="Karyawan">Karyawan</option>
    <option value="PNS">PNS</option>
    <option value="TNI/Polri">TNI/Polri</option>
    <option value="Lainnya">Lainnya</option>
  </Select>
);

export const PekerjaanSelectIbu = (props) => (
  <Select {...props}>
    <option value="">— Pilih Pekerjaan —</option>
    <option value="Ibu Rumah Tangga">Ibu Rumah Tangga</option>
    <option value="Buruh">Buruh</option>
    <option value="Wiraswasta">Wiraswasta</option>
    <option value="Karyawan">Karyawan</option>
    <option value="PNS">PNS</option>
    <option value="Lainnya">Lainnya</option>
  </Select>
);
