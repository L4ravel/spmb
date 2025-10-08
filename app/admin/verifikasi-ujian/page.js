"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  doc,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckSquare, Square, Search, UsersRound } from "lucide-react";

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

// waktu verifikasi utk prioritas
const verifiedAtMs = (r) =>
  toMs(r.registrationPaymentVerifiedAt) ||
  toMs(r.reRegistrationPaymentVerifiedAt) ||
  toMs(r.registrationPaymentAt) ||
  toMs(r.updatedAt) ||
  toMs(r.createdAt);

/* ========== Page ========== */
export default function VerifikasiUjian() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [schedules, setSchedules] = useState([]);

  // Filter gelombang (ALL = semua)
  const [filterScheduleId, setFilterScheduleId] = useState("ALL");

  // Filter Tingkat (dari users_app.registrationLevel)
  const [filterLevel, setFilterLevel] = useState("ALL");

  // 🔎 BARU: Filter status jadwal (ALL | HAS | NONE)
  const [filterScheduleStatus, setFilterScheduleStatus] = useState("ALL");

  // Jadwal target untuk assign
  const [targetScheduleId, setTargetScheduleId] = useState("");
  const targetSchedule = useMemo(
    () => schedules.find((s) => s.id === targetScheduleId) || null,
    [schedules, targetScheduleId]
  );

  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Kuota input (auto select)
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
        // urut: paling awal diverifikasi → terbaru
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
        // default: filter semua; target jadwal = yang pertama (jika ada)
        if (list.length && !targetScheduleId) setTargetScheduleId(list[0].id);
      } catch (e) {
        console.error(e);
        setSchedules([]);
      }
    })();
  }, [targetScheduleId]);

  /* ===== Options Tingkat (unik & terurut) ===== */
  const levelOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const lv = (r.registrationLevel || "").toString().trim();
      if (lv) set.add(lv);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [rows]);

  /* ===== Stats jadwal (untuk badge kecil) ===== */
  const stats = useMemo(() => {
    let has = 0,
      none = 0;
    rows.forEach((r) => (r.examScheduleId ? has++ : none++));
    return { has, none, all: rows.length };
  }, [rows]);

  /* ===== View: filter by schedule + level + status + search ===== */
  const view = useMemo(() => {
    let base = rows;

    // Filter gelombang spesifik
    if (filterScheduleId !== "ALL") {
      base = base.filter((r) => r.examScheduleId === filterScheduleId);
    }

    // Filter Tingkat
    if (filterLevel !== "ALL") {
      base = base.filter(
        (r) => (r.registrationLevel || "").toString().trim() === filterLevel
      );
    }

    // 🔎 Filter Status Jadwal
    if (filterScheduleStatus === "HAS") {
      base = base.filter((r) => !!r.examScheduleId);
    } else if (filterScheduleStatus === "NONE") {
      base = base.filter((r) => !r.examScheduleId);
    }

    // Search
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

  // Reset pilihan saat ganti filter/target
  useEffect(() => {
    setSelected(new Set());
  }, [filterScheduleId, filterLevel, filterScheduleStatus, targetScheduleId]);

  /* ===== Auto select by Kuota (ambil yang BELUM dijadwalkan dari hasil FILTER) ===== */
  useEffect(() => {
    const n = Number(quotaPick);
    if (!Number.isFinite(n) || n <= 0) return;
    const pool = view.filter((r) => !r.examScheduleId); // hanya yang belum punya jadwal
    const chosen = pool.slice(0, n).map((r) => r.id);
    setSelected(new Set(chosen));
  }, [quotaPick, view]);

  /* ===== Assign ke target jadwal (hormati kuota jadwal bila ada) ===== */
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

      // urutkan kandidat terpilih berdasar waktu verifikasi (paling awal → terbaru)
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

      // update UI
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

      // refresh kuota target
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

  /* =============== UI =============== */
  return (
    <div className="bg-white font-sans antialiased text-slate-900">
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem-4rem)]">
        <div className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight">Verifikasi Tes Akademik</h1>
          <p className="mt-1 text-slate-700">
            Filter <b>Gelombang</b>, <b>Tingkat</b>, dan <b>Status Jadwal</b>. Input{" "}
            <b>Kuota Pilihan</b> akan otomatis mencontreng N peserta pertama (yang{" "}
            <i>belum</i> dijadwalkan) dari hasil filter.
          </p>
          <div className="mt-2 text-xs text-slate-600">
            Total: <b>{stats.all}</b> • Sudah dijadwalkan: <b>{stats.has}</b> • Belum:{" "}
            <b>{stats.none}</b>
          </div>
        </div>

        {/* Toolbar – kiri & kanan */}
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* LEFT group */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {/* Select all */}
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

              {/* Filter Gelombang */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Gelombang</label>
                <select
                  value={filterScheduleId}
                  onChange={(e) => setFilterScheduleId(e.target.value)}
                  className="min-w-[280px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  title="Filter gelombang"
                >
                  <option value="ALL">Semua Gelombang</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || s.id} — {new Date(toMs(s.windowStartAt)).toLocaleString()} s/d{" "}
                      {new Date(toMs(s.windowEndAt)).toLocaleString()}{" "}
                      {s.level ? `(${s.level})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tingkat */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Tingkat</label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  title="Filter berdasarkan registrationLevel"
                >
                  <option value="ALL">Semua Tingkat</option>
                  {levelOptions.map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
              </div>

              {/* 🔎 Filter Status Jadwal */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Status Jadwal</label>
                <select
                  value={filterScheduleStatus}
                  onChange={(e) => setFilterScheduleStatus(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  title="Filter peserta berdasarkan ada/tidaknya jadwal"
                >
                  <option value="ALL">Semua</option>
                  <option value="HAS">Sudah Dijadwalkan</option>
                  <option value="NONE">Belum Dijadwalkan</option>
                </select>
              </div>

              {/* Search */}
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

            {/* RIGHT group */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {/* Jadwal Target */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-800">Jadwal Target</label>
                <select
                  value={targetScheduleId}
                  onChange={(e) => setTargetScheduleId(e.target.value)}
                  className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  title="Jadwal tujuan assign"
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

              {/* Kuota pilihan */}
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
                  title="Masukkan jumlah yang ingin otomatis dipilih (N tertua & belum dijadwalkan)"
                />
              </div>

              {/* Badges */}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                Terpilih: <b className="ml-1">{selected.size}</b>
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                Kuota Jadwal: <b className="ml-1">{targetSchedule?.maxCandidates ?? "—"}</b>
                {targetSchedule?.maxCandidates ? (
                  <span className="ml-2 text-slate-500">
                    Terisi: {filled}, Sisa:{" "}
                    {Math.max(Number(targetSchedule.maxCandidates) - filled, 0)}
                  </span>
                ) : (
                  <span className="ml-2 text-slate-500">(Tidak dibatasi)</span>
                )}
              </span>

              {/* Assign */}
              <button
                onClick={assignNow}
                disabled={!targetSchedule || selected.size === 0 || saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving ? "Memproses…" : "Assign ke Jadwal"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow">
          <table className="min-w-full text-base">
            <thead className="bg-slate-50 text-slate-800">
              <tr>
                <th className="w-12 px-3 py-3 text-left"><span className="sr-only">Pilih</span></th>
                <th className="px-3 py-3 text-left">NISN</th>
                <th className="px-3 py-3 text-left">Nama</th>
                <th className="px-3 py-3 text-left">Tingkat</th>
                <th className="px-3 py-3 text-left">Terverifikasi Pada</th>
                <th className="px-3 py-3 text-left">Jadwal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-600">Memuat data…</td></tr>
              ) : view.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-600">Tidak ada data.</td></tr>
              ) : (
                view.map((r, i) => {
                  const name =
                    r.fullName || r.namaLengkap || r.nama || r.name ||
                    r.profile?.fullName || r.profile?.name || "—";
                  const verifiedStr = new Date(verifiedAtMs(r)).toLocaleString();
                  const wsStr = r.examWindowStartAt ? new Date(toMs(r.examWindowStartAt)).toLocaleString() : null;
                  const weStr = r.examWindowEndAt ? new Date(toMs(r.examWindowEndAt)).toLocaleString() : null;
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
