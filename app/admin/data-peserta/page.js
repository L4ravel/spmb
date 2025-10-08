"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
/* =============== Firebase init =============== */
function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}
const app = getFirebaseApp();
const db = getFirestore(app);

/* =============== Utils =============== */
const isPaid = (u) =>
  u?.verifiedPayment === true ||
  u?.registrationPaymentStatus === "verified" ||
  u?.reRegistrationPaymentStatus === "verified";

const groupNameOf = (label) => (/\(S1\)/i.test(label || "") ? "Universitas" : "Sekolah");
const human = (n) => new Intl.NumberFormat("id-ID").format(n);

/* =============== Page =============== */
export default function DataPesertaPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function fetchUsers() {
    setLoading(true);
    setErr("");
    try {
      const q = query(collection(db, "users_app"), limit(5000));
 const snap = await getDocs(q);
      const arr = [];
      snap.forEach((d) => {
        const x = d.data() || {};
        arr.push({
          id: d.id,
          registrationLevel: (x.registrationLevel || "").toString().trim(),
          verifiedPayment: !!x.verifiedPayment,
          registrationPaymentStatus: x.registrationPaymentStatus || "",
          reRegistrationPaymentStatus: x.reRegistrationPaymentStatus || "",
        });
      });
      setRows(arr);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Gagal memuat data peserta.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  // Rekap per jenjang
  const byLevel = useMemo(() => {
    const acc = {};
    for (const u of rows) {
      const label = u.registrationLevel || "(Tanpa Jenjang)";
      if (!acc[label]) acc[label] = { total: 0, paid: 0, group: groupNameOf(label) };
      acc[label].total += 1;
      if (isPaid(u)) acc[label].paid += 1;
    }
    return acc;
  }, [rows]);

  // Urutkan: Sekolah lalu Universitas
  const sections = useMemo(() => {
    const sekolah = [];
    const univ = [];
    Object.entries(byLevel).forEach(([label, v]) => {
      (v.group === "Universitas" ? univ : sekolah).push({ label, ...v });
    });
    sekolah.sort((a, b) => a.label.localeCompare(b.label, "id"));
    univ.sort((a, b) => a.label.localeCompare(b.label, "id"));
    return [
      { name: "Sekolah", items: sekolah },
      { name: "Universitas", items: univ },
    ];
  }, [byLevel]);

  const totalAll = rows.length;
  const totalPaidAll = rows.reduce((s, u) => s + (isPaid(u) ? 1 : 0), 0);

  return (
    <div className="min-h-screen bg-white flex flex-col">    
      

      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Rekap Pendaftaran
            </h1>
            <p className="text-sm text-slate-700">
              Ringkasan jumlah pendaftar dan yang sudah bayar (verified) per jenjang.
            </p>
          </div>
          <button
            onClick={fetchUsers}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title="Muat ulang data"
          >
            ↻ Muat Ulang
          </button>
        </div>

        {/* KPI total */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <KPI label="Total Pendaftar" value={human(totalAll)} border="border-slate-300" />
          <KPI label="Sudah Bayar (Verified)" value={human(totalPaidAll)} border="border-emerald-300" />
          <KPI
            label="% Bayar"
            value={`${totalAll ? Math.round((totalPaidAll / totalAll) * 100) : 0}%`}
            border="border-indigo-300"
          />
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-300 p-4">
                <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="mt-3 h-8 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="mt-2 h-4 w-32 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {err && !loading && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 p-3 mb-4 font-medium">
            {err}
          </div>
        )}

        {/* Sections */}
        {!loading && !err && sections.map((sec) => (
          <section key={sec.name} className="mb-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">{sec.name}</h2>
              <span className="text-sm font-medium text-slate-700">
                {human(sec.items.reduce((s, it) => s + it.total, 0))} peserta •{" "}
                {human(sec.items.reduce((s, it) => s + it.paid, 0))} bayar
              </span>
            </div>

            {sec.items.length === 0 ? (
              <div className="rounded-lg border border-slate-300 p-4 text-slate-800">
                Tidak ada data.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sec.items.map((it) => {
                  const percent = it.total ? Math.round((it.paid / it.total) * 100) : 0;
                  return (
                    <Card key={it.label} category={sec.name} label={it.label}>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <MiniStat title="Pendaftar" value={human(it.total)} />
                        <MiniStat
                          title="Bayar"
                          value={human(it.paid)}
                          strong
                          border="border-emerald-300"
                          valueClass="text-emerald-700"
                        />
                        <MiniStat title="% Bayar" value={`${percent}%`} />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-emerald-600 transition-all"
                          style={{ width: `${percent}%` }}
                          aria-label={`Progress bayar ${percent}%`}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

/* ========= presentational small components ========= */

function KPI({ label, value, border = "border-slate-300" }) {
  return (
    <div className={`rounded-2xl border ${border} bg-white p-4 shadow-sm`}>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-1 text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
    </div>
  );
}

function Card({ category, label, children }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600">Jenjang</div>
          <div className="text-base md:text-lg font-bold text-slate-900 leading-snug">{label}</div>
        </div>
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
            category === "Universitas"
              ? "bg-indigo-100 text-indigo-800 ring-indigo-300"
              : "bg-slate-100 text-slate-800 ring-slate-300",
          ].join(" ")}
        >
          {category}
        </span>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ title, value, strong = false, border = "border-slate-300", valueClass = "" }) {
  const wrap = [
    "rounded-lg border", border, "p-3 text-center",
    strong ? "bg-emerald-50 ring-1 ring-emerald-300" : ""
  ].join(" ");
  const titleCls = [
    "text-[11px]",
    strong ? "font-semibold text-emerald-800" : "font-medium text-slate-700"
  ].join(" ");
  const valCls = [
    "text-xl md:text-2xl font-extrabold tracking-tight",
    strong ? "text-emerald-800" : "text-slate-900",
    valueClass,
  ].join(" ");
  return (
    <div className={wrap}>
      <div className={titleCls}>{title}</div>
      <div className={valCls}>{value}</div>
    </div>
  );
}

