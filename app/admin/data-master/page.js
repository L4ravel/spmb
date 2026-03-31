"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query, limit, startAfter } from "firebase/firestore";
import { db } from "@/lib/firebase";

import Filters from "./components/Filters";
import MobileCards from "./components/MobileCards";
import TableView from "./components/Table";
import DetailModal from "./components/DetailModal";
import EditModal from "./components/EditModal";

import {
  READ_CAP,
  parentStatus, sumIncome,
  statusFromUsersApp, coalesceText,
} from "./lib/utils";

import {
  loadPpdbByNisnMap,
  exportAllToXls,
  deleteParticipant,
  upsertUserAndPpdb,
} from "./lib/ops";

/* ===== Helpers NIK→NISN ===== */
const digits = (v) => String(v || "").replace(/\D/g, "");
const tail8  = (v) => { const d = digits(v); return d.length >= 8 ? d.slice(-8) : ""; };
const upper  = (s) => String(s || "").trim().toUpperCase();

export default function DataMasterPage() {
  const [rows, setRows] = useState([]);           // semua baris (setelah JOIN PPDB & fallback NISN)
  const [grandTotal, setGrandTotal] = useState(0); // total peserta terdaftar (users_app) tanpa filter
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filter/UI state
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterIncome, setFilterIncome] = useState("ALL");
  const [filterParents, setFilterParents] = useState("ALL");
  const [levels, setLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("OFF");
  const [search, setSearch] = useState("");

  // Tampilan jumlah baris (10/25/50)
  const [pageSize, setPageSize] = useState(25);

  // Paging compatibility (nonaktif)
  const [pageIndex, setPageIndex] = useState(0);
  const cursorStack = useRef([]);
  const [hasNext, setHasNext] = useState(false);

  // Modal & aksi
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ====== Load daftar jenjang ====== */
  async function loadRegistrationLevels() {
    setLevelsLoading(true);
    try {
      const uniq = new Set();
      {
        const snapUA = await getDocs(query(collection(db, "users_app"), limit(500)));
        snapUA.forEach((d) => {
          const v = (d.data()?.registrationLevel || "").trim();
          if (v) uniq.add(v);
        });
      }
      {
        const snapPP = await getDocs(query(collection(db, "ppdb"), limit(500)));
        snapPP.forEach((d) => {
          const v = (d.data()?.jenjang || "").trim();
          if (v) uniq.add(v);
        });
      }
      setLevels(Array.from(uniq).sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" })));
    } catch {
      setLevels([]);
    } finally {
      setLevelsLoading(false);
    }
  }
  useEffect(() => { loadRegistrationLevels(); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { void fetchAll(true); }, [filterLevel, filterIncome, filterParents, filterStatus]);

  /* ==================== Ambil SEMUA data (tanpa pagination server) ==================== */
  async function fetchAll(reset = false) {
    try {
      setLoading(true);
      setErr("");

      if (reset) {
        setRows([]);
        setPageIndex(0);
        cursorStack.current = [];
      }

      // Ambil SEMUA dokumen users_app dengan batching
      const BATCH_SIZE = 500;
      const baseClauses = [orderBy("createdAt", "desc")];

      const colUA = collection(db, "users_app");
      const allUA = [];
      let lastDocRef = null;
      let reads = 0;

      while (reads < READ_CAP) {
        const clauses = [...baseClauses];
        if (lastDocRef) clauses.push(startAfter(lastDocRef));
        const snap = await getDocs(query(colUA, ...clauses, limit(BATCH_SIZE)));
        reads += 1;

        if (snap.empty) break;

        const batch = snap.docs.map((d) => ({ _uid: d.id, ...(d.data() || {}) }));
        allUA.push(...batch);

        lastDocRef = snap.docs[snap.docs.length - 1];
        if (snap.size < BATCH_SIZE) break;
      }

      // Simpan total keseluruhan peserta terdaftar (tanpa filter)
      setGrandTotal(allUA.length);

      // Filter status (dari users_app)
      const filteredUA = allUA.filter((u) => {
        const st = statusFromUsersApp(u);
        if (filterStatus === "UNPAID" && st._unpaidEmpty !== true) return false;
        if (filterStatus === "PAID"   && st._paid !== true) return false;
        if (filterStatus === "PASSED" && st._passed !== true) return false;
        return true;
      });

      setHasNext(false);
      setPageIndex(0);

      // Kumpulkan kandidat kunci untuk JOIN PPDB
      const keySet = new Set();
      filteredUA.forEach((u) => {
        const nisn = String(u.nisn || "").trim();
        const nik  = String(u.nik  || "").trim();
        const uid  = String(u._uid || "").trim();
        if (nisn) keySet.add(nisn);
        if (nik)  keySet.add(nik);
        if (uid)  keySet.add(uid);
      });

      const ppdbMap = await loadPpdbByNisnMap(Array.from(keySet));

      // Mapping final (fallback NISN = tail8(NIK))
      const rowsOut = filteredUA.map((u) => {
        const st = statusFromUsersApp(u);
        const level = upper(st?._regLevel || "");

        const nisnU = String(u.nisn || "").trim();
        const nikU  = String(u.nik  || "").trim();
        const uid   = String(u._uid || "").trim();

        // TK/SD pakai NIK lebih dulu; lainnya NISN
        const isTKSD = level.startsWith("TK") || level.startsWith("SD");
        const keysOrdered = (isTKSD ? [nikU, nisnU, uid] : [nisnU, nikU, uid]).filter(Boolean);

        const p = (keysOrdered.map((k) => ppdbMap.get(k)).find(Boolean)) || {};

        const nikAny    = digits(nikU || p.nik || "");
        const nisnFinal = (nisnU || p.nisn || tail8(nikAny) || "").trim();

        const idFinal = p._id || keysOrdered[0] || uid || nisnFinal || nikAny || "";

        return {
          // sebar PPDB dulu, lalu override hasil hitungan
          ...p,

          _id: idFinal,
          nik: nikAny,
          nisn: nisnFinal,

          createdAt: u.createdAt || p.createdAt || null,
          updatedAt: u.updatedAt || p.updatedAt || null,
          nama: coalesceText([u.name, u.fullName, p.nama]),
          jenjang: st._regLevel || p.jenjang || "-",
          ...st,
        };
      });

      setRows(rowsOut);
    } catch (e) {
      console.error(e);
      setErr("Gagal memuat data.");
      setRows([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  // Next/Prev dimatikan (semua data tampil di satu halaman, dibatasi client-side)
  const handleNext = () => {};
  const handlePrev = () => {};

  /* ===== Client filters & search ===== */
  function matchIncomeBracket(total) {
    if (filterIncome === "ALL") return true;
    switch (filterIncome) {
      case "0-1":  return total >= 0 && total < 1_000_000;
      case "1-2":  return total >= 1_000_000 && total < 2_000_000;
      case "2-3":  return total >= 2_000_000 && total < 3_000_000;
      case "3-5":  return total >= 3_000_000 && total < 5_000_000;
      case "5-10": return total >= 5_000_000 && total < 10_000_000;
      case ">=10": return total >= 10_000_000;
      default:     return true;
    }
  }
  function applyClientFilters(r) {
    if (filterLevel !== "ALL") {
      const lvl = upper(r._regLevel || r.registrationLevel || r.jenjang || "");
      if (lvl !== upper(filterLevel)) return false;
    }
    if (filterStatus === "UNPAID" && r._unpaidEmpty !== true) return false;
    if (filterStatus === "PAID"   && r._paid !== true) return false;
    if (filterStatus === "PASSED" && r._passed !== true) return false;
    if (filterParents !== "ALL" && parentStatus(r) !== filterParents) return false;
    const totalIncome = sumIncome(r);
    if (!matchIncomeBracket(totalIncome)) return false;
    return true;
  }

  // base = hasil filter; viewLimited = dibatasi jumlah tampil
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(applyClientFilters);
    if (!q) return filtered;
    return filtered.filter((r) => {
      const nisn = String(r.nisn || r._id || "").toLowerCase();
      const nama = String(r.nama || r.name || "").toLowerCase();
      return nisn.includes(q) || nama.includes(q);
    });
  }, [rows, search, filterLevel, filterStatus, filterParents, filterIncome]);

  const view = useMemo(() => base.slice(0, pageSize), [base, pageSize]);

  /* ===== Aksi ===== */
  const openDetail = (r) => { setSelected(r); setOpen(true); };

  async function handleDeleteAll(rec) {
    if (rec._unpaidEmpty !== true) {
      alert("Penghapusan dibatasi untuk peserta 'Belum bayar (status kosong di users_app)'.");
      return;
    }
    const ok = confirm(`Hapus *SELURUH* data peserta ini?\n`);
    if (!ok) return;

    try {
      setDeletingId(String(rec._id || rec.nisn || ""));
      await deleteParticipant(rec);
      setRows((prev) => prev.filter((x) => String(x._id || x.nisn) !== String(rec._id || rec.nisn)));
      if (open && selected && String(selected._id || selected.nisn) === String(rec._id || rec.nisn)) {
        setOpen(false); setSelected(null);
      }
      alert("Data peserta berhasil dihapus (PPDB + users_app + berkas Storage).");
    } catch (e) {
      console.error("handleDeleteAll()", e);
      alert("Gagal menghapus data. Cek izin Firestore/Storage & coba lagi.");
    } finally {
      setDeletingId("");
    }
  }

  function onOpenEdit(row) { setEditTarget(row); setEditOpen(true); }
  async function onSaveEdit(form) {
    if (!editTarget) return;
    const nisn = String(editTarget?.nisn || editTarget?._id || "").trim();
    if (!nisn) { alert("NISN tidak valid."); return; }
    try {
      setSaving(true);
      await upsertUserAndPpdb({
        nisn,
        ppdbDocId: editTarget?._id,
        userPatch: {
          name: form.name,
          registrationLevel: form.registrationLevel,
          finalDecision: form.finalDecision,
          registrationPaymentStatus: form.registrationPaymentStatus,
          examAccessStatus: form.examAccessStatus,
          examAllowed: form.examAllowed,
        },
        ppdbPatch: {
          nama: form.nama, jenjang: form.jenjang,
          ayahNama: form.ayahNama, ibuNama: form.ibuNama,
          hpSiswa: form.hpSiswa, waliWa: form.waliWa,
          ayahIncome: form.ayahIncome, ibuIncome: form.ibuIncome,
          alamat: form.alamat,
        },
      });

      setRows((prev) =>
        prev.map((r) => {
          const same = String(r.nisn || r._id) === nisn;
          if (!same) return r;
          return {
            ...r,
            name: form.name,
            finalDecision: form.finalDecision,
            _regLevel: form.registrationLevel || r._regLevel,
            registrationLevel: form.registrationLevel || r.registrationLevel,
            _regPayStatus: form.registrationPaymentStatus || r._regPayStatus,
            examAccessStatus: form.examAccessStatus ?? r.examAccessStatus,
            examAllowed: typeof form.examAllowed === "boolean" ? form.examAllowed : r.examAllowed,
            nama: form.nama || r.nama,
            jenjang: form.jenjang || r.jenjang,
            ayahNama: form.ayahNama ?? r.ayahNama,
            ibuNama: form.ibuNama ?? r.ibuNama,
            hpSiswa: form.hpSiswa ?? r.hpSiswa,
            waliWa: form.waliWa ?? r.waliWa,
            ayahIncome: form.ayahIncome ?? r.ayahIncome,
            ibuIncome: form.ibuIncome ?? r.ibuIncome,
            alamat: form.alamat ?? r.alamat,
          };
        })
      );

      setEditOpen(false); setEditTarget(null);
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">DATA LENGKAP SPMB</h1>

        <Filters
          levels={levels} levelsLoading={levelsLoading}
          filterLevel={filterLevel} setFilterLevel={setFilterLevel}
          filterIncome={filterIncome} setFilterIncome={setFilterIncome}
          filterParents={filterParents} setFilterParents={setFilterParents}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          search={search} setSearch={setSearch}
          pageIndex={pageIndex}
          viewLength={view.length}
          totalFiltered={base.length}
          totalAll={grandTotal}
          hasNext={hasNext} loading={loading} err={err}
          onPrev={handlePrev} onNext={handleNext}
          onExport={() => exportAllToXls(setExporting)}
          exporting={exporting}
          pageSize={pageSize} setPageSize={setPageSize}
        />

        <MobileCards
          view={view}
          loading={loading}
          filterStatus={filterStatus}
          onOpenDetail={openDetail}
          onDeleteAll={handleDeleteAll}
          deletingId={deletingId}
          onOpenEdit={onOpenEdit}
        />

        <TableView
          view={view}
          loading={loading}
          filterStatus={filterStatus}
          onOpenDetail={openDetail}
          onDeleteAll={handleDeleteAll}
          deletingId={deletingId}
          onOpenEdit={onOpenEdit}
        />
      </main>

      <DetailModal
        open={open} selected={selected} onClose={() => setOpen(false)}
        filterStatus={filterStatus}
        onDeleteAll={handleDeleteAll} deletingId={deletingId}
        onOpenEdit={onOpenEdit}
      />

      <EditModal
        open={editOpen} target={editTarget}
        onClose={() => setEditOpen(false)} onSave={onSaveEdit} saving={saving}
      />
    </div>
  );
}
