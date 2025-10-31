"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, getDocs, orderBy, query, limit, startAfter
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import Filters from "./components/Filters";
import MobileCards from "./components/MobileCards";
import TableView from "./components/Table";
import DetailModal from "./components/DetailModal";
import EditModal from "./components/EditModal"; // ⬅️ baru

import {
  PAGE_SIZE, READ_CAP,
  parentStatus, sumIncome,
  statusFromUsersApp,
} from "./lib/utils";

import {
  loadPpdbByNisnMap,
  exportAllToXls,
  deleteParticipant,
  upsertUserAndPpdb, // ⬅️ baru
} from "./lib/ops";

export default function DataMasterPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filters
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterIncome, setFilterIncome] = useState("ALL");
  const [filterParents, setFilterParents] = useState("ALL");
  const [levels, setLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("OFF");
  const [search, setSearch] = useState("");

  const [pageIndex, setPageIndex] = useState(0);
  const cursorStack = useRef([]);
  const [hasNext, setHasNext] = useState(false);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  // ====== Edit modal state (baru) ======
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadRegistrationLevels() {
    setLevelsLoading(true);
    try {
      const col = collection(db, "users_app");
      const snap = await getDocs(query(col, limit(500)));
      const uniq = new Set();
      snap.forEach((d) => {
        const v = (d.data()?.registrationLevel || "").trim();
        if (v) uniq.add(v);
      });
      setLevels(
        Array.from(uniq).sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" }))
      );
    } catch (e) {
      console.error("loadRegistrationLevels()", e);
      setLevels([]);
    } finally {
      setLevelsLoading(false);
    }
  }

  useEffect(() => {
    loadRegistrationLevels();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    void fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLevel, filterIncome, filterParents, filterStatus]);

  /* ==================== FETCH PAGE (users_app as truth) ==================== */
  async function fetchPage(targetIndex, reset = false) {
    try {
      setLoading(true);
      setErr("");

      if (reset) {
        setRows([]);
        setPageIndex(0);
        cursorStack.current = [];
      }

      // Paging sumber: users_app
      const baseClauses = [orderBy("createdAt", "desc")];
      if (!reset && targetIndex > 0 && cursorStack.current[targetIndex - 1]) {
        baseClauses.push(startAfter(cursorStack.current[targetIndex - 1]));
      }

      const colUA = collection(db, "users_app");
      const collectedUA = [];
      let lastDocRef = null;
      let reads = 0;
      let done = false;

      while (!done && reads < READ_CAP) {
        // oversample agar cukup setelah client filter
        const snap = await getDocs(query(colUA, ...baseClauses, limit(PAGE_SIZE * 2)));
        reads += 1;

        let batchUA = snap.docs.map((d) => ({ _uid: d.id, ...(d.data() || {}) }));
        lastDocRef = snap.docs[snap.docs.length - 1] || lastDocRef;

        // Filter dari users_app saja
        batchUA = batchUA.filter((u) => {
          // Jenjang
          if (filterLevel !== "ALL") {
            const lvl = String(u?.registrationLevel || "").toUpperCase();
            if (lvl !== String(filterLevel).toUpperCase()) return false;
          }
          // Status
          const st = statusFromUsersApp(u);
          if (filterStatus === "UNPAID" && st._unpaidEmpty !== true) return false;
          if (filterStatus === "PAID" && st._paid !== true) return false;
          if (filterStatus === "PASSED" && st._passed !== true) return false;
          return true;
        });

        collectedUA.push(...batchUA);

        if (collectedUA.length >= PAGE_SIZE || snap.docs.length < PAGE_SIZE) {
          done = true;
          setHasNext(snap.docs.length === PAGE_SIZE);
        } else {
          baseClauses.pop();
          baseClauses.push(startAfter(snap.docs[snap.docs.length - 1]));
        }
      }

      const pageUA = collectedUA.slice(0, PAGE_SIZE);
      setPageIndex(targetIndex);
      if (lastDocRef) cursorStack.current[targetIndex] = lastDocRef;

      // Join ke ppdb untuk enrich tampilan—prioritas users_app.
      const nisns = pageUA.map((u) => String(u.nisn || u._uid || "").trim());
      const ppdbMap = await loadPpdbByNisnMap(nisns);

      const rowsOut = pageUA.map((u) => {
        const nisn = String(u.nisn || u._uid || "").trim();
        const st = statusFromUsersApp(u);
        const p = ppdbMap.get(nisn) || {};

        return {
          _id: p._id || nisn,
          nisn,
          // PRIORITAS user_app untuk field utama; ppdb sebagai fallback
          nama: u.name || p.nama || "-",
          jenjang: st._regLevel || p.jenjang || "-",
          createdAt: u.createdAt || p.createdAt || null,
          updatedAt: u.updatedAt || p.updatedAt || null,

          // sertakan SEMUA info dari ppdb untuk tampilan lengkap
          ...p,

          // status & level dari users_app menimpa apapun dari ppdb
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

  const handleNext = () => fetchPage(pageIndex + 1, false);
  const handlePrev = () => {
    if (pageIndex === 0) return;
    void fetchPage(pageIndex - 1, true);
  };

  function matchIncomeBracket(total) {
    if (filterIncome === "ALL") return true;
    switch (filterIncome) {
      case "0-1":
        return total >= 0 && total < 1_000_000;
      case "1-2":
        return total >= 1_000_000 && total < 2_000_000;
      case "2-3":
        return total >= 2_000_000 && total < 3_000_000;
      case "3-5":
        return total >= 3_000_000 && total < 5_000_000;
      case "5-10":
        return total >= 5_000_000 && total < 10_000_000;
      case ">=10":
        return total >= 10_000_000;
      default:
        return true;
    }
  }

  function applyClientFilters(r) {
    // Jenjang (tetap)
    if (filterLevel !== "ALL") {
      const lvl = String(r._regLevel || r.registrationLevel || r.jenjang || "").toUpperCase();
      if (lvl !== String(filterLevel).toUpperCase()) return false;
    }
    // Status (sudah disaring saat fetch, tapi biarkan idempotent)
    if (filterStatus === "UNPAID" && r._unpaidEmpty !== true) return false;
    if (filterStatus === "PAID" && r._paid !== true) return false;
    if (filterStatus === "PASSED" && r._passed !== true) return false;

    // Filter income & orang tua memakai data (lebih banyak tersedia di ppdb)
    if (filterParents !== "ALL" && parentStatus(r) !== filterParents) return false;
    const totalIncome = sumIncome(r);
    if (!matchIncomeBracket(totalIncome)) return false;

    return true;
  }

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter(applyClientFilters);
    if (!q) return base;
    return base.filter((r) => {
      const nisn = String(r.nisn || r._id || "").toLowerCase();
      const nama = String(r.nama || r.name || "").toLowerCase();
      return nisn.includes(q) || nama.includes(q);
    });
  }, [rows, search, filterLevel, filterStatus, filterParents, filterIncome]);

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
        setOpen(false);
        setSelected(null);
      }
      alert("Data peserta berhasil dihapus (PPDB + users_app + berkas Storage).");
    } catch (e) {
      console.error("handleDeleteAll()", e);
      alert("Gagal menghapus data. Cek izin Firestore/Storage & coba lagi.");
    } finally {
      setDeletingId("");
    }
  }

  // ========== EDIT handlers (baru) ==========
  function onOpenEdit(row) {
    setEditTarget(row);
    setEditOpen(true);
  }

  async function onSaveEdit(form) {
    if (!editTarget) return;
    const nisn = String(editTarget?.nisn || editTarget?._id || "").trim();
    if (!nisn) { alert("NISN tidak valid."); return; }

    try {
      setSaving(true);
      await upsertUserAndPpdb({
        nisn,
        ppdbDocId: editTarget?._id, // jika ada _id dokumen ppdb gunakan ini; jika tidak, fallback ke nisn
        userPatch: {
          name: form.name,
          registrationLevel: form.registrationLevel,
          finalDecision: form.finalDecision,
          registrationPaymentStatus: form.registrationPaymentStatus,
          examAccessStatus: form.examAccessStatus,
          examAllowed: form.examAllowed,
        },
        ppdbPatch: {
          nama: form.nama,
          jenjang: form.jenjang,
          ayahNama: form.ayahNama,
          ibuNama: form.ibuNama,
          hpSiswa: form.hpSiswa,
          waliWa: form.waliWa,
          ayahIncome: form.ayahIncome,
          ibuIncome: form.ibuIncome,
          alamat: form.alamat,
        }
      });

      // Optimistik: sinkron data di memori
      setRows(prev => prev.map(r => {
        const same = String(r.nisn || r._id) === nisn;
        if (!same) return r;
        return {
          ...r,
          // users_app surface
          name: form.name,
          finalDecision: form.finalDecision,
          _regLevel: form.registrationLevel || r._regLevel,
          registrationLevel: form.registrationLevel || r.registrationLevel,
          _regPayStatus: form.registrationPaymentStatus || r._regPayStatus,
          examAccessStatus: form.examAccessStatus ?? r.examAccessStatus,
          examAllowed: typeof form.examAllowed === "boolean" ? form.examAllowed : r.examAllowed,
          // ppdb surface
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
      }));

      setEditOpen(false);
      setEditTarget(null);
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
          levels={levels}
          levelsLoading={levelsLoading}
          filterLevel={filterLevel} setFilterLevel={setFilterLevel}
          filterIncome={filterIncome} setFilterIncome={setFilterIncome}
          filterParents={filterParents} setFilterParents={setFilterParents}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          search={search} setSearch={setSearch}
          pageIndex={pageIndex} viewLength={view.length}
          hasNext={hasNext} loading={loading} err={err}
          onPrev={handlePrev} onNext={handleNext}
          onExport={() => exportAllToXls(setExporting)}
          exporting={exporting}
        />

        <MobileCards
          view={view}
          loading={loading}
          filterStatus={filterStatus}
          onOpenDetail={openDetail}
          onDeleteAll={handleDeleteAll}
          deletingId={deletingId}
          onOpenEdit={onOpenEdit} // ⬅️ baru
        />

        <TableView
          view={view}
          loading={loading}
          filterStatus={filterStatus}
          onOpenDetail={openDetail}
          onDeleteAll={handleDeleteAll}
          deletingId={deletingId}
          onOpenEdit={onOpenEdit} // ⬅️ baru
        />
      </main>

      <DetailModal
        open={open}
        selected={selected}
        onClose={() => setOpen(false)}
        filterStatus={filterStatus}
        onDeleteAll={handleDeleteAll}
        deletingId={deletingId}
        onOpenEdit={onOpenEdit} // ⬅️ opsional di modal detail
      />

      <EditModal
        open={editOpen}
        target={editTarget}
        onClose={() => setEditOpen(false)}
        onSave={onSaveEdit}
        saving={saving}
      />
    </div>
  );
}
