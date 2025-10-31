// app/admin/geografi/components/GeoTopTables.js
"use client";

function Table({ title, headers, rows }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 text-sm font-semibold text-slate-900">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-800">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
              {headers.map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="text-slate-900">
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-3 py-4 text-center text-slate-600">Tidak ada data.</td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-slate-50/50" : ""}>
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GeoTopTables({ stats, provNameOf, regNameOf, distNameOf }) {
  const total = stats.total || 0;
  const pct = stats.pct || ((n) => 0);

  const provRows = (stats.topProv || []).map(([code, n]) => [
    provNameOf(code),
    n,
    `${pct(n).toFixed(1)}%`,
    code,
  ]);

  const regRows = (stats.topReg || []).map(([code, n]) => [
    regNameOf(code),
    n,
    `${pct(n).toFixed(1)}%`,
    code,
  ]);

  const distRows = (stats.topDist || []).map(([code, n]) => [
    distNameOf(code),
    n,
    `${pct(n).toFixed(1)}%`,
    code,
  ]);

  const levelRows = [...(stats.byLevel || new Map()).entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([lv, n]) => [lv, n, `${pct(n).toFixed(1)}%`]);

  const addrRows = (stats.topAddr || []).map(([addrKey, n]) => [
    addrKey, n, `${pct(n).toFixed(1)}%`
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Table title="Top Provinsi" headers={["Provinsi", "Siswa", "% dari total", "Kode"]} rows={provRows} />
      <Table title="Top Kab/Kota" headers={["Kab/Kota", "Siswa", "% dari total", "Kode"]} rows={regRows} />
      <Table title="Top Kecamatan" headers={["Kecamatan", "Siswa", "% dari total", "Kode"]} rows={distRows} />
      <Table title="Breakdown Jenjang" headers={["Jenjang", "Siswa", "% dari total"]} rows={levelRows} />
      <Table title="Alamat Terbanyak (potongan)" headers={["Alamat (awal)", "Siswa", "% dari total"]} rows={addrRows} />
     
    </div>
  );
}
