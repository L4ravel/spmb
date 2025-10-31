// app/admin/data-daftar-ulang/lib/money.js
export function fmtIDR(n = 0) {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
      Number(n) || 0
    );
  } catch {
    const v = Math.round(Number(n) || 0).toString();
    return "Rp " + v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
}
