// app/admin/statistik-daftar-ulang/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  collectionGroup,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { BarChart3, CreditCard, Wallet, Users, Filter, RefreshCw } from "lucide-react";

/* ==== Firebase init (reuse env config) ==== */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function fmtIDR(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function fmtDateTime(d) {
  if (!d) return "-";
  try {
    const date = typeof d.toDate === "function" ? d.toDate() : d;
    return date.toLocaleString("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "-";
  }
}

/**
 * Tanggal efektif untuk filter waktu.
 * Prioritas: reviewedAt > createdAt
 */
function getEffectiveDate(p) {
  const ts = p.reviewedAt || p.createdAt;
  if (!ts) return null;
  try {
    if (typeof ts.toDate === "function") {
      return ts.toDate();
    }
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Klasifikasi metode pembayaran: OFFLINE (panitia) vs ONLINE (user)
 * - Jika method === "OFFLINE" atau source === "ADMIN_PANEL" -> OFFLINE
 * - Selain itu dianggap ONLINE
 */
function resolvePaymentMethod(pLike) {
  const method = String(pLike?.method || "").toUpperCase();
  const source = String(pLike?.source || "").toUpperCase();

  if (method === "OFFLINE" || source === "ADMIN_PANEL") {
    return "OFFLINE";
  }

  if (["ONLINE", "GATEWAY", "VIRTUAL_ACCOUNT", "TRANSFER"].includes(method)) {
    return "ONLINE";
  }

  return "ONLINE";
}


/**
 * Lengkapi data pembayaran dengan info user dari koleksi users_app/{nisn}
 * - fullName  -> userFullName
 * - registrationLevel -> userRegistrationLevel
 */
async function enrichPaymentsWithUserInfo(rows) {
  if (!rows?.length) return rows || [];

  const nisnSet = new Set();
  for (const p of rows) {
    if (p?.nisn) {
      nisnSet.add(String(p.nisn));
    }
  }

  if (!nisnSet.size) return rows;

  const userMap = {};

  await Promise.all(
    Array.from(nisnSet).map(async (nisn) => {
      try {
        const snap = await getDoc(doc(db, "users_app", nisn));
        if (snap.exists()) {
          const d = snap.data() || {};
          userMap[nisn] = {
            fullName: d.fullName || "",
            registrationLevel: d.registrationLevel || "",
          };
        }
      } catch (err) {
        console.error("Gagal mengambil users_app untuk NISN", nisn, err);
      }
    })
  );

  return rows.map((p) => {
    const key = p?.nisn ? String(p.nisn) : null;
    const meta = key ? userMap[key] : null;

    return {
      ...p,
      userFullName:
        meta?.fullName ||
        p.userFullName ||
        p.student?.name ||
        "",
      userRegistrationLevel:
        meta?.registrationLevel ||
        p.userRegistrationLevel ||
        p.student?.jenjang ||
        p.registrationLevel ||
        "",
    };
  });
}


function applyTimeFilter(payments, range, customStart, customEnd) {
  if (!payments?.length) return [];

  if (range === "all") {
    return payments;
  }

  let start = null;
  let end = null;
  const now = new Date();

  if (range === "today") {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
  } else if (range === "7d") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (range === "30d") {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (range === "custom") {
    if (customStart) {
      start = new Date(customStart + "T00:00:00");
    }
    if (customEnd) {
      end = new Date(customEnd + "T23:59:59");
    }
  }

  return payments.filter((p) => {
    const d = getEffectiveDate(p);
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function buildStats(payments) {
  const summary = {
    totalCount: 0,
    totalAmount: 0,
    offlineCount: 0,
    offlineAmount: 0,
    onlineCount: 0,
    onlineAmount: 0,
    reviewers: [],
  };

  if (!payments?.length) {
    return summary;
  }

  const byReviewer = new Map();

  for (const p of payments) {
    const amount = Number(p.amount || 0);
    const method = resolvePaymentMethod(p);
    const isOffline = method === "OFFLINE";
    const reviewerKey = p.reviewer || "Tidak diketahui";

    summary.totalCount += 1;
    summary.totalAmount += amount;

    if (isOffline) {
      summary.offlineCount += 1;
      summary.offlineAmount += amount;
    } else {
      summary.onlineCount += 1;
      summary.onlineAmount += amount;
    }

    let r = byReviewer.get(reviewerKey);
    if (!r) {
      r = {
        reviewer: reviewerKey,
        totalCount: 0,
        totalAmount: 0,
        offlineCount: 0,
        onlineCount: 0,
        lastReviewedAt: null,
      };
      byReviewer.set(reviewerKey, r);
    }

    r.totalCount += 1;
    r.totalAmount += amount;
    if (isOffline) r.offlineCount += 1;
    else r.onlineCount += 1;

    const d = getEffectiveDate(p);
    if (d && (!r.lastReviewedAt || d > r.lastReviewedAt)) {
      r.lastReviewedAt = d;
    }
  }

  summary.reviewers = Array.from(byReviewer.values()).sort(
    (a, b) => b.totalCount - a.totalCount
  );

  return summary;
}

function StatCard({ icon: Icon, label, value, sub, onClick }) {
  const clickable = typeof onClick === "function";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        "rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-center gap-4",
        clickable
          ? "cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all"
          : "",
      ].join(" ")}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
        <Icon className="h-5 w-5 text-emerald-700" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
        {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
      </div>
    </div>
  );
}


export default function StatistikDaftarUlangPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [authReady, setAuthReady] = useState(false);

  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [range, setRange] = useState("7d"); // 'today' | '7d' | '30d' | 'all' | 'custom'
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
    const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState(null); 
  const [detailRows, setDetailRows] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAdminEmail(user?.email || "");
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let alive = true;

    async function fetchPayments() {
      setLoading(true);
      setLoadError("");

      try {
        const paymentsGroup = collectionGroup(db, "payments");
        const q = query(
          paymentsGroup,
          where("status", "==", "APPROVED"),
          limit(5000)
        );
        const snap = await getDocs(q);

        if (!alive) return;

                const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};

          // Ambil NISN dari path: users_app/{nisn}/payments/{paymentId}
          const ref = docSnap.ref;
          const parentUserDoc = ref.parent && ref.parent.parent;
          const nisnFromPath = parentUserDoc ? parentUserDoc.id : null;

          rows.push({
            id: docSnap.id,
            ...data,
            // Simpan nisn supaya bisa dipakai enrichPaymentsWithUserInfo
            nisn: data.nisn || nisnFromPath || null,
          });
        });

        // Lengkapi dengan fullName & registrationLevel dari users_app
        const enriched = await enrichPaymentsWithUserInfo(rows);


        setAllPayments(enriched);
      } catch (err) {
        console.error("Failed to load statistik daftar ulang", err);
        setLoadError("Gagal memuat data pembayaran. Silakan coba lagi.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchPayments();

    return () => {
      alive = false;
    };
  }, [authReady]);

  const filteredPayments = useMemo(
    () => applyTimeFilter(allPayments, range, customStart, customEnd),
    [allPayments, range, customStart, customEnd]
  );

  const stats = useMemo(
    () => buildStats(filteredPayments),
    [filteredPayments]
  );

  const offlinePayments = useMemo(
    () =>
      filteredPayments.filter(
        (p) => resolvePaymentMethod(p) === "OFFLINE"
      ),
    [filteredPayments]
  );

  const onlinePayments = useMemo(
    () =>
      filteredPayments.filter(
        (p) => resolvePaymentMethod(p) === "ONLINE"
      ),
    [filteredPayments]
  );

   const handleOpenDetail = (type) => {
    setDetailType(type);
    if (type === "OFFLINE") {
      setDetailRows(offlinePayments);
    } else if (type === "ONLINE") {
      setDetailRows(onlinePayments);
    } else {
      setDetailRows([]);
    }
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailType(null);
    setDetailRows([]);
  };

  // Jika filter waktu berubah saat popup terbuka, sinkronkan ulang datanya
  useEffect(() => {
    if (!detailOpen || !detailType) return;
    if (detailType === "OFFLINE") {
      setDetailRows(offlinePayments);
    } else if (detailType === "ONLINE") {
      setDetailRows(onlinePayments);
    }
  }, [detailOpen, detailType, offlinePayments, onlinePayments]);

  const showCustomRange = range === "custom";

  return (
      <div className="min-h-screen bg-white">
    <div className="w-full px-4 py-6 md:px-8 md:py-8">

              {detailOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Detail pembayaran{" "}
                  {detailType === "OFFLINE" ? "offline (panitia)" : "online (user)"}
                </h2>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Tutup
                </button>
              </div>

              <div className="px-6 py-3 text-xs text-slate-600 flex items-center justify-between">
                <span>
                  Total data:{" "}
                  <span className="font-semibold text-slate-900">
                    {detailRows.length.toLocaleString("id-ID")}
                  </span>
                </span>
                <span>
                  Nominal:{" "}
                  <span className="font-semibold text-emerald-700">
                    {fmtIDR(
                      detailRows.reduce(
                        (sum, p) => sum + Number(p.amount || 0),
                        0
                      )
                    )}
                  </span>
                </span>
              </div>

              <div className="px-6 pb-5">
                {detailRows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Belum ada pembayaran untuk kategori ini pada rentang waktu
                    yang dipilih.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] border border-slate-200 rounded-2xl">
                    <table className="min-w-full text-xs md:text-sm text-left text-slate-900 bg-white">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 font-semibold text-slate-900">
                            No
                          </th>
                          <th className="px-3 py-2 font-semibold text-slate-900">
                            Nama
                          </th>
                          <th className="px-3 py-2 font-semibold text-slate-900">
                            Jenjang
                          </th>
                          <th className="px-3 py-2 font-semibold text-slate-900 text-right">
                            Jumlah bayar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((p, idx) => (
                          <tr
                            key={p.id || idx}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-3 py-2 align-top">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 align-top">
  {p.userFullName || p.student?.name || "-"}
</td>
<td className="px-3 py-2 align-top">
  {p.userRegistrationLevel ||
    p.student?.jenjang ||
    p.registrationLevel ||
    "-"}
</td>
                            <td className="px-3 py-2 align-top text-right">
                              {fmtIDR(p.amount || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

    
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-600" />
              Statistik Pembayaran Daftar Ulang
            </h1>           
            {adminEmail ? (
              <p className="mt-1 text-xs text-slate-500">
                Masuk sebagai:{" "}
                <span className="font-medium">{adminEmail}</span>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs md:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Segarkan
          </button>
        </div>

        {/* Filter waktu */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter className="h-4 w-4 text-emerald-600" />
                Filter waktu
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Berdasarkan tanggal verifikasi pembayaran                
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: "today", label: "Hari ini" },
                { id: "7d", label: "7 hari" },
                { id: "30d", label: "30 hari" },
                { id: "all", label: "Semua" },
                { id: "custom", label: "Custom" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRange(opt.id)}
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs md:text-sm font-medium transition-colors",
                    range === opt.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {showCustomRange && (
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">
                <span className="w-16">Dari</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs md:text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">
                <span className="w-16">Sampai</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs md:text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Ringkasan utama */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            icon={CreditCard}
            label="Total disetujui"
            value={stats.totalCount.toLocaleString("id-ID")}
            sub={fmtIDR(stats.totalAmount)}
          />
          <StatCard
            icon={Wallet}
            label="Pembayaran offline (panitia)"
            value={stats.offlineCount.toLocaleString("id-ID")}
            sub={fmtIDR(stats.offlineAmount)}
            onClick={() => handleOpenDetail("OFFLINE")}
          />
          <StatCard
            icon={Users}
            label="Pembayaran online (user)"
            value={stats.onlineCount.toLocaleString("id-ID")}
            sub={fmtIDR(stats.onlineAmount)}
            onClick={() => handleOpenDetail("ONLINE")}
          />
        </div>

        {/* Info jumlah data */}
        <div className="mt-4 text-xs text-slate-500">
          Menampilkan{" "}
          <span className="font-semibold">
            {filteredPayments.length.toLocaleString("id-ID")}
          </span>{" "}
          pembayaran yang sesuai filter.
        </div>

        {/* Tabel per reviewer */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Rekap per penyetuju
              </p>
              <p className="text-xs text-slate-500">
                Siapa saja yang menyetujui pembayaran dan berapa banyak yang
                offline / online.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Memuat data statistik...
            </div>
          ) : loadError ? (
            <div className="py-8 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : !stats.reviewers.length ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Belum ada pembayaran yang sesuai filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full w-full text-xs md:text-sm text-left text-slate-900">
  <thead>
    <tr className="border-b border-slate-300 bg-white">
      <th className="px-3 py-3 font-semibold text-slate-900">
        Penyetuju (reviewer)
      </th>
      <th className="px-3 py-3 font-semibold text-slate-900 text-right">
        Total
      </th>
      <th className="px-3 py-3 font-semibold text-slate-900 text-right">
        Offline
      </th>
      <th className="px-3 py-3 font-semibold text-slate-900 text-right">
        Online
      </th>
      <th className="px-3 py-3 font-semibold text-slate-900 text-right">
        Nominal
      </th>
      <th className="px-3 py-3 font-semibold text-slate-900">
        Terakhir verifikasi
      </th>
    </tr>
  </thead>
  <tbody>
    {stats.reviewers.map((r) => (
      <tr
        key={r.reviewer}
        className="border-b border-slate-200 last:border-0 hover:bg-slate-50"
      >
        <td className="px-3 py-3 align-top">
          <div className="flex flex-col">
            <span className="font-medium text-slate-900">
              {r.reviewer}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 text-right align-top">
          {r.totalCount.toLocaleString("id-ID")}
        </td>
        <td className="px-3 py-3 text-right align-top">
          {r.offlineCount.toLocaleString("id-ID")}
        </td>
        <td className="px-3 py-3 text-right align-top">
          {r.onlineCount.toLocaleString("id-ID")}
        </td>
        <td className="px-3 py-3 text-right align-top">
          {fmtIDR(r.totalAmount)}
        </td>
        <td className="px-3 py-3 align-top text-slate-900">
          {fmtDateTime(r.lastReviewedAt)}
        </td>
      </tr>
    ))}
  </tbody>
</table>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
