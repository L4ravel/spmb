"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Send, Search, ChevronLeft, ChevronRight } from "lucide-react";

// Normalisasi nomor WA ke format internasional (62…)
function normalizeWaNumber(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, ""); // buang selain angka

  if (digits.startsWith("0")) {
    return "62" + digits.slice(1); // 08xxx -> 62xxx
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  return digits; // fallback, biar tetap ada
}

export default function AdWaPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSend, setLoadingSend] = useState(null); // nisn yg sedang dikirim
  const [error, setError] = useState("");

  // map label jenjang -> { link, privateLink }
  const [groupMap, setGroupMap] = useState({});

  // Filter & pagination state
  const [filterJenjang, setFilterJenjang] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL | SENT | NOT_SENT
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50); // 50 | 100 | 500
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        // Ambil peserta LULUS dari users_app (field finalDecision)
        const qUsers = query(
          collection(db, "users_app"),
          where("finalDecision", "==", "LULUS")
        );

        // Ambil konfigurasi WA grup
        const waGroupsRef = collection(db, "wa_groups");

        const [snapUsers, snapGroups] = await Promise.all([
          getDocs(qUsers),
          getDocs(waGroupsRef),
        ]);

        // Bangun map label -> { link, privateLink }
        const gm = {};
        snapGroups.forEach((d) => {
          const data = d.data() || {};
          const label = data.label || d.id;
          gm[label] = {
            link: data.link || "",
            privateLink: data.privateLink || "",
          };
        });

        const promises = snapUsers.docs.map(async (docSnap) => {
          const nisn = docSnap.id;
          const userData = docSnap.data() || {};

          // Ambil data ppdb untuk nama & waliWa
          const ppdbRef = doc(db, "ppdb", nisn);
          const ppdbSnap = await getDoc(ppdbRef);
          const ppdbData = ppdbSnap.exists() ? ppdbSnap.data() : {};

          // Ambil data status undangan dari wa_invites
          const inviteRef = doc(db, "wa_invites", nisn);
          const inviteSnap = await getDoc(inviteRef);
          const inviteData = inviteSnap.exists() ? inviteSnap.data() : {};
          const invited = !!inviteData.sent;

          const nama =
            ppdbData.namaLengkap ||
            ppdbData.nama ||
            ppdbData.fullName ||
            "-";

          const jenjang = userData.registrationLevel || "-";
          const waliWa = ppdbData.waliWa || "";

          return {
            nisn,
            nama,
            jenjang,
            waliWa,
            invited,
          };
        });

        const allRows = await Promise.all(promises);

        if (!cancelled) {
          // Urutkan berdasarkan jenjang lalu nama biar rapi
          allRows.sort((a, b) => {
            if (a.jenjang === b.jenjang) {
              return a.nama.localeCompare(b.nama);
            }
            return a.jenjang.localeCompare(b.jenjang);
          });

          setRows(allRows);
          setGroupMap(gm);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Gagal memuat data. Coba refresh halaman.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Jenjang unik untuk filter
  const jenjangOptions = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => r.jenjang)
        .filter((j) => j && j !== "-" && j !== "undefined")
    );
    return Array.from(set).sort();
  }, [rows]);

  // Data setelah filter & search
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      if (filterJenjang !== "ALL" && row.jenjang !== filterJenjang) {
        return false;
      }

      if (filterStatus === "SENT" && !row.invited) return false;
      if (filterStatus === "NOT_SENT" && row.invited) return false;

      if (!term) return true;

      const nama = (row.nama || "").toLowerCase();
      const nisn = (row.nisn || "").toLowerCase();

      return nama.includes(term) || nisn.includes(term);
    });
  }, [rows, filterJenjang, filterStatus, searchTerm]);

  // Pagination
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  // Reset page kalau filter/search berubah
  useEffect(() => {
    setPage(1);
  }, [filterJenjang, filterStatus, searchTerm, pageSize]);

  const handleSendInvite = async (row) => {
    const { nisn, jenjang, waliWa } = row;

    const groupCfg = groupMap[jenjang];
const groupLink = groupCfg?.link || "";

    if (!groupCfg || !groupLink) {
      alert(
        `Link grup untuk jenjang "${jenjang}" belum diset di koleksi wa_groups.`
      );
      return;
    }

    if (!waliWa) {
      alert(`Nomor WA wali untuk NISN ${nisn} belum diisi di ppdb.`);
      return;
    }

    const phone = normalizeWaNumber(waliWa);

    if (!phone) {
      alert(`Nomor WA wali untuk NISN ${nisn} tidak valid.`);
      return;
    }

    const message = [
  "Bismillah.",
  "",
  "Kami dari Panitia SPMB Pondok Pesantren Assunnah mengundang Bapak/Ibu orang tua/wali untuk bergabung ke grup WhatsApp resmi sesuai jenjang peserta.",
  "",
  `Jenjang pendaftaran: ${jenjang}`,
  "",
  "Melalui grup ini, insyaAllah seluruh informasi penting terkait SPMB akan disampaikan.",
  "",
  "Silakan bergabung melalui link berikut:",
  groupLink,
  "",
  "Catatan: link grup ini juga dapat diakses melalui akun SPMB masing-masing setelah Bapak/Ibu login.",
  "",
  "Barakallahu fiikum, jazakumullahu khairan atas perhatian dan kerja samanya."
].join("\n");


    try {
      setLoadingSend(nisn);

      // Buka WA
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
window.open(url, "_blank");

      // Simpan status undangan di Firestore
      await setDoc(
        doc(db, "wa_invites", nisn),
        {
          sent: true,
          sentAt: serverTimestamp(),
          jenjang,
          waliWa,
        },
        { merge: true }
      );

      // Update state lokal
      setRows((prev) =>
        prev.map((r) =>
          r.nisn === nisn ? { ...r, invited: true } : r
        )
      );
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan status undangan. Coba lagi.");
    } finally {
      setLoadingSend(null);
    }
  };

  const handlePrevPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  return (
     <div className="min-h-screen w-full space-y-6">
    <div className="w-full space-y-6 px-3 sm:px-4 lg:px-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Kirim Undangan Grup WhatsApp
            </h1>            
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Cari NISN atau nama..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-800 outline-none ring-0 transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Filter jenjang */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                Jenjang
              </span>
              <select
                value={filterJenjang}
                onChange={(e) => setFilterJenjang(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua</option>
                {jenjangOptions.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter status undangan */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                Status undangan
              </span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua</option>
                <option value="NOT_SENT">Belum dikirim</option>
                <option value="SENT">Sudah dikirim</option>
              </select>
            </div>
          </div>

          {/* Page size */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              Tampil
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
            <span className="text-xs text-slate-500">per halaman</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-700">
              Total LULUS:{" "}
              <span className="font-semibold text-emerald-700">
                {rows.length}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                (ditampilkan: {totalRows})
              </span>
            </p>
            {loading && (
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat data…
              </div>
            )}
          </div>

          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    No
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    NISN
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nama
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Jenjang
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Kirim Undangan
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && totalRows === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-slate-500"
                    >
                      Belum ada data peserta yang sesuai filter.
                    </td>
                  </tr>
                )}

                {pagedRows.map((row, idx) => {
                  const cfg = groupMap[row.jenjang];
                  const hasGroup =
                    cfg && (cfg.link || cfg.privateLink || "");
                  const hasWa = !!row.waliWa;
                  const disabled = !hasWa;

                  const statusLabel = row.invited
                    ? "Sudah dikirim"
                    : "Belum dikirim";

                  return (
                    <tr
                      key={row.nisn}
                      className="hover:bg-slate-50/80"
                    >
                      <td className="border-b border-slate-100 px-3 py-2 align-middle text-xs text-slate-600">
                        {startIndex + idx + 1}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle font-mono text-xs text-slate-800">
                        {row.nisn}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle text-slate-900">
                        {row.nama}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle text-slate-800">
                        {row.jenjang}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => handleSendInvite(row)}
                          disabled={disabled || loadingSend === row.nisn}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                            disabled
                              ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                              : "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700"
                          ].join(" ")}
                        >
                          {loadingSend === row.nisn ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Mengirim…
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              Kirim
                            </>
                          )}
                        </button>
                        {!hasGroup && (
                          <p className="mt-1 text-[10px] text-amber-600">
                            Link untuk jenjang ini belum diisi di wa_groups.
                          </p>
                        )}
                        {hasGroup && !hasWa && (
                          <p className="mt-1 text-[10px] text-amber-600">
                            Nomor WA wali belum diisi di ppdb.
                          </p>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            row.invited
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                              : "bg-slate-50 text-slate-600 ring-1 ring-slate-100",
                          ].join(" ")}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <div>
              Halaman{" "}
              <span className="font-semibold">
                {currentPage} / {totalPages}
              </span>{" "}
              • Menampilkan{" "}
              <span className="font-semibold">
                {totalRows === 0
                  ? 0
                  : `${startIndex + 1}–${Math.min(
                      startIndex + pageSize,
                      totalRows
                    )}`}
              </span>{" "}
              dari{" "}
              <span className="font-semibold">{totalRows}</span> data yang cocok.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
                  currentPage <= 1
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                <ChevronLeft className="h-3 w-3" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
                  currentPage >= totalPages
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                <span>Next</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>     
      </div>
    </div>
  );
}
