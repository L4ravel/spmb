"use client";

import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Search,
  Filter,
  Loader2,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

/* ==== Firebase init (pakai env yang sama) ==== */
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

/* ===== Helper nomor WA ===== */
function cleanWaNumber(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  // buang semua selain angka
  s = s.replace(/[^\d]/g, "");
  if (!s) return "";
  if (s.startsWith("62")) return s;
  if (s.startsWith("0")) return "62" + s.slice(1);
  return s;
}

/* ===== Template pesan WA ===== */
function buildWaMessage(row) {
  const nisn = row.nisn || "-";
  const name = row.name || "-";
  const level = row.level || "-";

  return (
    "PENGUMUMAN KELULUSAN\n" +
    "SPMB TP. 2026/2027\n\n" +

    "Dengan ini kami sampaikan bahwa hasil kelulusan SPMB Tahun Pelajaran 2026/2027 " +
    "telah diumumkan pada tanggal 27 Desember 2025.\n\n" +

    "Peserta dipersilakan untuk mengecek hasil kelulusan melalui laman berikut:\n" +
    "👉 https://spmb.pontrenassunnah.com/login\n\n" +

    "Untuk login ke akun SPMB, silakan gunakan data berikut:\n" +
    `• Nama Peserta: ${name}\n` +
     `• Jenjang: ${level}\n` +
    `• Username: ${nisn}\n` +
    `• Password: ${nisn}\n\n` +   

    "Jadwal daftar ulang dapat dilakukan dengan cara offline dengan datang ke ponpes As Sunnah " +
    "atau melalui akun SPMB masing-masing pada:\n" +
    "• 28 Desember 2025 s.d. 10 Januari 2026\n\n" +

    "Apabila memerlukan bantuan lebih lanjut, peserta dapat menghubungi panitia melalui nomor WhatsApp resmi 087720242025.\n\n" +
    "Demikian informasi ini kami sampaikan.\n" +
    "Atas perhatian dan kerjasamanya, kami ucapkan terima kasih."
  );
}

