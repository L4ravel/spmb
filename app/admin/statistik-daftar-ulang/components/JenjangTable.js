import { fmtIDR } from "../data";

export default function JenjangTable({ rows = [] }) {
  // Aggregate total untuk footer
  const total = rows.reduce(
    (acc, r) => {
      acc.pendapatan += Number(r?.pendapatan || 0);
      acc.tunggakan += Number(r?.tunggakan || 0);
      acc.lunas += Number(r?.lunas || 0);
      acc.nunggak += Number(r?.nunggak || 0);
      acc.buktiPending += Number(r?.buktiPending || 0);
      return acc;
    },
    { pendapatan: 0, tunggakan: 0, lunas: 0, nunggak: 0, buktiPending: 0 }
  );

  const moneyTd = (v, tone = "slate") => (
    <td
      className={[
        "px-4 py-2 text-right font-semibold tabular-nums",
        tone === "emerald" && "text-emerald-700",
        tone === "amber" && "text-amber-800",
        tone === "rose" && "text-rose-700",
        tone === "slate" && "text-slate-900",
      ].filter(Boolean).join(" ")}
    >
      {fmtIDR(v)}
    </td>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-50/90 backdrop-blur border-b border-slate-200">
          <tr className="text-left text-slate-900">
            <th className="px-4 py-2 font-semibold">Jenjang</th>
            <th className="px-4 py-2 font-semibold text-right">Pendapatan</th>
            <th className="px-4 py-2 font-semibold text-right">Tunggakan</th>
            <th className="px-4 py-2 font-semibold text-right">Lunas (org)</th>
            <th className="px-4 py-2 font-semibold text-right">Nunggak (org)</th>
            <th className="px-4 py-2 font-semibold text-right">Memiliki Bukti Pending (org)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-slate-700">
                Tidak ada data.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.jenjang} className={i % 2 ? "bg-slate-50/40" : ""}>
                <td className="px-4 py-2 font-semibold text-slate-900">{r.jenjang}</td>

                {/* Pendapatan: hijau kalau >0 */}
                {moneyTd(r.pendapatan, (r.pendapatan || 0) > 0 ? "emerald" : "slate")}

                {/* Tunggakan: merah/amber kalau >0 */}
                {moneyTd(r.tunggakan, (r.tunggakan || 0) > 0 ? "amber" : "slate")}

                {/* Lunas & Nunggak: angka kanan, warna konsisten */}
                <td className="px-4 py-2 text-right font-semibold text-emerald-700">
                  {r.lunas}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-amber-800">
                  {r.nunggak}
                </td>

                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                  {r.buktiPending}
                </td>
              </tr>
            ))
          )}
        </tbody>

        {/* FOOTER TOTAL */}
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100/80 border-t border-slate-200">
              <td className="px-4 py-2 font-bold text-slate-900">TOTAL</td>
              {moneyTd(total.pendapatan, total.pendapatan > 0 ? "emerald" : "slate")}
              {moneyTd(total.tunggakan, total.tunggakan > 0 ? "amber" : "slate")}
              <td className="px-4 py-2 text-right font-bold text-emerald-800">
                {total.lunas}
              </td>
              <td className="px-4 py-2 text-right font-bold text-amber-900">
                {total.nunggak}
              </td>
              <td className="px-4 py-2 text-right font-bold text-slate-900">
                {total.buktiPending}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
