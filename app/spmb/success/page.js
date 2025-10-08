"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  CircleUser,
  Key,
  FileText,
  Wallet,
  ShieldCheck,
  ClipboardCheck,
  Copy,
  Banknote,
  GraduationCap,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/* ===== Helpers ===== */
const BANK_NAME = "Bank Syariah Indonesia";
const BANK_ACCOUNT_NAME = "Ponpes As sunnah Bagek Nyaka";
const BANK_ACCOUNT_NUMBER = "1234 5678 9012";

function toIDR(n) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n ?? 0);
  } catch {
    return `Rp${String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }
}

function toSafeUpperSnake(s) {
  return (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");
}

// Helper: cek apakah jenjang adalah TK, SD, atau PPS Ula
const isEarlyEducation = (jenjang) => {
  const j = (jenjang || "").toLowerCase().trim();
  return (
    j === "tk" ||
    j === "sd" ||
    j === "sd putra" ||
    j === "sd putri" ||
    j.includes("pps") ||
    j.includes("ula") ||
    j.includes("putra") ||
    j.includes("putri")
  );
};

/** ========== INNER CLIENT COMPONENT (pakai useSearchParams) ========== */
function PPDBSuccessInner() {
  const searchParams = useSearchParams();

  const [data, setData] = useState({
    id: "",
    username: "", // username yang digunakan untuk login
    nama: "",
    jenjang: "",
  });
  const [loadingJenjang, setLoadingJenjang] = useState(false);

  // === Fee dinamis ===
  const [fee, setFee] = useState(null);
  const [loadingFee, setLoadingFee] = useState(false);

  // Ambil dari query string
  useEffect(() => {
    const id = searchParams.get("id");
    const username = searchParams.get("username"); // bisa NISN atau 8 digit NIK
    const nama = searchParams.get("nama");
    const jenjangQS = searchParams.get("jenjang");

    setData((prev) => ({
      ...prev,
      id: id || "",
      username: username || "",
      nama: nama ? decodeURIComponent(nama) : "",
      jenjang: jenjangQS ? decodeURIComponent(jenjangQS) : prev.jenjang,
    }));
  }, [searchParams]);

  // Jika query tidak bawa jenjang → fetch dari Firestore users_app/{username}
  useEffect(() => {
    async function fetchJenjang() {
      if (!data.username || data.jenjang) return;
      setLoadingJenjang(true);
      try {
        const ref = doc(db, "users_app", data.username);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          const jenjangDb = d?.registrationLevel || d?.jenjang || "";
          if (jenjangDb) {
            setData((s) => ({ ...s, jenjang: jenjangDb }));
          }
        }
      } catch (e) {
        console.error("Gagal mengambil jenjang:", e);
      } finally {
        setLoadingJenjang(false);
      }
    }
    fetchJenjang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.username]);

  // Ambil fee dari Firestore: fees/{KEY}
  useEffect(() => {
    async function fetchFee() {
      if (!data.jenjang) return;
      setLoadingFee(true);
      try {
        const key = toSafeUpperSnake(data.jenjang);
        const ref = doc(db, "fees", key);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          const val = Number(d?.fee ?? 0);
          setFee(Number.isFinite(val) ? val : 0);
        } else {
          setFee(0);
        }
      } catch (e) {
        console.error("Gagal mengambil fee:", e);
        setFee(0);
      } finally {
        setLoadingFee(false);
      }
    }
    fetchFee();
  }, [data.jenjang]);

  const copyRek = () => {
    const onlyDigits = BANK_ACCOUNT_NUMBER.replace(/[^\d]/g, "");
    navigator.clipboard?.writeText(onlyDigits);
  };

  // Tentukan label untuk username/password
  const isEarly = isEarlyEducation(data.jenjang);
  const credentialLabel = isEarly ? "8 Digit Terakhir NIK" : "NISN";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-3">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Pendaftaran Berhasil</h1>
          <p className="text-slate-600 mt-1">
            Data Anda sudah diterima. <b>Akun belum aktif</b> sampai pembayaran diverifikasi.
          </p>
        </div>

        {/* === Klasifikasi Pendaftaran === */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 p-4 border-b border-slate-200">
            <GraduationCap className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-semibold text-slate-900">Klasifikasi Pendaftaran</h2>
          </div>

          <div className="p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mt-1">
                <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 text-violet-800 border border-violet-200 px-3 py-1 text-sm font-semibold">
                  <GraduationCap className="h-4 w-4" />
                  Jenjang {loadingJenjang ? "Mengambil..." : (data.jenjang || "-")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== KARTU PEMBAYARAN (Aktivasi Akun) ===== */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Left: content */}
            <div className="flex-1 p-6 md:p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-violet-100 grid place-items-center">
                  <Wallet className="h-6 w-6 text-violet-700" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Aktivasi Akun • Pembayaran Pendaftaran
                  </h2>
                  <p className="text-xs text-slate-500">
                    Wajib dibayar oleh wali. Bisa transfer bank atau offline (stand panitia).
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-500">Nominal</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {loadingFee ? "Memuat..." : toIDR(fee ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-500">Status Akun</div>
                  <div className="mt-0.5 inline-flex items-left gap-2 rounded-xl bg-amber-100 px-3 py-1 text-amber-800 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 md:hidden" aria-hidden="true" />
                    <span>Pending Pembayaran</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-500">ID Pendaftaran</div>
                  <div className="font-mono text-slate-900">{data.id || "-"}</div>
                </div>
              </div>

              {/* Metode: Transfer Bank */}
              <div className="mt-5 rounded-2xl border border-slate-200">
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Banknote className="h-5 w-5 text-violet-600" />
                    <div className="text-sm font-semibold text-slate-900">Transfer Bank</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500 text-xs">Bank</div>
                      <div className="font-medium text-slate-900">{BANK_NAME}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500 text-xs">Nama Pemilik</div>
                      <div className="font-medium text-slate-900">{BANK_ACCOUNT_NAME}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500 text-xs">No. Rekening</div>
                      <div className="font-mono font-semibold text-slate-900">
                        {BANK_ACCOUNT_NUMBER}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={copyRek}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-white text-sm font-semibold hover:bg-violet-700"
                    >
                      <Copy className="h-4 w-4" />
                      Salin Nomor Rekening
                    </button>
                    <p className="text-xs text-slate-500">
                      Setelah transfer, tunjukkan bukti pembayaran kepada panitia untuk verifikasi.
                    </p>
                  </div>
                </div>
              </div>

              {/* Metode: Offline */}
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-800">
                <span className="text-sm">
                  <span className="text-center block">
                    <b>Catatan:</b> Pembayaran juga bisa dilakukan langsung di
                    <b> stand panitia pendaftaran</b>. Saat membayar, tunjukkan
                    <b> ID Pendaftaran</b> Anda.
                  </span>
                </span>
              </div>
            </div>

            {/* Right: panel informasi akun */}
            <div className="md:w-72 md:self-stretch relative overflow-hidden rounded-tr-[26px] rounded-br-[26px] bg-violet-600">
              <div className="absolute -top-16 -left-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-black/10 blur-3xl" />
              <div className="absolute inset-0 ring-1 ring-white/10" />

              <div className="relative h-full flex items-center">
                <div className="w-full px-6 md:px-7 py-8 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center backdrop-blur-sm">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold tracking-wide">
                      Informasi Akun
                    </h3>
                  </div>

                  <p className="text-[13px] leading-relaxed text-white/90">
                    Akun ini akan digunakan oleh calon Peserta Didik untuk:
                  </p>

                  <ul className="mt-3 space-y-2">
                    {[
                      "Mengikuti ujian Akademik",
                      "Mengikuti tes Al Qur&apos;an",
                      "Mengikuti tes Wawancara",
                      "Melihat hasil ujian dan pengumuman kelulusan",
                      "Jika status lulus, fitur daftar ulang akan diaktifkan",
                    ].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
                          <span className="h-2 w-2 rounded-full bg-white" />
                        </span>
                        <span className="text-[13px] leading-snug text-white/95">{t}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-lg bg-yellow-100 px-3 py-2 text-[12px] text-center leading-relaxed text-yellow-900 ring-1 ring-yellow-400">
                    Simpan <b>ID Pendaftaran</b> dan pastikan data login aman.
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-semibold shadow hover:bg-white/15 ring-1 ring-white/20"
                    >
                      Ke Halaman Login
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(data.id || "")}
                      className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-semibold shadow hover:bg-white/15 ring-1 ring-white/20"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Salin ID Pendaftaran
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Data Pendaftaran & Akun ===== */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Registration Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center mb-4">
              <FileText className="w-6 h-6 text-indigo-600 mr-3" />
              <h3 className="text-lg font-semibold text-slate-900">Data Pendaftaran</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-600">ID Pendaftaran</label>
                <p className="text-lg font-mono text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                  {data.id || "Loading..."}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Nama Siswa</label>
                <p className="text-lg text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                  {data.nama || "Loading..."}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Jenjang</label>
                <p className="text-lg text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                  {loadingJenjang ? "Memuat..." : (data.jenjang || "Loading...")}
                </p>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center mb-4">
              <CircleUser className="w-6 h-6 text-emerald-600 mr-3" />
              <h3 className="text-lg font-semibold text-slate-900">Akun Login</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-600">Username</label>
                <p className="text-lg font-mono text-slate-900 bg-emerald-50 px-3 py-2 rounded-lg">
                  {data.username || "Loading..."}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {isEarly ? "8 digit terakhir NIK Anda" : "NISN Anda"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 flex items-center">
                  <Key className="w-4 h-4 mr-1" />
                  Password
                </label>
                <p className="text-lg font-mono text-slate-900 bg-emerald-50 px-3 py-2 rounded-lg">
                  {data.username || "Loading..."}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  <b>Password sama dengan username ({isEarly ? "8 digit terakhir NIK" : "NISN"})</b>
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
              Akun <b>belum aktif</b>. Lakukan pembayaran {loadingFee ? "..." : toIDR(fee ?? 0)} dan konfirmasi ke panitia.
            </div>
          </div>
        </div>

        {/* CTA bawah */}
        <div className="flex flex-col sm:flex-row gap-4 justify-left">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl shadow hover:bg-slate-200 transition-colors"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl shadow hover:bg-violet-700 transition-colors"
          >
            Ke Halaman Login
          </Link>
        </div>

        {/* Note */}
        <div className="text-center mt-8 p-6 bg-slate-50 rounded-2xl">
          <h4 className="font-semibold text-slate-900 mb-2">Informasi</h4>
          <p className="text-slate-600">
            Setelah pembayaran terverifikasi, status akun berubah menjadi <b>Aktif</b>. Simpan ID pendaftaran untuk keperluan verifikasi.
          </p>
        </div>
      </div>
    </div>
  );
}

/** ========== PAGE WRAPPER: bungkus dengan Suspense (wajib untuk useSearchParams) ========== */
export default function PPDBSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PPDBSuccessInner />
    </Suspense>
  );
}

// Jika ingin memaksa SSR dinamis dan melewati prerender ketat, boleh aktifkan ini:
// export const dynamic = "force-dynamic";
