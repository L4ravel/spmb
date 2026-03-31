// WilayahPicker.jsx
"use client";
import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/* ===== Helpers ===== */
function uniqueByCode(list = []) {
  const seen = new Set();
  return (list || []).filter((raw) => {
    const code = String(raw?.code ?? "");
    if (!code) return false;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

/** NTB kalau kode "52" (atau "52.xx") */
function isNTB(provinceCode) {
  const code = String(provinceCode || "");
  return code === "52" || code.split(".")[0] === "52";
}

/** Tambahkan sentinel "Lainnya" bila belum ada */
function withOtherOption(provinces) {
  const hasOther = (provinces || []).some((p) => String(p?.code) === "OTHER");
  if (hasOther) return provinces;
  return [...(provinces || []), { code: "OTHER", name: "Lainnya" }];
}

/**
 * WilayahPicker
 * Props: value { provinceCode, regencyCode, districtCode, addressLine }
 */
export default function WilayahPicker({
  value,
  onChange,
  label = "Provinsi, Kab/Kota, Kecamatan",
  required = true,
  disabled = false,
  data = null,
  compact = false,
  addressLabel = "Alamat Lengkap",
  addressRequired = true,
  addressPlaceholder = "",
}) {
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [loadingReg, setLoadingReg] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);

  const v = value || { provinceCode: "", regencyCode: "", districtCode: "", addressLine: "" };
  const ntbSelected = isNTB(v.provinceCode);         // true hanya untuk NTB
  const otherSelected = v.provinceCode === "OTHER";  // sentinel Lainnya

  /* Fetch util */
  const fetchJSON = async (url) => {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error("Failed to load " + url);
    return res.json();
  };

  /* Init provinces (tambah "Lainnya") */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (data?.provinces) {
          if (!mounted) return;
          setProvinces(withOtherOption(uniqueByCode(data.provinces)));
        } else {
          const prov = await fetchJSON("/regions/provinces.json");
          if (!mounted) return;
          setProvinces(withOtherOption(uniqueByCode(prov)));
        }
      } catch (e) {
        console.error(e);
        // fallback minimal: NTB + Lainnya
        setProvinces([
          { code: "52", name: "Nusa Tenggara Barat" },
          { code: "OTHER", name: "Lainnya" },
        ]);
      }
    })();
    return () => { mounted = false; };
  }, [data]);

  /* Load regencies (hanya untuk NTB) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      // reset saat ganti provinsi
      if (!v.provinceCode || !ntbSelected) {
        setRegencies([]);
        setDistricts([]);
        // kalau provinsi bukan NTB (termasuk OTHER), kosongkan regency/district di state form
        if (v.regencyCode || v.districtCode) {
          onChange?.({ ...v, regencyCode: "", districtCode: "" });
        }
        return;
      }
      try {
        setLoadingReg(true);
        if (data?.regenciesByProv?.[v.provinceCode]) {
          if (!mounted) return;
          setRegencies(uniqueByCode(data.regenciesByProv[v.provinceCode]));
        } else {
          const regs = await fetchJSON(`/regions/${v.provinceCode}.regencies.json`);
          if (!mounted) return;
          setRegencies(uniqueByCode(regs));
        }
      } catch (e) {
        console.error(e);
        setRegencies([]);
      } finally {
        setLoadingReg(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.provinceCode, ntbSelected, data]);

  /* Load districts (hanya NTB) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ntbSelected || !v.regencyCode) {
        setDistricts([]);
        return;
      }
      try {
        setLoadingDist(true);
        if (data?.districtsByReg?.[v.regencyCode]) {
          if (!mounted) return;
          setDistricts(uniqueByCode(data.districtsByReg[v.regencyCode]));
        } else {
          const dists = await fetchJSON(`/regions/${v.regencyCode}.districts.json`);
          if (!mounted) return;
          setDistricts(uniqueByCode(dists));
        }
      } catch (e) {
        console.error(e);
        setDistricts([]);
      } finally {
        setLoadingDist(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.regencyCode, ntbSelected, data]);

  /* Handlers */
  const changeProvince = (code) => {
    onChange?.({
      provinceCode: code || "",
      regencyCode: "",
      districtCode: "",
      addressLine: v.addressLine || "",
    });
  };
  const changeRegency = (code) => onChange?.({ ...v, regencyCode: code || "", districtCode: "" });
  const changeDistrict = (code) => onChange?.({ ...v, districtCode: code || "" });
  const changeAddress = (text) => onChange?.({ ...v, addressLine: text });

  return (
    <div className={compact ? "space-y-1 mb-0" : "space-y-3 mb-0"}>
      <div className="flex items-center gap-2">
        <label className={compact ? "block text-sm font-semibold text-slate-900 mb-0.5" : "block text-sm font-semibold text-slate-900"}>
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
        {(v.provinceCode || v.regencyCode || v.districtCode || v.addressLine) && !disabled && (
          <button
            type="button"
            onClick={() => onChange?.({ provinceCode: "", regencyCode: "", districtCode: "", addressLine: "" })}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-800 hover:bg-slate-50"
            title="Reset pilihan"
          >
            Reset
          </button>
        )}
      </div>

      {/* Wilayah */}
      {ntbSelected ? (
        <div className={`grid grid-cols-1 md:grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
          <Field label="Provinsi" compact={compact}>
            <Select
              disabled={disabled}
              value={v.provinceCode}
              onChange={(e) => changeProvince(e.target.value)}
              placeholder="— Pilih Provinsi —"
              options={provinces}
            />
          </Field>
          <Field label="Kab/Kota" compact={compact}>
            <Select
              disabled={disabled || !v.provinceCode || loadingReg}
              value={v.regencyCode}
              onChange={(e) => changeRegency(e.target.value)}
              placeholder={loadingReg ? "Memuat…" : "— Pilih Kab/Kota —"}
              options={regencies}
            />
          </Field>
          <Field label="Kecamatan" compact={compact}>
            <Select
              disabled={disabled || !v.regencyCode || loadingDist}
              value={v.districtCode}
              onChange={(e) => changeDistrict(e.target.value)}
              placeholder={loadingDist ? "Memuat…" : "— Pilih Kecamatan —"}
              options={districts}
            />
          </Field>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${compact ? "gap-2" : "gap-3"}`}>
          <Field label="Provinsi" compact={compact}>
            <Select
              disabled={disabled}
              value={v.provinceCode}
              onChange={(e) => changeProvince(e.target.value)}
              placeholder="— Pilih Provinsi —"
              options={provinces}
            />
          </Field>
          {v.provinceCode && !ntbSelected && (
            <p className="text-xs text-slate-500">
              Untuk provinsi <span className="font-medium">{otherSelected ? "Lainnya" : "selain Nusa Tenggara Barat"}</span>, cukup isi alamat lengkap di bawah.
            </p>
          )}
        </div>
      )}

      {/* Alamat (selalu ada) */}
      <div className={compact ? "mt-1" : "mt-1"}>
        <Field label={`${addressLabel}${addressRequired ? " *" : ""}`} compact={compact}>
          <TextInput
            value={v.addressLine || ""}
            onChange={(e) => changeAddress(e.target.value)}
            placeholder={addressPlaceholder || (ntbSelected ? "" : "Tulis alamat lengkap")}
            disabled={disabled}
          />
        </Field>
      </div>
    </div>
  );
}

/* ===== UI bits ===== */
function Field({ label, children, compact = false }) {
  return (
    <div>
      <label className={`block text-sm font-medium text-slate-700 ${compact ? "mb-0.5" : "mb-1"}`}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, disabled, placeholder, options }) {
  return (
    <div className="relative">
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm disabled:opacity-60"
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {(options || []).map((o, idx) => {
          const code = String(o?.code ?? "");
          const name = String(o?.name ?? "");
          return (
            <option key={`${code}::${name}::${idx}`} value={code}>
              {name}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled }) {
  return (
    <input
      type="text"
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
