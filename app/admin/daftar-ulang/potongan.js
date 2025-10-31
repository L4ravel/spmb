"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Loader2,
  TicketPercent,
  CheckCircle2,
  Percent,
  ThumbsUp,
  XCircle,
  ListOrdered,
  User2,
  Briefcase,
} from "lucide-react";

/* ===== Utils ===== */
const fmtIDR = (n) =>
  typeof n === "number"
    ? n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    : "—";

const norm = (s) =>
  (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();

/**
 * Panel Konfirmasi & Potongan.
 * Props:
 *  - db: Firestore instance
 *  - selected: { nisn, name, status, snap }
 *  - onAfterApprove?: () => void
 *  - onRequestHide?: () => void
 */
export function KonfirmasiPotonganPanel({ db, selected, onAfterApprove, onRequestHide }) {
  /* ===== State ===== */
  const [statusLocal, setStatusLocal] = useState(selected?.status || "");
  useEffect(() => setStatusLocal(selected?.status || ""), [selected?.status]);

  const [regLevel, setRegLevel] = useState("");
  const [fees, setFees] = useState(null);
  const [loadingFees, setLoadingFees] = useState(false);

  const [choice, setChoice] = useState(""); // "BP3" | "SPP"
  const [amount, setAmount] = useState(0);

  const [saving, setSaving] = useState(false);
  const [currentDiscount, setCurrentDiscount] = useState(null);

  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState("");
  const [siblingsCount, setSiblingsCount] = useState(0);

  // ⬇️ Loading aksi approve/reject agar tombol tidak hilang tiba-tiba
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const canApply = !!selected?.nisn && !!fees && statusLocal === "APPROVED";

  /* 1) Load registrationLevel, potongan aktif, & data PTK */
  useEffect(() => {
    let alive = true;
    (async () => {
      setRegLevel("");
      setFees(null);
      setChoice("");
      setAmount(0);
      setCurrentDiscount(null);
      setParentName("");
      setParentRole("");
      setSiblingsCount(0);

      if (!selected?.nisn) return;
      try {
        // users_app
        const u = await getDoc(doc(db, "users_app", selected.nisn));
        const level = (u.exists() ? u.data()?.registrationLevel : "") || "";
        if (!alive) return;
        setRegLevel(level);

        // potongan aktif
        const d = await getDoc(doc(db, "users_app", selected.nisn, "re_registration", "ptk_discount"));
        if (!alive) return;
        setCurrentDiscount(d.exists() ? { id: d.id, ...d.data() } : null);

        // konfirmasi PTK
        let ptkData = null;
        if (selected?.snap?.exists?.()) {
          try { ptkData = selected.snap.data() || null; } catch {}
        }
        if (!ptkData) {
          try {
            const c = await getDoc(doc(db, "users_app", selected.nisn, "ptk_confirmation", "current"));
            if (c.exists()) ptkData = c.data();
          } catch {}
        }

        const pName =
          ptkData?.parentName ||
          ptkData?.parent_name ||
          ptkData?.namaOrtu ||
          ptkData?.nama_ortu ||
          "";
        const pRole =
          ptkData?.jabatan ||
          ptkData?.posisi ||
          ptkData?.position ||
          "";

        // jumlah saudara
        let sc = 0;
        if (Array.isArray(ptkData?.siblings)) {
          sc = ptkData.siblings.filter((s) => (s?.name || s?.jenjang || s?.class)).length;
        } else if (ptkData?.siblingName || ptkData?.siblingJenjang || ptkData?.siblingClass) {
          sc = 1;
        } else if (ptkData?.siblingsCount != null) {
          const n = Number(ptkData.siblingsCount);
          sc = Number.isFinite(n) && n > 0 ? n : 0;
        }

        if (!alive) return;
        setParentName((pName || "").toString());
        setParentRole((pRole || "").toString());
        setSiblingsCount(sc);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { alive = false; };
  }, [db, selected?.nisn, selected?.snap]);

  /* 2) Cari re_registration_fees by label */
  useEffect(() => {
    let alive = true;
    (async () => {
      setFees(null);
      setAmount(0);
      const label = regLevel?.toString().trim();
      if (!label) return;

      try {
        setLoadingFees(true);

        const q1 = query(collection(db, "re_registration_fees"), where("label", "==", label), limit(1));
        const s1 = await getDocs(q1);
        if (!alive) return;
        if (!s1.empty) {
          setFees({ id: s1.docs[0].id, ...s1.docs[0].data() });
          return;
        }

        const snapAll = await getDocs(query(collection(db, "re_registration_fees"), limit(100)));
        if (!alive) return;
        const target = norm(label);
        let found = null;

        snapAll.docs.forEach((d) => {
          const data = d.data() || {};
          if (norm(data.label) === target || norm(data.key) === target) {
            found = { id: d.id, ...data };
          }
        });
        if (found) { setFees(found); return; }

        snapAll.docs.forEach((d) => {
          const data = d.data() || {};
          if (!found && norm(data.label).includes(target)) {
            found = { id: d.id, ...data };
          }
        });
        if (found) setFees(found);
      } finally {
        alive && setLoadingFees(false);
      }
    })();
    return () => { alive = false; };
  }, [db, regLevel]);

  /* ===== Derived biaya & potongan aktif ===== */
  const detail = useMemo(() => {
    const spp = typeof fees?.spp === "number" ? fees.spp : 0;
    const pangkalObj = (fees?.uangPangkal && typeof fees.uangPangkal === "object") ? fees.uangPangkal : {};
    const pangkalEntries = Object.entries(pangkalObj)
      .filter(([k, v]) => typeof v === "number" && isFinite(v))
      .map(([k, v]) => ({ key: k, label: k.toUpperCase(), value: Number(v) }));
    const totalPangkal = pangkalEntries.reduce((a, b) => a + b.value, 0);
    const totalSebelumPotongan = totalPangkal + spp;

    const aktifType = (currentDiscount?.type || "").toUpperCase();
    const aktifAmount = Number(currentDiscount?.amount || 0);
    const maxPotBP3 = Number(pangkalObj?.bp3 || 0);
    const maxPotSPP = Number(spp || 0);

    let totalSesudahPot = totalSebelumPotongan;
    if (aktifType === "BP3") totalSesudahPot = Math.max(totalSebelumPotongan - Math.min(aktifAmount, maxPotBP3), 0);
    if (aktifType === "SPP") totalSesudahPot = Math.max(totalSebelumPotongan - Math.min(aktifAmount, maxPotSPP), 0);

    return {
      spp,
      pangkalEntries,
      totalPangkal,
      totalSebelumPotongan,
      aktifType,
      aktifAmount,
      maxPotBP3,
      maxPotSPP,
      totalSesudahPot,
    };
  }, [fees, currentDiscount]);

  /* 3) Nominal otomatis */
  useEffect(() => {
    if (!fees) { setAmount(0); return; }
    if (choice === "BP3") {
      const bp3 = (fees?.uangPangkal && typeof fees.uangPangkal.bp3 === "number") ? fees.uangPangkal.bp3 : 0;
      setAmount(bp3 || 0);
    } else if (choice === "SPP") {
      setAmount(typeof fees?.spp === "number" ? fees.spp : 0);
    } else {
      setAmount(0);
    }
  }, [choice, fees]);

  /* 4) Terapkan potongan (tanpa NIK, +siblingsCount) */
  const onApplyDiscount = useCallback(async () => {
    if (!selected?.nisn) return alert("Pilih siswa dulu.");
    if (!fees) return alert("Data biaya belum tersedia.");
    if (statusLocal !== "APPROVED") return alert("Status masih PENDING. Setujui PTK dulu.");
    if (choice !== "BP3" && choice !== "SPP") return alert("Pilih jenis potongan (BP3 atau SPP).");
    if (!(amount > 0)) return alert("Nominal potongan tidak valid.");

    try {
      setSaving(true);
      const payload = {
        type: choice,
        amount,
        sourceFeeRef: fees?.id || null,
        sourceKey: choice === "BP3" ? "uangPangkal.bp3" : "spp",
        registrationLevel: regLevel || "",
        siblingsCount: Number.isFinite(Number(siblingsCount)) ? Number(siblingsCount) : 0,
        decidedAt: serverTimestamp(),
        decidedBy: "ADMIN",
        note: "Potongan PTK oleh Admin (full discount komponen terpilih)",
      };
      await setDoc(
        doc(db, "users_app", selected.nisn, "re_registration", "ptk_discount"),
        payload,
        { merge: true }
      );
      setCurrentDiscount(payload);
      alert(`Potongan ${choice} diterapkan. (${fmtIDR(amount)})`);
    } catch (e) {
      alert(e?.message || "Gagal menyimpan potongan.");
    } finally {
      setSaving(false);
    }
  }, [db, selected, fees, choice, amount, regLevel, siblingsCount, statusLocal]);

  /* 5) Approve / Reject PTK — tampilkan "Memproses..." dulu */
  const onApprove = useCallback(async () => {
    if (!selected?.snap) return;
    try {
      setIsApproving(true); // ⬅️ tampilkan loading, tombol tetap ada
      await updateDoc(selected.snap.ref, { status: "APPROVED", updatedAt: serverTimestamp() });
      setStatusLocal("APPROVED"); // setelah sukses, baru status berubah → tombol hilang wajar
      onAfterApprove?.();

      window.dispatchEvent(
  new CustomEvent("ptk:status-changed", {
    detail: { nisn: selected.nisn, status: "APPROVED", updatedAt: Date.now() },
  })
);
    } catch (e) {
      alert(e?.message || "Gagal menyetujui PTK.");
    } finally {
      setIsApproving(false);
    }
  }, [selected?.snap, onAfterApprove]);

  const onReject = useCallback(async () => {
    if (!selected?.snap) return;
    try {
      setIsRejecting(true);
      await updateDoc(selected.snap.ref, { status: "REJECTED", updatedAt: serverTimestamp() });
      setStatusLocal("REJECTED");
      window.dispatchEvent(
  new CustomEvent("ptk:status-changed", {
    detail: { nisn: selected.nisn, status: "REJECTED", updatedAt: Date.now() },
  })
);

    } catch (e) {
      alert(e?.message || "Gagal menolak PTK.");
    } finally {
      setIsRejecting(false);
    }
  }, [selected?.snap]);

  /* ===== UI ===== */
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900">
          <TicketPercent className="h-4 w-4" />
          <span className="text-sm font-semibold">Konfirmasi & Potongan</span>
        </div>
        <div className="flex items-center gap-2">
          {selected?.nisn ? (
            <span className="text-[11px] text-slate-900">{selected.nisn}</span>
          ) : null}
          <button
            type="button"
            onClick={() => onRequestHide?.()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            title="Sembunyikan potongan"
          >
            {/* EyeOff icon inline */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.7 5.1A9.77 9.77 0 0121 12c-.6 1.1-1.4 2.1-2.3 3m-3.7 2.7A9.77 9.77 0 013 12a16.9 16.9 0 013.2-3.9"/><path d="M9.9 9.9a3 3 0 104.2 4.2"/></svg>
            Sembunyikan
          </button>
        </div>
      </div>

      <div className="p-4">
        {!selected ? (
          <div className="text-sm text-slate-900">Pilih baris untuk konfirmasi PTK dan menetapkan potongan.</div>
        ) : (
          <>
            {/* Identitas */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-semibold text-slate-900">{selected.name}</div>
              <div className="text-xs text-slate-900 mt-0.5">{regLevel || "—"}</div>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                  <User2 className="h-3.5 w-3.5" />
                  Orang Tua: {parentName || "—"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800">
                  <Briefcase className="h-3.5 w-3.5" />
                  Jabatan: {parentRole || "—"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                  Jumlah Saudara: {Number.isFinite(Number(siblingsCount)) ? siblingsCount : 0}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  statusLocal === "APPROVED"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : statusLocal === "PENDING"
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}>
                  {statusLocal || "-"}
                </span>
                {currentDiscount ? (
                  <span className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800">
                    Potongan aktif: {currentDiscount.type} {fmtIDR(currentDiscount.amount || 0)}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-700">Tidak ada potongan aktif</span>
                )}
              </div>
            </div>

            {/* Ringkasan Biaya */}
            <div className="mt-4 rounded-xl border border-slate-200">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2">
                <Percent className="h-4 w-4" />
                <span className="text-sm font-semibold text-slate-900">Ringkasan Biaya</span>
              </div>
              <div className="p-3">
                {loadingFees ? (
                  <div className="inline-flex items-center gap-2 text-sm text-slate-900">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat biaya…
                  </div>
                ) : !fees ? (
                  <div className="text-sm text-slate-900">Belum ada data biaya untuk label: <b>{regLevel || "—"}</b>.</div>
                ) : (
                  <>
                    {/* SPP */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-slate-900">SPP per bulan</span>
                      <span className="text-sm font-semibold text-slate-900">{fmtIDR(detail.spp)}</span>
                    </div>

                    {/* Uang Pangkal */}
                    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50/50 text-sm font-medium text-slate-900 flex items-center gap-2">
                        <ListOrdered className="h-4 w-4" />
                        Uang Pangkal (rincian)
                      </div>
                      <div className="divide-y divide-slate-100">
                        {detail.pangkalEntries.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-slate-900">—</div>
                        ) : (
                          detail.pangkalEntries.map((it) => (
                            <div key={it.key} className="px-3 py-2 flex items-center justify-between">
                              <span className="text-sm text-slate-900">{it.label}</span>
                              <span className="text-sm font-semibold text-slate-900">{fmtIDR(it.value)}</span>
                            </div>
                          ))
                        )}
                        <div className="px-3 py-2 flex items-center justify-between bg-slate-50">
                          <span className="text-sm font-semibold text-slate-900">Total Uang Pangkal</span>
                          <span className="text-sm font-bold text-slate-900">{fmtIDR(detail.totalPangkal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total sebelum/sesudah potongan */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="text-xs text-slate-700">Total Kewajiban (sebelum potongan)</div>
                        <div className="text-base font-bold text-slate-900">{fmtIDR(detail.totalSebelumPotongan)}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                        <div className="text-xs text-emerald-800">
                          Setelah Potongan Aktif {detail.aktifType ? `(${detail.aktifType})` : ""}
                        </div>
                        <div className="text-base font-bold text-emerald-900">{fmtIDR(detail.totalSesudahPot)}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Kelola Potongan */}
            <div className="mt-4 rounded-xl border border-slate-200">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/60 text-sm font-semibold text-slate-900">
                Kelola Potongan (pilih satu)
              </div>

              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!fees}
                  onClick={() => setChoice("BP3")}
                  className={`text-left rounded-xl border px-4 py-3 transition ${
                    choice === "BP3"
                      ? "border-violet-600 bg-violet-50 text-violet-900"
                      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Potong BP3</div>
                    {choice === "BP3" ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </div>
                  <div className="text-[12px] text-slate-900 mt-0.5">Komponen: <b>uangPangkal.bp3</b></div>
                  <div className="mt-1 text-sm">{fees ? fmtIDR(fees?.uangPangkal?.bp3) : "—"}</div>
                </button>

                <button
                  type="button"
                  disabled={!fees}
                  onClick={() => setChoice("SPP")}
                  className={`text-left rounded-xl border px-4 py-3 transition ${
                    choice === "SPP"
                      ? "border-violet-600 bg-violet-50 text-violet-900"
                      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Potong SPP</div>
                    {choice === "SPP" ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </div>
                  <div className="text-[12px] text-slate-900 mt-0.5">Komponen: <b>SPP</b></div>
                  <div className="mt-1 text-sm">{fees ? fmtIDR(fees?.spp) : "—"}</div>
                </button>
              </div>

              <div className="px-3 pb-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div className="text-sm text-slate-900">
                    <div>Jenis Potongan: <b>{choice || "—"}</b></div>
                    <div>Nominal: <b>{fmtIDR(amount)}</b></div>
                  </div>
                  <button
                    type="button"
                    onClick={onApplyDiscount}
                    disabled={!canApply || !choice || amount <= 0 || saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "Menyimpan…" : "Terapkan"}
                  </button>
                </div>
                {!canApply ? (
                  <div className="mt-2 text-[12px] text-slate-900">
                    Terapkan hanya tersedia jika <b>status = APPROVED</b> dan data biaya ditemukan.
                  </div>
                ) : null}
              </div>
            </div>

            {/* Approve/Reject — render juga saat loading agar tombol tidak hilang */}
            {(statusLocal === "PENDING" || isApproving || isRejecting) && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={isApproving || isRejecting}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  {isApproving ? "Memp​roses…" : "Setujui PTK"}
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={isApproving || isRejecting}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  {isRejecting ? "Memp​roses…" : "Tolak"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