export default function AdminWaKelulusanPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterWaStatus, setFilterWaStatus] = useState("ALL"); // ALL | SENT | NOT_SENT
  const [filterDateFrom, setFilterDateFrom] = useState(""); // yyyy-mm-dd
  const [filterDateTo, setFilterDateTo] = useState(""); // yyyy-mm-dd

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        // 1. Ambil semua peserta LULUS dari users_app
        const usersSnap = await getDocs(
          query(
            collection(db, "users_app"),
            where("finalDecision", "==", "LULUS")
          )
        );

        const tmpRows = [];

        for (const userDoc of usersSnap.docs) {
          const ud = userDoc.data() || {};
          const nisn = (ud.nisn || userDoc.id || "").toString().trim();
          if (!nisn) continue;

          const level =
            (ud.registrationLevel ||
              ud.jenjangDiterima ||
              ud.jenjang ||
              "").toString().trim() || "-";

          const name =
            ud.fullName || ud.nama || ud.name || ud.studentName || nisn;

          // 2. Ambil info WA wali dari koleksi ppdb (doc id = nisn)
          let waliWa = "";
          try {
            const ppdbSnap = await getDoc(doc(db, "ppdb", nisn));
            if (ppdbSnap.exists()) {
              const pd = ppdbSnap.data() || {};
              // utama waliWa, kalau gak ada pakai beberapa fallback
              waliWa =
                pd.waliWa || pd.waliWA || pd.waliHp || pd.waliHP || "";
            }
          } catch (e) {
            console.error("Failed fetch ppdb for", nisn, e);
          }

          const waClean = cleanWaNumber(waliWa);
          const waStatus = ud.waKelulusanSent ? "SENT" : "NOT_SENT";

          // konversi waKelulusanSentAt ke timestamp (ms) bila ada
          let waSentAt = null;
          const rawSentAt = ud.waKelulusanSentAt;
          if (rawSentAt) {
            if (typeof rawSentAt.toMillis === "function") {
              waSentAt = rawSentAt.toMillis();
            } else if (typeof rawSentAt === "number") {
              waSentAt = rawSentAt;
            }
          }

          tmpRows.push({
            nisn,
            name,
            level,
            rawWa: waliWa,
            wa: waClean,
            waStatus,
            waSentAt,
          });
        }

        if (!alive) return;

        // urutkan: jenjang lalu nama
        tmpRows.sort((a, b) => {
          if (a.level === b.level) {
            return a.name.localeCompare(b.name, "id");
          }
          return a.level.localeCompare(b.level, "id");
        });

        setRows(tmpRows);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErrorMsg(e?.message || "Gagal memuat data WA kelulusan.");
      } finally {
        alive && setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // opsi filter jenjang
  const levelOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.level) set.add(r.level);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [rows]);

  // apply search + filter (jenjang, status WA, tanggal kirim)
  const filteredRows = useMemo(() => {
    let out = [...rows];

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.nisn.toLowerCase().includes(s) ||
          r.name.toLowerCase().includes(s) ||
          r.level.toLowerCase().includes(s)
      );
    }

    if (filterLevel !== "ALL") {
      out = out.filter((r) => r.level === filterLevel);
    }

    if (filterWaStatus === "SENT") {
      out = out.filter((r) => r.waStatus === "SENT");
    } else if (filterWaStatus === "NOT_SENT") {
      out = out.filter((r) => r.waStatus !== "SENT");
    }

    // filter tanggal berdasarkan waSentAt (hanya yang sudah dikirim)
    if (filterDateFrom || filterDateTo) {
      const fromMs = filterDateFrom
        ? new Date(filterDateFrom + "T00:00:00").getTime()
        : null;
      const toMs = filterDateTo
        ? new Date(filterDateTo + "T23:59:59.999").getTime()
        : null;

      out = out.filter((r) => {
        if (!r.waSentAt) return false; // belum punya tanggal kirim => exclude
        const t = r.waSentAt;
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
        return true;
      });
    }

    return out;
  }, [
    rows,
    search,
    filterLevel,
    filterWaStatus,
    filterDateFrom,
    filterDateTo,
  ]);

  const totalSent = useMemo(
    () => rows.filter((r) => r.waStatus === "SENT").length,
    [rows]
  );
  const totalNotSent = rows.length - totalSent;

  // klik tombol kirim WA
     const handleSendWa = async (row) => {
    if (!row.wa) {
      alert("Nomor WA wali belum tersedia untuk peserta ini.");
      return;
    }

    const msg = buildWaMessage(row);

    // Deteksi mobile vs desktop
    let url = "";
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent || "";
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        ua
      );

      if (isMobile) {
        // Prioritas: buka aplikasi WhatsApp di HP
        url = `whatsapp://send?phone=${row.wa}&text=${encodeURIComponent(msg)}`;
      } else {
        // Prioritas: WhatsApp Web di komputer
        url = `https://web.whatsapp.com/send?phone=${row.wa}&text=${encodeURIComponent(
          msg
        )}`;
      }
    }

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    try {
      await updateDoc(doc(db, "users_app", row.nisn), {
        waKelulusanSent: true,
        waKelulusanSentAt: serverTimestamp(),
      });
      const now = Date.now();
      setRows((prev) =>
        prev.map((r) =>
          r.nisn === row.nisn
            ? { ...r, waStatus: "SENT", waSentAt: now }
            : r
        )
      );
    } catch (e) {
      console.error(e);
      alert(
        "Gagal menyimpan status WA kelulusan. Silakan cek koneksi atau rules Firestore."
      );
    }
  };



  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900">
            WA Kelulusan
          </h1>          
        </div>
        <div className="text-[11px] md:text-xs text-slate-600">
          Total LULUS:{" "}
          <span className="font-semibold">{rows.length}</span> · Sudah WA:{" "}
          <span className="font-semibold text-emerald-700">{totalSent}</span> ·
          Belum WA:{" "}
          <span className="font-semibold text-amber-700">{totalNotSent}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header filter */}
        <div className="px-3 py-3 md:px-4 md:py-3 border-b border-slate-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-semibold">Daftar WA Kelulusan</span>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Memuat…
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {/* Search */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NISN / nama / jenjang…"
                className="bg-transparent px-1 py-1 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Filter jenjang */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 max-w-[160px]"
            >
              <option value="ALL">Semua Jenjang</option>
              {levelOptions.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>

            {/* Filter status WA */}
            <select
              value={filterWaStatus}
              onChange={(e) => setFilterWaStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
            >
              <option value="ALL">Semua Status WA</option>
              <option value="NOT_SENT">Belum dikirim</option>
              <option value="SENT">Sudah dikirim</option>
            </select>

            {/* Filter tanggal kirim WA */}
            <div className="flex flex-col gap-1 md:flex-row md:items-center">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              />
              <span className="hidden md:inline text-[11px] text-slate-500">
                s.d.
              </span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Tabel utama */}
        {errorMsg ? (
          <div className="p-4 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errorMsg}
          </div>
        ) : filteredRows.length === 0 && !loading ? (
          <div className="p-4 text-sm text-slate-700">
            Tidak ada data yang cocok dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 w-12 text-center">No</th>
                  <th className="px-3 py-2">NISN</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Jenjang</th>
                  <th className="px-3 py-2 text-center">Kirim WA</th>
                  <th className="px-3 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r, idx) => (
                  <tr key={r.nisn} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center text-[11px] text-slate-700">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-800">
                      {r.nisn}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900">
                        {r.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-800">{r.level}</td>

                    {/* KIRIM WA */}
                    <td className="px-3 py-2 text-center">
                      {r.wa ? (
                        <button
                          type="button"
                          onClick={() => handleSendWa(r)}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          <Send className="h-3 w-3" />
                          Kirim WA
                        </button>
                      ) : (
                        <span className="text-[11px] text-rose-600">
                          Nomor belum tersedia
                        </span>
                      )}
                    </td>

                    {/* KETERANGAN */}
                    <td className="px-3 py-2">
                      {r.wa ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          {r.waStatus === "SENT" ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-700">
                                Sudah dikirim
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-700">
                                Belum dikirim
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-rose-600">
                          Nomor WA belum diisi di PPDB
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}




