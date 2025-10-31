// app/admin/geografi/lib/regions.js
import { useEffect, useState } from "react";

/* ===== Fetch helpers ===== */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Gagal memuat ${url}`);
  return res.json();
}
async function tryFetchJSON(url) {
  try { return await fetchJSON(url); } catch { return null; }
}

/* ===== Utils ===== */
function arrToMap(list, key = "code", val = "name") {
  const m = new Map();
  (list || []).forEach((it) => {
    const k = String(it?.[key] ?? "");
    const v = String(it?.[val] ?? "");
    if (k) m.set(k, v);
  });
  return m;
}
function uniqueByCode(list = []) {
  const seen = new Set();
  return (list || []).filter((it) => {
    const code = String(it?.code ?? "");
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}
export function provNameOf(provMap, code) {
  return provMap.get(code || "") || "—";
}
export function regNameOf(regMap, code) {
  return regMap.get(code || "") || "—";
}
export function distNameOf(distMap, code) {
  return distMap.get(code || "") || "—";
}
/** Ambil kode kab/kota dari kode kecamatan, contoh "52.01.10" -> "52.01" */
function regencyCodeFromDistrictCode(dCode = "") {
  const parts = String(dCode).split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : "";
}

/* ===== Hooks kamus wilayah ===== */
export function useRegionDictionaries() {
  const [provMap, setProvMap] = useState(new Map());
  const [regByProv, setRegByProv] = useState({});
  const [regMap, setRegMap] = useState(new Map());
  const [distByReg, setDistByReg] = useState({});
  const [distMap, setDistMap] = useState(new Map());

  // load prov + kab/kota NTB sebagai baseline
  useEffect(() => {
    let alive = true;
    (async () => {
      const provs = await fetchJSON("/regions/provinces.json");
      if (!alive) return;
      setProvMap(arrToMap(provs));

      const regs52Raw = await fetchJSON("/regions/52.regencies.json");
      if (!alive) return;
      const regs52 = uniqueByCode(regs52Raw);
      setRegByProv((s) => ({ ...s, "52": regs52 }));

      const rMap = new Map();
      regs52.forEach((r) => rMap.set(String(r.code), String(r.name)));
      setRegMap(rMap);
    })().catch(console.error);
    return () => { alive = false; };
  }, []);

  // function untuk lazy load kecamatan oleh regencyCode
  const setRegencyCodeForLazy = async (regencyCode) => {
    if (!regencyCode || distByReg[regencyCode]) return;
    const url = `/regions/${regencyCode}.districts.json`;
    const distsRaw = await tryFetchJSON(url);
    if (Array.isArray(distsRaw)) {
      const clean = uniqueByCode(distsRaw);
      setDistByReg((s) => ({ ...s, [regencyCode]: clean }));
      setDistMap((old) => {
        const m = new Map(old);
        clean.forEach((d) => m.set(String(d.code), String(d.name)));
        return m;
      });
    } else {
      setDistByReg((s) => ({ ...s, [regencyCode]: [] }));
    }
  };

  return { provMap, regByProv, regMap, distByReg, distMap, setRegencyCodeForLazy };
}

/** Pastikan kecamatan yang muncul di tabel sudah ada di kamus (lazy, irit) */
export function useEnsureDistrictsForRows(rows, region) {
  useEffect(() => {
    const neededRegencyCodes = new Set();
    for (const r of rows) {
      const dCode = r.districtCode;
      if (!dCode) continue;
      if (region.distMap.has(dCode)) continue;
      const regFromDist = regencyCodeFromDistrictCode(dCode);
      if (regFromDist) neededRegencyCodes.add(regFromDist);
    }
    if (neededRegencyCodes.size === 0) return;

    let alive = true;
    (async () => {
      for (const regCode of neededRegencyCodes) {
        if (!alive) break;
        await region.setRegencyCodeForLazy(regCode);
      }
    })();

    return () => { alive = false; };
  }, [rows, region]);
}
