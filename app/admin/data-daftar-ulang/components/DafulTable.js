// app/admin/data-daftar-ulang/components/DafulTable.js
"use client";

import { fmtIDR } from "../lib/money";

function amtFrom(pangkal, key) {
  if (!pangkal?.items?.length) return 0;
  const k = String(key).toLowerCase();
  const found = pangkal.items.find(
    (it) => String(it?.label || "").toLowerCase() === k
  );
  return Number(found?.amount || 0);
}

export default function DafulTable({ rows, loading }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[1200px] w-full text-sm">
        {/* ====== HEADER ====== */}
        <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
          {/* Baris 1: header utama, Uang Pangkal digabung */}
          <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-center [&>th]:font-semibold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wide">
            <th style={{ width: 56 }} rowSpan={2}>
              No
            </th>
            <th style={{ width: 120 }} rowSpan={2}>NISN</th>
            <th style={{ width: 220 }} rowSpan={2}>Nama</th>
            <th style={{ width: 160 }} rowSpan={2}>Jenjang</th>
            <th style={{ width: 120 }} rowSpan={2}>Status</th>
            <th style={{ width: 140 }} rowSpan={2}>SPP</th>
            <th colSpan={6} className="border-x border-slate-200">Uang Pangkal</th>
            <th style={{ width: 160 }} rowSpan={2}>Jumlah<br/>Dibayar</th>
            <th style={{ width: 180 }} rowSpan={2}>Keterangan</th>
          </tr>
          {/* Baris 2: subkolom Uang Pangkal */}
          <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-center [&>th]:font-medium [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wide [&>th]:border-x [&>th]:border-slate-200">
            <th style={{ width: 120 }}>Pakaian</th>
            <th style={{ width: 120 }}>Sarpras</th>
            <th style={{ width: 120 }}>Kasur</th>
            <th style={{ width: 120 }}>Kitab</th>
            <th style={{ width: 120 }}>BP3</th>
            <th style={{ width: 140 }}>Total</th>
          </tr>
        </thead>

        {/* ====== BODY ====== */}
        <tbody className="text-slate-900 divide-y divide-slate-100">
          {(!rows || rows.length === 0) && (
            <tr>
              <td colSpan={15} className="px-4 py-16 text-center text-slate-500">
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">Memuat data…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <span className="text-sm font-medium">Tidak ada data</span>
                  </div>
                )}
              </td>
            </tr>
          )}

          {rows?.map((r, i) => {
            const pakaian = amtFrom(r.pangkal, "pakaian");
            const sarpras = amtFrom(r.pangkal, "sarpras");
            const kasur   = amtFrom(r.pangkal, "kasur");
            const kitab   = amtFrom(r.pangkal, "kitab");
            const bp3     = amtFrom(r.pangkal, "bp3");
            const pangkalTotal = Number(r?.pangkal?.total || (pakaian + sarpras + kasur + kitab + bp3));

            const isLunas = r.tunggakan <= 0 && r.kewajibanTotal > 0;

            return (
              <tr key={r.id || r.nisn} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                {/* No */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                    {i + 1}
                  </span>
                </td>

                <td className="px-4 py-3 text-center font-mono text-slate-700 font-medium">{r.nisn || r.username}</td>
                <td className="px-4 py-3 text-center font-semibold text-slate-800">{r.fullName || "-"}</td>
                <td className="px-4 py-3 text-center text-slate-600 font-medium">{r.level || "-"}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                      r.status === "PTK"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.status || "Non-PTK"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-bold text-slate-800">{fmtIDR(r.spp || 0)}</td>

                {/* Subkolom Uang Pangkal - CENTER */}
                <td className="px-4 py-3 text-center text-slate-700 font-semibold bg-slate-50/30 border-x border-slate-100">{fmtIDR(pakaian)}</td>
                <td className="px-4 py-3 text-center text-slate-700 font-semibold bg-slate-50/30 border-x border-slate-100">{fmtIDR(sarpras)}</td>
                <td className="px-4 py-3 text-center text-slate-700 font-semibold bg-slate-50/30 border-x border-slate-100">{fmtIDR(kasur)}</td>
                <td className="px-4 py-3 text-center text-slate-700 font-semibold bg-slate-50/30 border-x border-slate-100">{fmtIDR(kitab)}</td>
                <td className="px-4 py-3 text-center text-slate-700 font-semibold bg-slate-50/30 border-x border-slate-100">{fmtIDR(bp3)}</td>
                <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-50/50 border-x border-slate-100">{fmtIDR(pangkalTotal)}</td>

                <td className="px-4 py-3 text-center font-bold text-slate-900">
                  {fmtIDR(r.totalPaid || 0)}
                </td>
                <td className="px-4 py-3 text-center">
                  {isLunas ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1.5 text-xs text-emerald-700 font-semibold">
                      ✓ Lunas
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 font-semibold">
                        Belum Lunas
                      </span>
                      <span className="text-xs text-amber-700 font-semibold">
                        {fmtIDR(Math.max(r.tunggakan || 0, 0))}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}