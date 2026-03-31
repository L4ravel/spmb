"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";

import { QRCodeImg, buildSuratURL } from "@/app/portal/barcode";

/* ========= Utils ========= */
function fmtIDR(n, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));
}

function fmtDateTime(val) {
  try {
    const d = val?.toDate?.() ?? (val ? new Date(val) : new Date());
    return d.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
  } catch {
    return String(val || "");
  }
}

function formatTanggalSurat(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const tgl = dt.getDate();
  const bulan = dt.toLocaleDateString("id-ID", { month: "long" });
  const tahun = dt.getFullYear();
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${tgl} ${cap(bulan)} ${tahun}`;
}

/* ========= Ambil fee berdasar level ========= */
async function getFeeByLevel(db, level) {
  const feesCol = collection(db, "fees");

  let snap = await getDocs(query(feesCol, where("label", "==", level), limit(1)));
  if (!snap.empty) {
    const d = snap.docs[0].data();
    return { amount: Number(d?.fee || 0), currency: d?.currency || "IDR" };
  }
  snap = await getDocs(query(feesCol, where("key", "==", level), limit(1)));
  if (!snap.empty) {
    const d = snap.docs[0].data();
    return { amount: Number(d?.fee || 0), currency: d?.currency || "IDR" };
  }
  const byId = await getDoc(doc(db, "fees", level));
  if (byId.exists()) {
    const d = byId.data();
    return { amount: Number(d?.fee || 0), currency: d?.currency || "IDR" };
  }
  return { amount: 0, currency: "IDR" };
}

/* ========= Page ========= */
export default function SuratDigitalPage({ params }) {
  // Next.js 15: params adalah Promise → unwrap dengan React.use()
  const { nisn: nisnRaw } = usePromise(params);
  const nisn = decodeURIComponent(nisnRaw || "");

  const [u, setU] = useState(null);
  const [fee, setFee] = useState({ amount: 0, currency: "IDR" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!nisn) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const usnap = await getDoc(doc(db, "users_app", nisn));
        if (!usnap.exists()) {
          setErr("Data tidak ditemukan.");
          setLoading(false);
          return;
        }
        const data = usnap.data() || {};
        setU({ id: usnap.id, ...data });

        const { amount, currency } = await getFeeByLevel(
          db,
          String(data?.registrationLevel || "")
        );
        setFee({ amount, currency });
      } catch (e) {
        console.error(e);
        setErr("Gagal memuat data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [nisn]);

  const urlSurat = useMemo(
    () =>
      buildSuratURL(
        nisn,
        typeof window !== "undefined" ? window.location.origin : undefined
      ),
    [nisn]
  );

  if (!nisn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 grid place-items-center px-3">
        <div className="bg-white rounded-2xl shadow-lg px-6 py-5 text-slate-700 max-w-md text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h2 className="text-base font-semibold mb-0.5">NISN Tidak Valid</h2>
          <p className="text-xs text-slate-500">Silakan periksa kembali link yang Anda akses</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-slate-900 mb-3"></div>
          <div className="text-slate-700 text-sm font-medium">Memuat data…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 grid place-items-center px-3">
        <div className="bg-white rounded-2xl shadow-lg px-6 py-5 max-w-md text-center">
          <div className="text-3xl mb-2">❌</div>
          <h2 className="text-base font-semibold text-rose-700 mb-0.5">Terjadi Kesalahan</h2>
          <p className="text-xs text-slate-600">{err}</p>
        </div>
      </div>
    );
  }

  // ===== Data utama & status verifikasi =====
  const regId = String(u?.registrationId || "-");
  const nama = String(u?.fullName || u?.name || "-");
  const level = String(u?.registrationLevel || "-");
  const method = String(u?.registrationPaymentMethod || "offline").toUpperCase();
  const verifiedAt = u?.registrationPaymentVerifiedAt ?? null;
  const paymentStatus = String(u?.registrationPaymentStatus || "").toLowerCase();
  const isVerified = paymentStatus === "verified";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 print:bg-white">
      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-5 sm:py-8 print:py-0">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden print:shadow-none print:rounded-none print:border-0">
          {/* Kop */}
          <div className="relative border-b-2 border-slate-700 pb-2 sm:pb-3">
            <Image
              src="/pdf/kop-pembayaran.png"
              alt="Kop"
              width={1600}
              height={300}
              priority
              className="w-full h-auto"
            />
          </div>

          {/* Content */}
          <div className="px-3 sm:px-8 py-5 sm:py-10">
            {/* Badge status */}
            <div className="flex justify-center mb-4 sm:mb-6 print:hidden">
              {isVerified ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs sm:text-sm font-semibold text-emerald-700">Terverifikasi</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs sm:text-sm font-semibold text-amber-700">Belum Terverifikasi</span>
                </div>
              )}
            </div>

            {/* Judul */}
            <h1 className="text-center text-base sm:text-xl font-bold tracking-wide text-slate-800 mb-4 sm:mb-8">
              BUKTI PEMBAYARAN PENDAFTARAN
            </h1>

            {/* Pembuka */}
            <p className="text-xs sm:text-[0.95rem] leading-relaxed text-slate-700 mb-4 sm:mb-6">
              Yang bertanda tangan di bawah ini menerangkan bahwa telah diterima pembayaran biaya
              pendaftaran dari:
            </p>

            {/* Info compact */}
            <div className="space-y-1.5 sm:space-y-2 mb-5 sm:mb-6">
              {[
                ["ID Pendaftaran", regId],
                ["NISN", nisn],
                ["Nama", nama],
                ["Jenjang", level],
                ["Metode Pembayaran", method],
                ["NOMINAL", fmtIDR(fee.amount, fee.currency)],
                ["Waktu Verifikasi", isVerified ? fmtDateTime(verifiedAt) : "-"],
              ].map(([label, val], i) => (
                <div
                  key={i}
                  className="flex flex-wrap sm:flex-nowrap items-center py-1 sm:py-1.5 px-2 sm:px-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-semibold text-slate-600 w-full sm:w-48">
                    {label}
                  </span>
                  <span className="hidden sm:block text-slate-400 w-4 text-center">:</span>
                  <span className="text-xs sm:text-sm text-slate-800 font-medium sm:pl-4 break-words max-w-full">
                    {val}
                  </span>
                </div>
              ))}
            </div>

            {/* Penutup */}
            <p className="text-xs sm:text-[0.95rem] leading-relaxed text-slate-700 mb-6 sm:mb-8">
              Demikian bukti pembayaran ini dibuat untuk dipergunakan sebagaimana mestinya.
            </p>

            {/* Signature (lebih padat di mobile) */}
            <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 sm:gap-8">
              <div className="flex-shrink-0 self-center sm:self-auto">
                <div className="p-2.5 sm:p-3 bg-white rounded-xl border-2 border-slate-200 shadow-sm mx-auto sm:mx-0">
                  <QRCodeImg nisn={nisn} size={110} />
                </div>
                <p className="text-[10px] sm:text-xs text-center text-slate-500 mt-1.5 sm:mt-2">
                  Scan untuk verifikasi
                </p>
              </div>

              <div className="text-center sm:text-right flex-1">
                <div className="text-xs sm:text-sm text-slate-700 mb-0.5 sm:mb-1">
                  Bagik Nyaka, {formatTanggalSurat(new Date())}
                </div>
                <div className="text-sm sm:text-sm font-bold text-slate-800 mb-8 sm:mb-12">
                  Panitia SPMB
                </div>
                <div className="text-xs sm:text-sm text-slate-800 font-medium border-t border-slate-300 inline-block pt-1 px-4 sm:px-6">
                  Lalu Wirasandi, S.Pd
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 sm:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start gap-2.5 sm:gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-[11px] sm:text-xs font-medium text-slate-600 mb-0.5 sm:mb-1">Catatan Penting</p>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                  {isVerified
                    ? "Simpan bukti pembayaran ini dengan baik. Dokumen ini tidak memerlukan tanda tangan basah karena telah terverifikasi dalam sistem."
                    : "Dokumen ini belum terverifikasi. Mohon tunggu proses verifikasi panitia atau hubungi kontak resmi jika diperlukan."}
                </p>
              </div>
            </div>

            {/* Link verifikasi */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-200 print:hidden break-all">
              <p className="text-[11px] sm:text-xs text-slate-500 mb-1.5 sm:mb-2">Link verifikasi dokumen:</p>
              <a
                href={urlSurat}
                target="_blank"
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-violet-600 hover:text-violet-700 font-medium break-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {urlSurat}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
