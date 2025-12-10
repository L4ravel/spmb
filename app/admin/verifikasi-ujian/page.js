"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  writeBatch,
  doc,
  Timestamp,
  limit,
  // === [ADD] sinkron status terkirim lintas akun ===
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckSquare, Square, Search, UsersRound, CheckCircle2 } from "lucide-react";

/* ========== Helpers ========== */
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  const n = Number(v);
  if (!Number.isNaN(n) && n > 0) return n;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : 0;
};
const ts = (v) =>
  typeof v?.toMillis === "function" ? v : Timestamp.fromMillis(toMs(v));
const isPaid = (r) =>
  r?.verifiedPayment === true ||
  r?.registrationPaymentStatus === "verified" ||
  r?.reRegistrationPaymentStatus === "verified";
const verifiedAtMs = (r) =>
  toMs(r.registrationPaymentVerifiedAt) ||
  toMs(r.reRegistrationPaymentVerifiedAt) ||
  toMs(r.registrationPaymentAt) ||
  toMs(r.updatedAt) ||
  toMs(r.createdAt);

/* ====== Phone utils ====== */
function normalizePhoneID(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

/* ====== Date utils (ID) ====== */
const HARI_ID = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const pad2 = (n) => String(n).padStart(2, "0");
function fmtTanggalID(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtJamID(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtJadwalSurat(wsMs, weMs) {
  if (!wsMs) return null;
  const ds = new Date(wsMs);
  const de = weMs ? new Date(weMs) : null;
  const hari = HARI_ID[ds.getDay()];
  const tanggal = fmtTanggalID(ds);
  const jamMulai = fmtJamID(ds);
  const jamSelesai = de ? fmtJamID(de) : null;
  return {
    hari,
    tanggal,
    waktu: jamSelesai ? `${jamMulai}–${jamSelesai} WITA` : `${jamMulai} WITA`,
    kalimat: jamSelesai
      ? `${hari}, ${tanggal}, ${jamMulai}–${jamSelesai} WITA`
      : `${hari}, ${tanggal}, ${jamMulai} WITA`,
  };
}

/* ========== Page ========== */
export default function VerifikasiUjian() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [schedules, setSchedules] = useState([]);
  const [filterScheduleId, setFilterScheduleId] = useState("ALL");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterScheduleStatus, setFilterScheduleStatus] = useState("ALL");

  const [targetScheduleId, setTargetScheduleId] = useState("");
  const targetSchedule = useMemo(
    () => schedules.find((s) => s.id === targetScheduleId) || null,
    [schedules, targetScheduleId]
  );

  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [quotaPick, setQuotaPick] = useState("");

  /* ===== Load siswa: hanya verified ===== */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const qUsers = query(
          collection(db, "users_app"),
          where("role", "==", "siswa"),
          orderBy("createdAt", "asc"),
          limit(4000)
        );
        const snap = await getDocs(qUsers);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const onlyVerified = list.filter(isPaid);
        onlyVerified.sort((a, b) => verifiedAtMs(a) - verifiedAtMs(b));
        setRows(onlyVerified);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ===== Load jadwal aktif ===== */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "exam_schedules"), where("active", "==", true))
        );
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMs(a.windowStartAt) - toMs(b.windowStartAt));
        setSchedules(list);
        if (list.length && !targetScheduleId) setTargetScheduleId(list[0].id);
      } catch (e) {
        console.error(e);
        setSchedules([]);
      }
    })();
  }, [targetScheduleId]);

  /* ===== Level options ===== */
  const levelOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const lv = (r.registrationLevel || "").toString().trim();
      if (lv) set.add(lv);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [rows]);

  /* ===== Stats ===== */
  const stats = useMemo(() => {
    let has = 0,
      none = 0;
    rows.forEach((r) => (r.examScheduleId ? has++ : none++));
    return { has, none, all: rows.length };
  }, [rows]);

  /* ===== View (termasuk filter Gelombang) ===== */
  const view = useMemo(() => {
    let base = rows;
    if (filterScheduleId !== "ALL") base = base.filter((r) => r.examScheduleId === filterScheduleId);
    if (filterLevel !== "ALL")
      base = base.filter((r) => (r.registrationLevel || "").toString().trim() === filterLevel);
    if (filterScheduleStatus === "HAS") base = base.filter((r) => !!r.examScheduleId);
    else if (filterScheduleStatus === "NONE") base = base.filter((r) => !r.examScheduleId);

    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      const name =
        r.fullName ||
        r.namaLengkap ||
        r.nama ||
        r.name ||
        r.profile?.fullName ||
        r.profile?.name ||
        "";
      return r.id?.toLowerCase().includes(q) || String(name).toLowerCase().includes(q);
    });
  }, [rows, search, filterScheduleId, filterLevel, filterScheduleStatus]);

  /* ===== Hitung terisi utk target jadwal ===== */
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    (async () => {
      if (!targetSchedule) {
        setFilled(0);
        return;
      }
      try {
        const snap = await getDocs(
          query(collection(db, "users_app"), where("examScheduleId", "==", targetSchedule.id))
        );
        setFilled(snap.size);
      } catch (e) {
        console.error(e);
        setFilled(0);
      }
    })();
  }, [targetSchedule]);

  /* ===== Select helpers ===== */
  const allChecked = view.length > 0 && view.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) view.forEach((r) => next.delete(r.id));
    else view.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleRow = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  useEffect(() => {
    setSelected(new Set());
  }, [filterScheduleId, filterLevel, filterScheduleStatus, targetScheduleId]);

  /* ===== Auto select by Kuota ===== */
  useEffect(() => {
    const n = Number(quotaPick);
    if (!Number.isFinite(n) || n <= 0) return;
    const pool = view.filter((r) => !r.examScheduleId);
    const chosen = pool.slice(0, n).map((r) => r.id);
    setSelected(new Set(chosen));
  }, [quotaPick, view]);

  /* ===== Assign ke target jadwal ===== */
  const assignNow = async () => {
    if (!targetSchedule || selected.size === 0) return;
    try {
      setSaving(true);
      const ws = ts(targetSchedule.windowStartAt);
      const we = ts(targetSchedule.windowEndAt);
      const max = Number(targetSchedule.maxCandidates || 0) || null;
      const remaining = max ? Math.max(max - filled, 0) : null;
      if (max && remaining === 0) {
        alert("Kuota jadwal ini sudah penuh.");
        setSaving(false);
        return;
      }
      const chosen = view
        .filter((r) => selected.has(r.id))
        .sort((a, b) => verifiedAtMs(a) - verifiedAtMs(b));
      const finalList = remaining == null ? chosen : chosen.slice(0, remaining);
      if (finalList.length === 0) {
        alert("Tidak ada kandidat yang bisa di-assign (periksa kuota).");
        setSaving(false);
        return;
      }
      const batch = writeBatch(db);
      finalList.forEach((r) => {
        batch.update(doc(db, "users_app", r.id), {
          examScheduleId: targetSchedule.id,
          examWindowStartAt: ws,
          examWindowEndAt: we,
          examEligible: true,
        });
      });
      await batch.commit();

      const ids = new Set(finalList.map((r) => r.id));
      setRows((prev) =>
        prev.map((r) =>
          ids.has(r.id)
            ? {
                ...r,
                examScheduleId: targetSchedule.id,
                examWindowStartAt: ws,
                examWindowEndAt: we,
                examEligible: true,
              }
            : r
        )
      );
      setSelected(new Set());

      const snap = await getDocs(
        query(collection(db, "users_app"), where("examScheduleId", "==", targetSchedule.id))
      );
      setFilled(snap.size);
      const msg =
        max != null
          ? `Berhasil assign ${finalList.length} siswa. Terisi: ${snap.size}/${max}.`
          : `Berhasil assign ${finalList.length} siswa.`;
      alert(msg);
    } catch (e) {
      console.error(e);
      alert("Gagal assign jadwal.");
    } finally {
      setSaving(false);
    }
  };

  /* ====== WA Cell ====== */
  function WaCell({ nisn, name, wsMs, weMs, scheduleId }) {
    const [loading, setLoading] = useState(true);
    const [phoneRaw, setPhoneRaw] = useState("");
    const [hasPhone, setHasPhone] = useState(false);
    const [sent, setSent] = useState(false);
    const [localWs, setLocalWs] = useState(wsMs || 0);
    const [localWe, setLocalWe] = useState(weMs || 0);

    // Baca flag lokal (legacy) — tetap dipertahankan
    useEffect(() => {
      try {
        const map = JSON.parse(localStorage.getItem("wa_sent_flags") || "{}");
        if (map && map[nisn]) setSent(true);
      } catch {}
    }, [nisn]);

    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          setLoading(true);
          const ppdbRef = doc(db, "ppdb", String(nisn));
          const ppdbSnap = await getDoc(ppdbRef);
          if (!alive) return;
          if (ppdbSnap.exists()) {
            const d = ppdbSnap.data() || {};
            const wa = (d.waliWa || "").toString().trim();
            const telp = (d.waliTelp || d.waliTel || "").toString().trim();
            const chosen = wa || telp || "";
            setPhoneRaw(chosen);
            setHasPhone(!!chosen);

            // === [ADD] sinkron global: jika waNotified true → tampil "Terkirim" ke semua akun ===
            if (d.waNotified === true) setSent(true);
          } else {
            setPhoneRaw("");
            setHasPhone(false);
          }

          if ((!wsMs || !weMs) && scheduleId) {
            const schRef = doc(db, "exam_schedules", String(scheduleId));
            const schSnap = await getDoc(schRef);
            if (!alive) return;
            if (schSnap.exists()) {
              const sd = schSnap.data() || {};
              const a = toMs(sd.windowStartAt);
              const b = toMs(sd.windowEndAt);
              if (a) setLocalWs(a);
              if (b) setLocalWe(b);
            }
          }
        } catch (e) {
          console.error("Fetch WA/jadwal error:", e);
          if (!alive) return;
          setPhoneRaw("");
          setHasPhone(false);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [nisn, scheduleId, wsMs, weMs]);

    // === Mobile intent WA (tanpa web) + sinkron flag global ===
    const handleSend = async () => {
      if (!hasPhone) return;
      const phone = normalizePhoneID(phoneRaw);
      if (!phone) return;

      const jadwal = fmtJadwalSurat(localWs, localWe);

      let origin = "";
      try { origin = window?.location?.origin || ""; } catch {}
      const loginUrl = origin ? `${origin}/login` : "/login";
      const username = String(nisn);
      const password = String(nisn);

      const lines = [
  "Bismillah.",
  "Panitia SPMB Ponpes As-Sunnah",
  "",
  "Kepada Yth. Bapak/Ibu Orang Tua/Wali Peserta,",
  `Nama   : ${nama}`,
  `NISN   : ${nisnText}`,
  "",
  "Undangan Pelaksanaan Ujian SPMB (Jenjang SD/TK)",
  `Hari/Tanggal : ${hariTanggal}`,
  `Waktu        : ${waktu}`,
  "Tempat       : Lantai 2 Masjid, Ponpes As-Sunnah",
  "",
  "Pelaksanaan ujian untuk jenjang SD dan TK dilakukan secara offline (langsung di lokasi).",
  "",
  "Peserta wajib hadir bersama wali yang sesuai",
  "(Peserta putra bersama wali putra dan peserta putri bersama wali putri),",
  "datang tepat waktu, serta berpakaian rapi dan sopan.",
  "Dianjurkan hadir 10–15 menit lebih awal.",
  "",
  "Apabila terdapat informasi yang belum jelas,",
  "silakan menghubungi panitia.",
  "",
  "Jazakumullahu khairan.",
  "Panitia SPMB Ponpes As-Sunnah",
];

const pesan = lines.join("\n");


      let ua = "";
      try { ua = navigator?.userAgent || ""; } catch {}
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Windows Phone/i.test(ua);

      const waWeb = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(pesan)}`;
      const waScheme = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(pesan)}`;
      const waBizScheme = `whatsapp-business://send?phone=${phone}&text=${encodeURIComponent(pesan)}`;
      const waIntent = `intent://send/?phone=${phone}&text=${encodeURIComponent(pesan)}#Intent;scheme=whatsapp;end`;

      try {
        if (isMobile) {
          try { window.location.href = waIntent; } catch {}
          setTimeout(() => { try { window.location.href = waScheme; } catch {} }, 200);
          setTimeout(() => { try { window.location.href = waBizScheme; } catch {} }, 450);
        } else {
          window.open(waWeb, "_blank", "noopener,noreferrer");
        }

        // === [ADD] tandai global di Firestore agar terlihat lintas akun ===
        try {
          await updateDoc(doc(db, "ppdb", String(nisn)), {
            waNotified: true,
            waNotifiedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("Gagal update flag waNotified:", e);
        }

        // Legacy lokal
        setSent(true);
        try {
          const map = JSON.parse(localStorage.getItem("wa_sent_flags") || "{}");
          map[nisn] = true;
          localStorage.setItem("wa_sent_flags", JSON.stringify(map));
        } catch {}
      } catch (e) {
        console.error("Open WhatsApp link failed:", e);
      }
    };

    if (loading) return <span className="text-slate-500">Memuat…</span>;
    if (!hasPhone) {
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          Tidak memiliki nomor WA
        </span>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleSend}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 w-full sm:w-auto"
        >
          Kirim via WhatsApp
        </button>

        {sent && (
          <>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 size={14} /> Sudah terkirim
            </span>
            <span className="inline-flex sm:hidden items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 size={12} /> Terkirim
            </span>
          </>
        )}
      </div>
    );
  }

  /* ===== [ADD] — Download sesuai filter Gelombang ===== */
  async function downloadByGelombang() {
    try {
      // Ambil basis data dari "view" (sudah terfilter gelombang + level + status + search)
      // tetapi requirement utamanya: sesuai filter gelombang yang dipilih.
      const base = view;

      if (!base.length) {
        alert("Tidak ada data untuk diunduh pada filter saat ini.");
        return;
      }

      // Helper baca nomor WA dari koleksi ppdb/{nisn}
      async function getWa(nisn) {
        try {
          const snap = await getDoc(doc(db, "ppdb", String(nisn)));
          if (!snap.exists()) return "";
          const d = snap.data() || {};
          const chosen = (d.waliWa || d.waliTelp || d.waliTel || "").toString().trim();
          return normalizePhoneID(chosen);
        } catch {
          return "";
        }
      }

      // Siapkan rows
      const rows = [];
      for (let i = 0; i < base.length; i++) {
        const r = base[i];
        const name =
          r.fullName || r.namaLengkap || r.nama || r.name ||
          r.profile?.fullName || r.profile?.name || "—";
        const jenjang = (r.registrationLevel || "").toString().trim() || "—";
        const nisn = String(r.id || "");
        const wa = await getWa(nisn);

        rows.push({
          no: i + 1,
          name,
          jenjang,
          username: nisn,
          password: nisn,
          wa,
        });
      }

      // Render ke HTML table (xls download)
      const esc = (s) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const header = ["No", "Nama", "Jenjang", "Username", "Password", "Nomor WA"];
      const head = `<tr>${header
        .map((h) => `<th style="background:#f1f5f9;text-align:left">${esc(h)}</th>`)
        .join("")}</tr>`;
      const body = rows
        .map((r) => {
          const tds = [
            `<td>${esc(r.no)}</td>`,
            `<td>${esc(r.name)}</td>`,
            `<td>${esc(r.jenjang)}</td>`,
            `<td style="mso-number-format:'\\@'">${esc(r.username)}</td>`,
            `<td style="mso-number-format:'\\@'">${esc(r.password)}</td>`,
            `<td style="mso-number-format:'\\@'">${esc(r.wa)}</td>`,
          ];
          return `<tr>${tds.join("")}</tr>`;
        })
        .join("");

      const gel =
        filterScheduleId === "ALL"
          ? "SEMUA-GELOMBANG"
          : `GELOMBANG-${String(filterScheduleId).replace(/\s+/g, "_")}`;

      const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head>
<body>
  <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">
    <caption style="caption-side:top;margin-bottom:8px;font-weight:bold">
      Daftar Peserta — ${esc(gel)}
    </caption>
    ${head}
    ${body}
  </table>
</body>
</html>`.trim();

      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `peserta-${gel}-${stamp}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal membuat file unduhan.");
    }
  }

  /* =============== UI =============== */
  return (
    <div className="bg-white font-sans antialiased text-slate-900">
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem-4rem)]">
        <div className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight">Verifikasi Tes Akademik</h1>

          <div className="mt-2 text-xs text-slate-600">
            Total: <b>{stats.all}</b> • Sudah dijadwalkan: <b>{stats.has}</b> • Belum:{" "}
            <b>{stats.none}</b>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* LEFT */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">

              {/* ===== GEL0MBANG — PALING MENCOLOK ===== */}
              <div className="order-first w-full sm:order-none sm:w-auto">
                <label className="block text-sm font-bold text-indigo-800 mb-1">
                  Gelombang (Filter Utama)
                </label>
                <div className="rounded-xl border-2 border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/70 shadow-sm hover:bg-white transition-colors">
                  <select
                    value={filterScheduleId}
                    onChange={(e) => setFilterScheduleId(e.target.value)}
                    className="w-full rounded-[10px] bg-transparent px-3 py-2.5 text-base font-semibold text-indigo-900 outline-none"
                  >
                    <option value="ALL">Semua Gelombang</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || s.id} — {new Date(toMs(s.windowStartAt)).toLocaleString()} s/d{" "}
                        {new Date(toMs(s.windowEndAt)).toLocaleString()} {s.level ? `(${s.level})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* ===== END GEL0MBANG ===== */}

              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                title={allChecked ? "Kosongkan (semua terlihat)" : "Pilih Semua (terlihat)"}
              >
                {allChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                <span className="hidden sm:inline">
                  {allChecked ? "Kosongkan" : "Pilih Semua"}
                </span>
              </button>

              <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Tingkat</label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                >
                  <option value="ALL">Semua Tingkat</option>
                  {levelOptions.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Status Jadwal</label>
                <select
                  value={filterScheduleStatus}
                  onChange={(e) => setFilterScheduleStatus(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                >
                  <option value="ALL">Semua</option>
                  <option value="HAS">Sudah Dijadwalkan</option>
                  <option value="NONE">Belum Dijadwalkan</option>
                </select>
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari NISN / Nama…"
                  className="w-64 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-base"
                  aria-label="Cari"
                />
              </div>
            </div>

            {/* RIGHT (DESKTOP DEFAULT) */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Jadwal Target</label>
                <select
                  value={targetScheduleId}
                  onChange={(e) => setTargetScheduleId(e.target.value)}
                  className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                >
                  {schedules.length === 0 ? (
                    <option value="">— Tidak ada jadwal aktif —</option>
                  ) : (
                    schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || s.id}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <UsersRound size={16} />
                  Kuota Pilihan
                </label>
                <input
                  type="number"
                  min="1"
                  value={quotaPick}
                  onChange={(e) => setQuotaPick(e.target.value)}
                  placeholder="mis. 30"
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                />
              </div>

              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                Terpilih: <b className="ml-1">{selected.size}</b>
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                Kuota Jadwal: <b className="ml-1">{targetSchedule?.maxCandidates ?? "—"}</b>
                {targetSchedule?.maxCandidates ? (
                  <span className="ml-2 text-slate-500">
                    Terisi: {filled}, Sisa: {Math.max(Number(targetSchedule.maxCandidates) - filled, 0)}
                  </span>
                ) : (
                  <span className="ml-2 text-slate-500">(Tidak dibatasi)</span>
                )}
              </span>

              <button
                onClick={assignNow}
                disabled={!targetSchedule || selected.size === 0 || saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving ? "Memproses…" : "Assign ke Jadwal"}
              </button>

              {/* === [ADD] Tombol Download sesuai filter Gelombang === */}
              <button
                onClick={downloadByGelombang}
                className="rounded-lg border border-emerald-600 px-4 py-2 text-base font-semibold text-emerald-700 hover:bg-emerald-50"
                title="Unduh daftar sesuai filter gelombang"
              >
                ⬇️ Download (Gelombang)
              </button>
            </div>

            {/* RIGHT (MOBILE) */}
            <div className="sm:hidden space-y-2">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Jadwal Target
                </label>
                <select
                  value={targetScheduleId}
                  onChange={(e) => setTargetScheduleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                >
                  {schedules.length === 0 ? (
                    <option value="">— Tidak ada jadwal aktif —</option>
                  ) : (
                    schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || s.id}
                      </option>
                    ))
                  )}
                </select>

                <div className="mt-2 text-xs text-slate-600">
                  Kuota Jadwal: <b>{targetSchedule?.maxCandidates ?? "—"}</b>
                  {targetSchedule?.maxCandidates ? (
                    <span className="ml-2">
                      Terisi: {filled} • Sisa: {Math.max(Number(targetSchedule.maxCandidates) - filled, 0)}
                    </span>
                  ) : (
                    <span className="ml-2">(Tidak dibatasi)</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">
                  Kuota Pilihan
                </label>
                <input
                  type="number"
                  min="1"
                  value={quotaPick}
                  onChange={(e) => setQuotaPick(e.target.value)}
                  placeholder="mis. 30"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  Terpilih: <b className="ml-1">{selected.size}</b>
                </span>
                <button
                  onClick={assignNow}
                  disabled={!targetSchedule || selected.size === 0 || saving}
                  className="ml-auto rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? "Memproses…" : "Assign ke Jadwal"}
                </button>
              </div>

              {/* === [ADD] Tombol Download (mobile) === */}
              <button
                onClick={downloadByGelombang}
                className="w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                title="Unduh daftar sesuai filter gelombang"
              >
                ⬇️ Download (Gelombang)
              </button>
            </div>
            {/* END RIGHT (MOBILE) */}
          </div>
        </div>

        {/* ===================== DESKTOP TABLE ===================== */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow hidden sm:block">
          <table className="min-w-full text-base">
            <thead className="bg-slate-50 text-slate-800">
              <tr>
                <th className="w-12 px-3 py-3 text-left"><span className="sr-none">Pilih</span></th>
                <th className="px-3 py-3 text-left">NISN</th>
                <th className="px-3 py-3 text-left">Nama</th>
                <th className="px-3 py-3 text-left">Tingkat</th>
                <th className="px-3 py-3 text-left">Terverifikasi Pada</th>
                <th className="px-3 py-3 text-left">Jadwal</th>
                <th className="px-3 py-3 text-left">Kontak / WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-600">Memuat data…</td></tr>
              ) : view.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-600">Tidak ada data.</td></tr>
              ) : (
                view.map((r, i) => {
                  const name =
                    r.fullName || r.namaLengkap || r.nama || r.name ||
                    r.profile?.fullName || r.profile?.name || "—";
                  const verifiedStr = new Date(verifiedAtMs(r)).toLocaleString();
                  const wsMs = toMs(r.examWindowStartAt);
                  const weMs = toMs(r.examWindowEndAt);
                  const wsStr = wsMs ? new Date(wsMs).toLocaleString() : null;
                  const weStr = weMs ? new Date(weMs).toLocaleString() : null;
                  const level = (r.registrationLevel || "").toString().trim() || "—";

                  return (
                    <tr key={r.id} className={i % 2 ? "bg-slate-50/50" : "bg-white"}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                          aria-label={`pilih ${r.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono">{r.id}</td>
                      <td className="px-3 py-2 font-medium">{name}</td>
                      <td className="px-3 py-2">{level}</td>
                      <td className="px-3 py-2">{verifiedStr}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {r.examScheduleId ? (
                          <>
                            <div className="font-semibold">{r.examScheduleId}</div>
                            <div className="text-xs text-slate-600">
                              {wsStr} — {weStr}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-500">Belum</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <WaCell
                          nisn={r.id}
                          name={name}
                          wsMs={wsMs}
                          weMs={weMs}
                          scheduleId={r.examScheduleId || ""}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ===================== MOBILE LIST ===================== */}
        <div className="sm:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow p-4 text-center text-slate-600">
              Memuat data…
            </div>
          ) : view.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow p-4 text-center text-slate-600">
              Tidak ada data.
            </div>
          ) : (
            <ul className="space-y-3">
              {view.map((r) => {
                const name =
                  r.fullName || r.namaLengkap || r.nama || r.name ||
                  r.profile?.fullName || r.profile?.name || "—";
                const level = (r.registrationLevel || "").toString().trim() || "—"; 
                const wsMs = toMs(r.examWindowStartAt);
                const weMs = toMs(r.examWindowEndAt);
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900 truncate">{name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Jenjang: {level}</p>
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        aria-label={`pilih ${r.id}`}
                      />
                    </div>

                    <div className="mt-3">
                      <WaCell
                        nisn={r.id}
                        name={name}
                        wsMs={wsMs}
                        weMs={weMs}
                        scheduleId={r.examScheduleId || ""}
                      />
                    </div>
                  </li>
                );
              })}

            </ul>
          )}
        </div>
        {/* =================== END MOBILE LIST =================== */}
      </div>
    </div>
  );
}

