// app/admin/data-daftar-ulang/data/fees.js

let _feesCache = null;

/**
 * Load biaya daftar ulang dari API resmi:
 * GET /api/re_registration_fees  -> { success: true, items: [{ label, key, spp, uangPangkal: { pakaian, sarpras, kasur, kitab, bp3 }}, ...] }
 * Disimpan di cache (in-memory) agar irit fetch.
 */
async function loadFeesOnce() {
  if (_feesCache) return _feesCache;
  const r = await fetch("/api/re_registration_fees", { cache: "no-store" });
  if (!r.ok) throw new Error("Gagal memuat re_registration_fees");
  const j = await r.json();
  const items = Array.isArray(j?.items) ? j.items : [];
  // bentuk map by label (label = jenjang)
  const map = new Map();
  for (const it of items) {
    const label = String(it?.label || "").trim();
    if (!label) continue;
    const spp = Number(it?.spp || 0);
    const up = it?.uangPangkal || {};
    const pakaian = Number(up?.pakaian || 0);
    const sarpras = Number(up?.sarpras || 0);
    const kasur = Number(up?.kasur || 0);
    const kitab = Number(up?.kitab || 0);
    const bp3 = Number(up?.bp3 || 0);
    map.set(label, {
      spp,
      pangkal: {
        items: [
          { label: "Pakaian", amount: pakaian },
          { label: "Sarpras", amount: sarpras },
          { label: "Kasur", amount: kasur },
          { label: "Kitab", amount: kitab },
          { label: "BP3", amount: bp3 },
        ],
      },
    });
  }
  _feesCache = map;
  return _feesCache;
}

/**
 * Hitung biaya untuk jenjang tertentu berdasarkan data API.
 * @returns {Promise<{spp:number, pangkal:{items:{label,amount}[], total:number}, total:number}>}
 */
export async function computeFeesForLevel(level) {
  const map = await loadFeesOnce();
  const entry = map.get(String(level || "").trim()) || { spp: 0, pangkal: { items: [] } };
  const items = (entry.pangkal?.items || []).map((it) => ({
    label: String(it.label || "—"),
    amount: Number(it.amount || 0),
  }));
  const pangkalTotal = items.reduce((a, b) => a + b.amount, 0);
  return {
    spp: Number(entry.spp || 0),
    pangkal: { items, total: pangkalTotal },
    total: Number(entry.spp || 0) + pangkalTotal,
  };
}

/**
 * Terapkan potongan PTK (aturan sama seperti sebelumnya).
 * - sourceKey === "spp" -> kurangi SPP dahulu (min 0) lalu + pangkalTotal
 * - lainnya -> potong total (min 0)
 */
export function applyPTKDiscount(fee, discountDoc) {
  if (!discountDoc) return fee.total;
  const amt = Number(discountDoc.amount || 0);
  const key = String(discountDoc.sourceKey || "").toLowerCase();

  const spp = Number(fee.spp || 0);
  const pangkal = Number(fee.pangkal?.total || 0);

  if (key === "spp") {
    const sppAfter = Math.max(spp - amt, 0);
    return sppAfter + pangkal;
  }
  return Math.max(spp + pangkal - amt, 0);
}
