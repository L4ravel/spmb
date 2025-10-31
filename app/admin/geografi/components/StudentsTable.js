// app/admin/geografi/components/StudentsTable.js
"use client";

export default function StudentsTable({ rows, provMap, regMap, distMap, loading }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
            <th>Username</th>
            <th>Nama</th>
            <th>Jenjang</th>
            <th>Provinsi</th>
            <th>Kab/Kota</th>
            <th>Kecamatan</th>
            <th>Alamat Lengkap</th>
          </tr>
        </thead>
        <tbody className="text-slate-900">
          {(!rows || rows.length === 0) && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-600">
                {loading ? "Memuat data…" : "Tidak ada data yang sesuai filter."}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id} className={i % 2 ? "bg-slate-50/50" : ""}>
              <td className="px-3 py-2 font-mono">{r.username}</td>
              <td className="px-3 py-2">{r.fullName || "—"}</td>
              <td className="px-3 py-2 text-slate-700">{r.level || "—"}</td>
              <td className="px-3 py-2">{provMap.get(r.provinceCode) || "—"}</td>
              <td className="px-3 py-2">{regMap.get(r.regencyCode)  || "—"}</td>
              <td className="px-3 py-2">{distMap.get(r.districtCode) || "—"}</td>
              <td className="px-3 py-2">{r.addressLine || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
