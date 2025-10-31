// app/admin/geografi/components/StatsCards.js
"use client";

import { Users, MapPin, Building2, Landmark, GraduationCap } from "lucide-react";

function Card({ icon:Icon, title, value, hint, tone="slate" }) {
  const toneCls = {
    slate: "from-slate-50 to-slate-100 border-slate-200 text-slate-800",
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800",
    violet: "from-violet-50 to-violet-100 border-violet-200 text-violet-800",
    sky: "from-sky-50 to-sky-100 border-sky-200 text-sky-800",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-800",
  }[tone] || "";
  return (
    <div className={`rounded-xl border ${toneCls} bg-gradient-to-br p-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/60 border">{Icon && <Icon className="h-5 w-5" />}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xl font-extrabold tabular-nums">{value}</div>
          {hint && <div className="text-[12px] text-slate-600 mt-1">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export default function StatsCards({ stats, provMap, regMap, distMap }) {
  const total = stats.total || 0;
  const topProv = stats.topProv?.[0];
  const topReg  = stats.topReg?.[0];
  const topDist = stats.topDist?.[0];

  const topProvName = topProv ? (provMap.get(topProv[0]) || topProv[0]) : "—";
  const topRegName  = topReg  ? (regMap.get(topReg[0])   || topReg[0])   : "—";
  const topDistName = topDist ? (distMap.get(topDist[0]) || topDist[0]) : "—";

  // Jenjang terpopuler
  const levelEntries = [...(stats.byLevel || new Map()).entries()].sort((a,b)=>b[1]-a[1]);
  const topLevel = levelEntries[0] || ["—", 0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Card icon={Users} title="Total Siswa (filter)" value={total} hint="Jumlah baris setelah filter" tone="emerald" />
      <Card icon={MapPin} title="Provinsi Terbanyak" value={topProv ? `${topProv[1]} siswa` : "—"} hint={topProvName} tone="violet" />
      <Card icon={Building2} title="Kab/Kota Terbanyak" value={topReg ? `${topReg[1]} siswa` : "—"} hint={topRegName} tone="sky" />
      <Card icon={Landmark} title="Kecamatan Terbanyak" value={topDist ? `${topDist[1]} siswa` : "—"} hint={topDistName} tone="amber" />
      <Card icon={GraduationCap} title="Jenjang Terbanyak" value={`${topLevel[0]} — ${topLevel[1]}`} hint={`Dari total ${total}`} />
    </div>
  );
}
