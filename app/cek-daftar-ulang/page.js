// app/cek-daftar-ulang/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";

function fmtIDR(value) {
  const n = Number(value || 0);

  if (!Number.isFinite(n)) return "Rp0";

  return n.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();

  if (s === "LUNAS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        LUNAS
      </span>
    );
  }

  if (s === "SEBAGIAN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        <AlertCircle className="h-3.5 w-3.5" />
        SEBAGIAN
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
      <XCircle className="h-3.5 w-3.5" />
      BELUM BAYAR
    </span>
  );
}

export default function CekDaftarUlangPage() {
  const [levels, setLevels] = useState([]);
  const [jenjang, setJenjang] = useState("");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [message, setMessage] = useState("");

  const keywordValid = useMemo(() => keyword.trim().length >= 3, [keyword]);

  useEffect(() => {
    let alive = true;

    async function loadLevels() {
      setLoadingLevels(true);
      setMessage("");

      try {
        const res = await fetch("/api/public/cek-daftar-ulang?mode=levels", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Gagal memuat jenjang.");
        }

        if (!alive) return;

        setLevels(Array.isArray(data.levels) ? data.levels : []);
      } catch (error) {
        if (!alive) return;

        setMessage(error?.message || "Gagal memuat jenjang.");
      } finally {
        if (alive) setLoadingLevels(false);
      }
    }

    loadLevels();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSearch(e) {
    e?.preventDefault?.();

    setResults([]);
    setMessage("");

    if (!jenjang) {
      setMessage("Silakan pilih jenjang terlebih dahulu.");
      return;
    }

    if (!keywordValid) {
      setMessage("Masukkan nama atau NISN minimal 3 karakter.");
      return;
    }

    setLoadingSearch(true);

    try {
      const params = new URLSearchParams({
        jenjang,
        q: keyword.trim(),
      });

      const res = await fetch(`/api/public/cek-daftar-ulang?${params}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Gagal mengecek data.");
      }

      const list = Array.isArray(data.results) ? data.results : [];

      setResults(list);

      if (list.length === 0) {
        setMessage("Data tidak ditemukan. Pastikan jenjang dan nama/NISN sudah benar.");
      }
    } catch (error) {
      setMessage(error?.message || "Gagal mengecek data.");
    } finally {
      setLoadingSearch(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                <Wallet className="h-3.5 w-3.5" />
                Cek Daftar Ulang
              </div>

              <h1 className="mt-3 text-xl font-black tracking-tight text-slate-900 md:text-3xl">
                Cek Status Pembayaran Daftar Ulang
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Pilih jenjang, lalu cari nama siswa atau NISN untuk melihat status lunas
                dan jumlah tunggakan yang perlu diselesaikan.
              </p>
            </div>

            <div className="hidden h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 md:flex">
              <GraduationCap className="h-8 w-8 text-slate-700" />
            </div>
          </div>

          <form onSubmit={handleSearch} className="mt-5 grid gap-3 md:grid-cols-[240px_1fr_auto]">
            <select
              value={jenjang}
              onChange={(e) => {
                setJenjang(e.target.value);
                setResults([]);
                setMessage("");
              }}
              disabled={loadingLevels}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
            >
              <option value="">
                {loadingLevels ? "Memuat jenjang..." : "Pilih Jenjang"}
              </option>

              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
              <Search className="h-4 w-4 text-slate-400" />

              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setResults([]);
                  setMessage("");
                }}
                placeholder="Cari nama siswa atau NISN..."
                className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loadingSearch || loadingLevels}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Cek Status
            </button>
          </form>

          {message ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}
        </div>

        {results.length > 0 ? (
          <div className="space-y-3">
            {results.map((item) => (
              <div
                key={`${item.nisn}-${item.jenjang}`}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-black text-slate-900">
                      {item.nama}
                    </div>

                    <div className="mt-1 flex flex-col gap-0.5 text-xs font-semibold text-slate-500 md:flex-row md:items-center md:gap-2">
                      <span>NISN: {item.nisn}</span>
                      <span className="hidden md:inline">•</span>
                      <span>{item.jenjang}</span>
                    </div>
                  </div>

                  <StatusBadge status={item.status} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Tagihan
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {fmtIDR(item.tagihanNet)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Terbayar
                    </div>
                    <div className="mt-1 text-sm font-black text-emerald-700">
                      {fmtIDR(item.terbayar)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Sisa Tunggakan
                    </div>
                    <div
                      className={`mt-1 text-sm font-black ${
                        Number(item.sisa || 0) > 0 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {fmtIDR(item.sisa)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Bukti Pembayaran
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {Number(item.buktiCount || 0).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                {Number(item.potongan || 0) > 0 ? (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-semibold text-violet-700">
                    Potongan yang tercatat: {fmtIDR(item.potongan)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}