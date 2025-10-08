"use client";

/** ===== UI HELPERS (dipisah untuk reuse & maintenance) ===== */
export const Field = ({ label, children, required, className }) => (
  <label className={`block ${className || ""}`}>
    <span className="block text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-rose-600">*</span>}
    </span>
    <div className="mt-1">{children}</div>
  </label>
);

export const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 ${props.className || ""}`}
  />
);

export const Select = ({ children, ...p }) => (
  <select
    {...p}
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
  >
    {children}
  </select>
);

export const Section = ({ title, desc, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
    {desc && <p className="mt-1 text-sm text-slate-600">{desc}</p>}
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </section>
);

/** ===== IncomeSelect (INTEGER) =====
 * - Menyimpan nilai integer rupiah pada onChange (Number).
 * - value terima Number (mis. 1500000) atau "" (belum dipilih).
 * - Titik tengah rentang dipakai sebagai perwakilan nilai.
 */
export const IncomeSelect = ({ name, value, onChange, disabled }) => {
  const handle = (e) => {
    const raw = e.target.value;
    // "" tetap string kosong (belum dipilih), selain itu di-cast ke Number
    const casted = raw === "" ? "" : Number.parseInt(raw, 10);
    // lempar event bergaya HTMLInputElement dengan value sudah Number
    onChange?.({
      ...e,
      target: { ...e.target, name, value: casted },
    });
  };

  return (
    <Select name={name} value={value === "" ? "" : String(value)} onChange={handle} disabled={disabled}>
      <option value="">— Pilih Penghasilan —</option>
      <option value="500000">0 - 1 juta</option>
      <option value="1500000">1 - 2 juta</option>
      <option value="2500000">2 - 3 juta</option>
      <option value="4000000">3 - 5 juta</option>
      <option value="7500000">5 - 10 juta</option>
      <option value="10000000">10 juta</option>
    </Select>
  );
};

export const PekerjaanSelect = (p) => (
  <Select {...p}>
    <option value="">— Pilih Pekerjaan —</option>
    <option value="pns">PNS / ASN</option>
    <option value="swasta">Pegawai Swasta</option>
    <option value="wiraswasta">Wiraswasta / Wirausaha</option>
    <option value="petani">Petani</option>
    <option value="nelayan">Nelayan</option>
    <option value="buruh">Buruh / Pekerja Harian</option>
    <option value="pedagang">Pedagang</option>
    <option value="transport">Sopir / Ojek / Transportasi</option>
    <option value="lainnya">Lainnya</option>
  </Select>
);

export const PekerjaanSelectIbu = (p) => (
  <Select {...p}>
    <option value="">— Pilih Pekerjaan —</option>
    <option value="irt">Ibu Rumah Tangga (IRT)</option>
    <option value="pns">PNS / ASN</option>
    <option value="swasta">Pegawai Swasta</option>
    <option value="wiraswasta">Wiraswasta / Wirausaha</option>
    <option value="petani">Petani</option>
    <option value="nelayan">Nelayan</option>
    <option value="buruh">Buruh / Pekerja Harian</option>
    <option value="pedagang">Pedagang</option>
    <option value="transport">Sopir / Ojek / Transportasi</option>
    <option value="lainnya">Lainnya</option>
  </Select>
);
