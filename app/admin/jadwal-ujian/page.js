"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ====== WITA ====== */
const TZ = "Asia/Makassar";
const TZ_LABEL = "WITA (Asia/Makassar, UTC+8)";

/* ====== Utils ====== */
const toTimestamp = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const ms = new Date(`${dateStr}T${timeStr}:00`).getTime();
  return Number.isFinite(ms) ? Timestamp.fromMillis(ms) : null;
};
const toMs = (v) =>
  typeof v?.toMillis === "function" ? v.toMillis() : new Date(String(v)).getTime() || 0;
const fmtWITA = (ms) =>
  ms
    ? new Date(ms).toLocaleString("id-ID", {
        timeZone: TZ,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

/* ====== Preset ====== */
function buildPreset(key, base = new Date()) {
  const d = new Date(base);

  const mk = (offset, sh, sm, eh, em) => {
    const s = new Date(d);
    s.setDate(d.getDate() + offset);
    s.setHours(sh, sm, 0, 0);

    const e = new Date(d);
    e.setDate(d.getDate() + offset);
    e.setHours(eh, em, 0, 0);

    return {
      start: Timestamp.fromMillis(s.getTime()),
      end: Timestamp.fromMillis(e.getTime()),
    };
  };

 // helper: cari offset hari ke depan (Sabtu=6, Ahad=0)
const nextDayOffset = (targetDay) => {
  const today = d.getDay();
  const diff = (targetDay - today + 7) % 7;
  return diff === 0 ? 7 : diff;
};

switch (key) {
  case "presetSat":
  // Sabtu depan 08:00 - 12:00 WITA
  return mk(nextDayOffset(6), 8, 0, 12, 0);

case "presetSun":
  // Ahad depan 08:00 - 12:00 WITA
  return mk(nextDayOffset(0), 8, 0, 12, 0);

  default:
    return { start: null, end: null };
}

}


/* ====== Normalizer kandidat untuk field 'tingkat' (underscore) ====== */
function buildTingkatUnderscoreCandidates(label) {
  const raw = String(label || "").trim();
  if (!raw) return [];

  const up = raw.toUpperCase();
  const set = new Set();

  // bentuk dasar: spasi → _
  const spaceUnd = up.replace(/\s+/g, "_");
  set.add(spaceUnd);
  set.add(up.replace(/[\s-]+/g, "_"));

  // rapikan __ dan trim _
  const collapsed = spaceUnd.replace(/_+/g, "_");
  const trimmed = collapsed.replace(/^_+|_+$/g, "");
  set.add(collapsed);
  set.add(trimmed);
  set.add(`${trimmed}_`); // trailing _ seperti contoh kamu

  // ( ) optional
  const noParen = trimmed.replace(/[()]/g, "");
  set.add(noParen);
  set.add(`${noParen}_`);

  // aman: buang selain A-Z0-9_()
  const safe = up.replace(/[^A-Z0-9_()]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  set.add(safe);
  set.add(`${safe}_`);

  // jika user sengaja pakai __
  if (/__/.test(up)) set.add(up.replace(/__+/g, "_").replace(/^_+|_+$/g, ""));

  return Array.from(set).filter(Boolean).slice(0, 14);
}

/* ====== Kandidat untuk field 'tingkatRaw' (harus case-sensitive) ====== */
function buildTingkatRawCandidates(label) {
  const raw = String(label || "").trim();
  if (!raw) return [];
  const up = raw.toUpperCase();

  // normalisasi spasi dobel jadi satu
  const singleSp = raw.replace(/\s+/g, " ").trim();

  // Title Case sederhana (biar dekat dengan "PIAUD Putra (S1)")
  const title = singleSp.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  // kandidat: persis dari dropdown (raw), versi spasi dirapikan, versi Title Case, dan UPPER
  const uniq = Array.from(new Set([raw, singleSp, title, up]));
  return uniq.slice(0, 6);
}

/* ====== Page ====== */
export default function JadwalUjianPage() {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");          // label apa adanya dari DB
  const [mapel, setMapel] = useState("");
  const [paketId, setPaketId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [maxCandidates, setMaxCandidates] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [levels, setLevels] = useState([]);        // simpan label asli (tidak uppercase)
  const [levelsLoading, setLevelsLoading] = useState(true);

  const [mapelOpts, setMapelOpts] = useState([]);
  const [paketOpts, setPaketOpts] = useState([]);
  const [soalLoading, setSoalLoading] = useState(false);

  const [listLevelFilter, setListLevelFilter] = useState("ALL");

  const canSubmit = useMemo(
    () => title.trim() && level.trim() && mapel.trim() && paketId.trim() && dateStart && timeStart && dateEnd && timeEnd,
    [title, level, mapel, paketId, dateStart, timeStart, dateEnd, timeEnd]
  );

  /* ---- Ambil jenjang dari users_app, dedup case-insensitive tapi simpan label asli ---- */
  useEffect(() => {
    (async () => {
      try {
        setLevelsLoading(true);
        const snap = await getDocs(
          query(collection(db, "users_app"), where("role", "==", "siswa"), limit(2000))
        );
        const byUpper = new Map(); // UPPER -> labelAsli
        snap.docs.forEach((d) => {
          const lvRaw = String(d.data()?.registrationLevel || "").trim();
          if (!lvRaw) return;
          const key = lvRaw.toUpperCase();
          if (!byUpper.has(key)) byUpper.set(key, lvRaw);
        });
        const options = Array.from(byUpper.values()).sort((a,b)=>a.localeCompare(b));
        setLevels(options);
        if (!level && options.length === 1) setLevel(options[0]);
      } catch (e) {
        console.error("Load levels error", e);
        setLevels([]);
      } finally {
        setLevelsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Ambil Mapel & Paket dari koleksi soal, berdasar Jenjang ---- */
  useEffect(() => {
    (async () => {
      if (!level) {
        setMapelOpts([]); setPaketOpts([]); setMapel(""); setPaketId(""); 
        return;
      }
      try {
        setSoalLoading(true);

        const merged = new Map(); // id -> doc

        const underCandidates = buildTingkatUnderscoreCandidates(level);
        const rawCandidates = buildTingkatRawCandidates(level);

        const runQ = async (fieldName, value, withAktif) => {
          const parts = [collection(db, "soal"), where(fieldName, "==", value)];
          if (withAktif) parts.push(where("aktif", "==", true));
          const s = await getDocs(query(...parts, limit(2000)));
          s.docs.forEach((d) => merged.set(d.id, d));
        };

        // 1) tingkat (underscore) dengan aktif == true
        for (const t of underCandidates) await runQ("tingkat", t, true);

        // 2) jika kosong, tingkat tanpa filter aktif
        if (merged.size === 0) for (const t of underCandidates) await runQ("tingkat", t, false);

        // 3) tingkatRaw (case sensitive) – coba label asli & variasinya
        if (merged.size === 0) for (const r of rawCandidates) await runQ("tingkatRaw", r, true);
        if (merged.size === 0) for (const r of rawCandidates) await runQ("tingkatRaw", r, false);

        // 4) alias nama field alternatif
        if (merged.size === 0) for (const t of underCandidates) await runQ("tingkat_key", t, true);
        if (merged.size === 0) for (const t of underCandidates) await runQ("tingkat_key", t, false);

        const docs = Array.from(merged.values());
        const mapelSet = new Set();
        const paketSet = new Set();

        docs.forEach((d) => {
          const data = d.data() || {};
          const m = String(data.mapel ?? data.subject ?? data.mapelName ?? "").trim();
          const p = String(data.paketId ?? data.paket ?? data.paket_id ?? "").trim();
          if (m) mapelSet.add(m);
          if (p) paketSet.add(p);
        });

        const mOpts = Array.from(mapelSet).sort();
        const pOpts = Array.from(paketSet).sort();

        setMapelOpts(mOpts);
        setPaketOpts(pOpts);

        if (mOpts.length === 1) setMapel(mOpts[0]); else if (!mOpts.includes(mapel)) setMapel("");
        if (pOpts.length === 1) setPaketId(pOpts[0]); else if (!pOpts.includes(paketId)) setPaketId("");
      } catch (e) {
        console.error("Load soal error", e);
        setMapelOpts([]); setPaketOpts([]); setMapel(""); setPaketId("");
      } finally {
        setSoalLoading(false);
      }
    })();
  }, [level]); 

  /* ---- Load schedules list ---- */
  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "exam_schedules"), orderBy("windowStartAt", "asc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  /* ---- Submit ---- */
  const canSubmitNow = canSubmit;
  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmitNow) return;
    try {
      setSaving(true);
      const ws = toTimestamp(dateStart, timeStart);
      const we = toTimestamp(dateEnd, timeEnd);
      if (!ws || !we || ws.toMillis() >= we.toMillis()) {
        alert("Rentang waktu tidak valid."); setSaving(false); return;
      }
      await addDoc(collection(db, "exam_schedules"), {
        title: title.trim(),
        level: level.trim(),                // simpan label apa adanya
        mapel: mapel.trim(),
        paketId: paketId.trim(),
        windowStartAt: ws,
        windowEndAt: we,
        maxCandidates: maxCandidates ? Number(maxCandidates) : null,
        active: Boolean(active),
        createdAt: Timestamp.now(),
        createdBy: "admin",
      });
      setTitle(""); setMapel(mapelOpts.length === 1 ? mapelOpts[0] : ""); setPaketId(paketOpts.length === 1 ? paketOpts[0] : "");
      setDateStart(""); setTimeStart(""); setDateEnd(""); setTimeEnd(""); setMaxCandidates(""); setActive(true);
      await load();
    } catch (e) {
      console.error(e); alert("Gagal menyimpan jadwal.");
    } finally { setSaving(false); }
  };

  const toggleActive = async (r) => {
    try {
      await updateDoc(doc(db, "exam_schedules", r.id), { active: !r.active });
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
    } catch (e) {
      console.error(e); alert("Gagal mengubah status aktif.");
    }
  };

  const removeSchedule = async (r) => {
    if (!confirm(`Hapus jadwal "${r.title || r.id}"?`)) return;
    try {
      await deleteDoc(doc(db, "exam_schedules", r.id));
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      console.error(e); alert("Gagal menghapus jadwal.");
    }
  };

  const rowsView = useMemo(() => {
    if (listLevelFilter === "ALL") return rows;
    const key = String(listLevelFilter || "").toUpperCase();
    return rows.filter((r) => String(r.level || "").toUpperCase() === key);
  }, [rows, listLevelFilter]);

  /* ====== UI (tetap) ====== */
  return (
    <div className="bg-white font-sans antialiased text-slate-900">
      <div className="w-full max-w-none px-4 md:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem-4rem)]">
        <h1 className="text-2xl md:text-3xl font-extrabold">Buat Jadwal Ujian</h1>
        <p className="mt-1 text-base text-slate-700">
          Tentukan judul, jenjang, serta jendela waktu ujian. Waktu tampil dalam zona: <b>WITA</b>.
        </p>

        {/* Presets */}
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="text-xs md:text-sm text-slate-600 mr-1">Preset cepat:</span>
          {[
  ["presetSat", "Sabtu Depan 08:00–12:00"],
  ["presetSun", "Ahad Depan 08:00–12:00"],
].map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                const { start, end } = buildPreset(k);
                if (!start || !end) return;
                const s = new Date(start.toMillis());
                const e = new Date(end.toMillis());
                const pad = (n) => String(n).padStart(2, "0");
                setDateStart(`${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`);
                setTimeStart(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
                setDateEnd(`${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`);
                setTimeEnd(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(24,0,75,.06)]"
        >
          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Judul</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Gelombang 1 - SMP"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Jenjang</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={levelsLoading}
              required
            >
              <option value="">{levelsLoading ? "Memuat…" : "Pilih jenjang"}</option>
              {levels.map((lv) => (
                <option key={lv.toUpperCase()} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
            {levels.length === 0 && !levelsLoading && (
              <p className="mt-1 text-sm text-amber-700">
                Belum ada data jenjang di <code>users_app</code>.
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Mapel</span>
            <select
              value={mapel}
              onChange={(e) => setMapel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={!level || soalLoading || mapelOpts.length === 0}
              required
            >
              <option value="">{soalLoading ? "Memuat…" : "Pilih mapel"}</option>
              {mapelOpts.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {!soalLoading && level && mapelOpts.length === 0 && (
              <p className="mt-1 text-sm text-amber-700">
                Tidak ada mapel aktif untuk jenjang ini di <code>soal</code>.
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Paket Soal</span>
            <select
              value={paketId}
              onChange={(e) => setPaketId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={!level || soalLoading || paketOpts.length === 0}
              required
            >
              <option value="">{soalLoading ? "Memuat…" : "Pilih paket"}</option>
              {paketOpts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {!soalLoading && level && paketOpts.length === 0 && (
              <p className="mt-1 text-sm text-amber-700">
                Tidak ada paket aktif untuk jenjang ini di <code>soal</code>.
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Tanggal Mulai</span>
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Jam Mulai</span>
            <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Tanggal Selesai</span>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Jam Selesai</span>
            <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Kuota (opsional)</span>
            <input type="number" min="1" value={maxCandidates} onChange={(e) => setMaxCandidates(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="mis. 80" />
          </label>

          <label className="block">
            <span className="text-sm md:text-base font-semibold text-slate-800">Status</span>
            <div className="mt-2 flex items-center gap-2">
              <input id="active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <label htmlFor="active" className="text-base text-slate-900">Aktif</label>
            </div>
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
            <button type="submit" disabled={!canSubmit || saving}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-white text-base font-semibold shadow hover:bg-violet-700 disabled:opacity-60">
              {saving ? "Menyimpan…" : "Simpan Jadwal"}
            </button>
          </div>
        </form>

        {/* List Jadwal */}
        <div className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-bold">Daftar Jadwal</h2>
              <p className="text-sm text-slate-600 mt-1">Ditampilkan dalam zona <b>{TZ_LABEL}</b>.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-800">Filter Jenjang</label>
              <select
                value={listLevelFilter}
                onChange={(e) => setListLevelFilter(e.target.value)}
                className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                title="Tampilkan jadwal berdasarkan jenjang"
              >
                <option value="ALL">Semua Jenjang</option>
                {levels.map((lv) => (
                  <option key={lv.toUpperCase()} value={lv}>{lv}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(24,0,75,.06)]">
            <table className="min-w-full text-base">
              <thead className="bg-slate-50 text-slate-800">
                <tr>
                  <th className="px-3 py-3 text-left">Judul</th>
                  <th className="px-3 py-3 text-left">Jenjang</th>
                  <th className="px-3 py-3 text-left">Mapel</th>
                  <th className="px-3 py-3 text-left">Paket Soal</th>
                  <th className="px-3 py-3 text-left">Rentang Waktu</th>
                  <th className="px-3 py-3 text-left">Kuota</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-600">Memuat jadwal…</td></tr>
                ) : rowsView.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-600">Belum ada jadwal.</td></tr>
                ) : (
                  rowsView.map((r) => {
                    const ws = fmtWITA(toMs(r.windowStartAt));
                    const we = fmtWITA(toMs(r.windowEndAt));
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-semibold">{r.title || r.id}</td>
                        <td className="px-3 py-2">{r.level || "—"}</td>
                        <td className="px-3 py-2">{r.mapel || "—"}</td>
                        <td className="px-3 py-2">{r.paketId || "—"}</td>
                        <td className="px-3 py-2 text-slate-700">{ws} — {we}</td>
                        <td className="px-3 py-2">{r.maxCandidates || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-xs md:text-sm font-semibold",
                              r.active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
                                         "bg-slate-100 text-slate-600 ring-1 ring-slate-200"].join(" ")}>
                            {r.active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleActive(r)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                              {r.active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button onClick={() => removeSchedule(r)}
                              className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Tip: Setelah membuat jadwal, buka halaman <b>Verifikasi Tes Akademik</b> untuk assign jadwal ke siswa.
          </p>
        </div>
      </div>
    </div>
  );
}
