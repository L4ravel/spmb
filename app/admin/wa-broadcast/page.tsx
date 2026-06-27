// app/admin/wa-broadcast/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Search,
  Send,
} from "lucide-react";

type GroupConfig = {
  link: string;
  privateLink: string;
};

type TemplateMap = Record<string, string>;
type GroupMap = Record<string, GroupConfig>;

type BroadcastRow = {
  nisn: string;
  nama: string;
  jenjang: string;
  waliWa: string;
  sentCount: number;
  lastSentAt: Date | null;
};

function normalizeWaNumber(raw: unknown) {
  if (!raw) return "";

  const digits = String(raw).replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return "62" + digits.slice(1);
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  return digits;
}

function formatTanggal(value: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function defaultMessage(jenjang: string) {
  return [
    "Bismillah.",
    "",
    "Kami dari Panitia SPMB Pondok Pesantren Assunnah menyampaikan informasi untuk Bapak/Ibu wali dari {nama}.",
    "",
    `Jenjang: ${jenjang || "{jenjang}"}`,
    "",
    "Silakan perhatikan informasi berikut:",
    "",
    "Tulis informasi di sini...",
    "",
    "Barakallahu fiikum, jazakumullahu khairan atas perhatian dan kerja samanya.",
  ].join("\n");
}

function applyTemplate(
  template: string,
  row: BroadcastRow,
  groupCfg?: GroupConfig
) {
  const groupLink = groupCfg?.link || "";
  const privateLink = groupCfg?.privateLink || "";

  return template
    .replaceAll("{nama}", row.nama || "")
    .replaceAll("{nisn}", row.nisn || "")
    .replaceAll("{jenjang}", row.jenjang || "")
    .replaceAll("{waliWa}", row.waliWa || "")
    .replaceAll("{link_grup}", groupLink)
    .replaceAll("{private_link}", privateLink);
}

export default function WaBroadcastPage() {
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [templates, setTemplates] = useState<TemplateMap>({});
  const [groupMap, setGroupMap] = useState<GroupMap>({});

  const [selectedJenjang, setSelectedJenjang] = useState("");
  const [messageText, setMessageText] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingSend, setLoadingSend] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const qUsers = query(
          collection(db, "users_app"),
          where("finalDecision", "==", "LULUS")
        );

        const [snapUsers, snapGroups, snapTemplates, snapCounters] =
          await Promise.all([
            getDocs(qUsers),
            getDocs(collection(db, "wa_groups")),
            getDocs(collection(db, "wa_message_templates")),
            getDocs(collection(db, "wa_broadcast_counters")),
          ]);

        const gm: GroupMap = {};
        snapGroups.forEach((item) => {
          const data = item.data() || {};
          const label = String(data.label || item.id || "").trim();

          if (!label) return;

          gm[label] = {
            link: String(data.link || ""),
            privateLink: String(data.privateLink || ""),
          };
        });

        const tm: TemplateMap = {};
        snapTemplates.forEach((item) => {
          const data = item.data() || {};
          tm[item.id] = String(data.message || "");
        });

        const counterMap: Record<
          string,
          {
            sentCount: number;
            lastSentAt: Date | null;
          }
        > = {};

        snapCounters.forEach((item) => {
          const data = item.data() || {};
          const lastSentAt =
            data.lastSentAt && typeof data.lastSentAt.toDate === "function"
              ? data.lastSentAt.toDate()
              : null;

          counterMap[item.id] = {
            sentCount: Number(data.totalSent || 0),
            lastSentAt,
          };
        });

        const promises = snapUsers.docs.map(async (docSnap) => {
          const nisn = docSnap.id;
          const userData = docSnap.data() || {};

          const ppdbSnap = await getDoc(doc(db, "ppdb", nisn));
          const ppdbData = ppdbSnap.exists() ? ppdbSnap.data() || {} : {};

          const nama =
            String(
              ppdbData.namaLengkap ||
                ppdbData.nama ||
                ppdbData.fullName ||
                "-"
            ) || "-";

          const jenjang = String(userData.registrationLevel || "-").trim();
          const waliWa = String(ppdbData.waliWa || "").trim();
          const counter = counterMap[nisn];

          return {
            nisn,
            nama,
            jenjang,
            waliWa,
            sentCount: counter?.sentCount || 0,
            lastSentAt: counter?.lastSentAt || null,
          };
        });

        const allRows = await Promise.all(promises);

        allRows.sort((a, b) => {
          if (a.jenjang === b.jenjang) {
            return a.nama.localeCompare(b.nama);
          }

          return a.jenjang.localeCompare(b.jenjang);
        });

        const firstJenjang =
          allRows.find(
            (item) =>
              item.jenjang && item.jenjang !== "-" && item.jenjang !== "undefined"
          )?.jenjang || "";

        if (!cancelled) {
          setRows(allRows);
          setGroupMap(gm);
          setTemplates(tm);

          if (firstJenjang) {
            setSelectedJenjang(firstJenjang);
            setMessageText(tm[firstJenjang] || defaultMessage(firstJenjang));
          }
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

  const jenjangOptions = useMemo(() => {
    const unique = new Set(
      rows
        .map((row) => row.jenjang)
        .filter((value) => value && value !== "-" && value !== "undefined")
    );

    return Array.from(unique).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      if (selectedJenjang && row.jenjang !== selectedJenjang) return false;

      if (!term) return true;

      const nama = row.nama.toLowerCase();
      const nisn = row.nisn.toLowerCase();
      const wa = row.waliWa.toLowerCase();

      return nama.includes(term) || nisn.includes(term) || wa.includes(term);
    });
  }, [rows, selectedJenjang, searchTerm]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [selectedJenjang, searchTerm, pageSize]);

  function handleChangeJenjang(value: string) {
    setSelectedJenjang(value);
    setSuccess("");
    setError("");
    setMessageText(templates[value] || defaultMessage(value));
  }

  async function handleSaveTemplate() {
    if (!selectedJenjang) {
      alert("Pilih jenjang terlebih dahulu.");
      return;
    }

    const message = messageText.trim();

    if (!message) {
      alert("Format pesan tidak boleh kosong.");
      return;
    }

    try {
      setSavingTemplate(true);
      setError("");
      setSuccess("");

      await setDoc(
        doc(db, "wa_message_templates", selectedJenjang),
        {
          jenjang: selectedJenjang,
          message,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setTemplates((prev) => ({
        ...prev,
        [selectedJenjang]: message,
      }));

      setSuccess(`Format pesan jenjang ${selectedJenjang} berhasil disimpan.`);
    } catch (err) {
      console.error(err);
      setError("Gagal menyimpan format pesan.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSendMessage(row: BroadcastRow) {
    if (!selectedJenjang) {
      alert("Pilih jenjang terlebih dahulu.");
      return;
    }

    const template = messageText.trim();

    if (!template) {
      alert("Format pesan masih kosong.");
      return;
    }

    if (!row.waliWa) {
      alert(`Nomor WA wali untuk NISN ${row.nisn} belum diisi di ppdb.`);
      return;
    }

    const phone = normalizeWaNumber(row.waliWa);

    if (!phone) {
      alert(`Nomor WA wali untuk NISN ${row.nisn} tidak valid.`);
      return;
    }

    const message = applyTemplate(template, row, groupMap[row.jenjang]);

    try {
      setLoadingSend(row.nisn);
      setError("");
      setSuccess("");

      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(
        message
      )}`;

      window.open(url, "_blank");

      const logRef = doc(collection(db, "wa_broadcast_logs"));
      const counterRef = doc(db, "wa_broadcast_counters", row.nisn);

      await Promise.all([
        setDoc(logRef, {
          nisn: row.nisn,
          nama: row.nama,
          jenjang: row.jenjang,
          waliWa: row.waliWa,
          phone,
          message,
          sentAt: serverTimestamp(),
        }),
        setDoc(
          counterRef,
          {
            nisn: row.nisn,
            nama: row.nama,
            jenjang: row.jenjang,
            waliWa: row.waliWa,
            totalSent: increment(1),
            lastSentAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      setRows((prev) =>
        prev.map((item) =>
          item.nisn === row.nisn
            ? {
                ...item,
                sentCount: item.sentCount + 1,
                lastSentAt: new Date(),
              }
            : item
        )
      );
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan log pengiriman. Coba lagi.");
    } finally {
      setLoadingSend(null);
    }
  }

  function handlePrevPage() {
    setPage((prev) => Math.max(1, prev - 1));
  }

  function handleNextPage() {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }

  const previewRow = filteredRows[0] || null;
  const previewMessage = previewRow
    ? applyTemplate(messageText, previewRow, groupMap[previewRow.jenjang])
    : messageText;

  return (
    <div className="min-h-screen w-full space-y-6">
      <div className="w-full space-y-6 px-3 sm:px-4 lg:px-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Broadcast WhatsApp Wali
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Tulis format pesan per jenjang, lalu kirim ke nomor wali.
            </p>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Format Pesan
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Gunakan variabel: {"{nama}"}, {"{nisn}"}, {"{jenjang}"},{" "}
                  {"{waliWa}"}, {"{link_grup}"}, {"{private_link}"}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Jenjang
                </span>
                <select
                  value={selectedJenjang}
                  onChange={(e) => handleChangeJenjang(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                >
                  {jenjangOptions.length === 0 && (
                    <option value="">Belum ada jenjang</option>
                  )}
                  {jenjangOptions.map((jenjang) => (
                    <option key={jenjang} value={jenjang}>
                      {jenjang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Tulis format pesan WhatsApp di sini..."
              className="mt-4 min-h-[320px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Format ini akan disimpan khusus untuk jenjang{" "}
                <span className="font-bold text-slate-700">
                  {selectedJenjang || "-"}
                </span>
                .
              </p>

              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !selectedJenjang}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition",
                  savingTemplate || !selectedJenjang
                    ? "cursor-not-allowed bg-slate-300"
                    : "bg-emerald-600 hover:bg-emerald-700",
                ].join(" ")}
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Format
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">
              Preview Pesan
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Preview memakai data wali pertama dari jenjang yang dipilih.
            </p>

            <div className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
              {previewMessage || "Belum ada pesan."}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">
                Daftar Wali Jenjang{" "}
                <span className="text-emerald-700">
                  {selectedJenjang || "-"}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total data cocok: {totalRows} dari {rows.length} peserta lulus.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[280px]">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Cari NISN, nama, atau nomor WA..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Tampil
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    No
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    NISN
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Nama
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Nomor Wali
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Kirim
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Keterangan
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data...
                      </span>
                    </td>
                  </tr>
                )}

                {!loading && totalRows === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
                      Belum ada data wali pada jenjang ini.
                    </td>
                  </tr>
                )}

                {!loading &&
                  pagedRows.map((row, index) => {
                    const hasWa = !!row.waliWa;
                    const disabled = !hasWa || loadingSend === row.nisn;

                    return (
                      <tr key={row.nisn} className="hover:bg-slate-50/80">
                        <td className="border-b border-slate-100 px-3 py-2 align-middle text-xs text-slate-600">
                          {startIndex + index + 1}
                        </td>

                        <td className="border-b border-slate-100 px-3 py-2 align-middle font-mono text-xs text-slate-800">
                          {row.nisn}
                        </td>

                        <td className="border-b border-slate-100 px-3 py-2 align-middle text-slate-900">
                          {row.nama}
                        </td>

                        <td className="border-b border-slate-100 px-3 py-2 align-middle text-slate-700">
                          {row.waliWa || "-"}
                          {!hasWa && (
                            <p className="mt-1 text-[10px] font-semibold text-amber-600">
                              Nomor WA wali belum diisi.
                            </p>
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-3 py-2 align-middle">
                          <button
                            type="button"
                            onClick={() => handleSendMessage(row)}
                            disabled={disabled}
                            className={[
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
                              disabled
                                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                                : "border border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700",
                            ].join(" ")}
                          >
                            {loadingSend === row.nisn ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Mengirim...
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5" />
                                Kirim
                              </>
                            )}
                          </button>
                        </td>

                        <td className="border-b border-slate-100 px-3 py-2 align-middle">
                          <div className="space-y-1">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
                                row.sentCount > 0
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                  : "bg-slate-50 text-slate-600 ring-slate-100",
                              ].join(" ")}
                            >
                              Terkirim {row.sentCount}x
                            </span>
                            <p className="text-[10px] text-slate-500">
                              Terakhir: {formatTanggal(row.lastSentAt)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Halaman{" "}
              <span className="font-bold">
                {currentPage} / {totalPages}
              </span>{" "}
              • Menampilkan{" "}
              <span className="font-bold">
                {totalRows === 0
                  ? 0
                  : `${startIndex + 1}–${Math.min(
                      startIndex + pageSize,
                      totalRows
                    )}`}
              </span>{" "}
              dari <span className="font-bold">{totalRows}</span> data.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold transition",
                  currentPage <= 1
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold transition",
                  currentPage >= totalPages
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}