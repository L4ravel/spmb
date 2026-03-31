"use client";

import { useEffect, useMemo, useState } from "react";
import { Shirt, Ruler, CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const SIZE_LIST_GAMIS = ["S", "M", "L", "XL"];
const PUTRA_JENJANG = ["SMP Putra", "SMA Putra"];
const PUTRI_JENJANG = ["SMP Putri", "SMA Putri"];
const cx = (...a) => a.filter(Boolean).join(" ");

/* 🔁 Compat string untuk backend lama */
function buildCompatSizes({
  isPutra, isPutri, gamisSize,
  panjangBaju, panjangLengan, lingkarDada, lebarBahu,
  panjangCelana, lingkarPinggang, pCornes,
}) {
  if (isPutri) {
    const top = gamisSize ? `Gamis ${gamisSize}` : "";
    return { topSize: top, bottomSize: "" };
  }
  if (isPutra) {
    const top = `PB:${panjangBaju} PL:${panjangLengan} LD:${lingkarDada} LB:${lebarBahu}`;
    const bottom = `PC:${panjangCelana} LP:${lingkarPinggang} PCor:${pCornes}`;
    return { topSize: top.trim(), bottomSize: bottom.trim() };
  }
  return { topSize: "", bottomSize: "" };
}

export default function UkuranBaju({ registrationLevel, onSaved, onLoaded, variant = "card" }) {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(true); // ⬅ pop-up awal

  // PUTRA
  const [panjangBaju, setPanjangBaju] = useState("");
  const [panjangLengan, setPanjangLengan] = useState("");
  const [lingkarDada, setLingkarDada] = useState("");
  const [lebarBahu, setLebarBahu] = useState("");
  const [panjangCelana, setPanjangCelana] = useState("");
  const [lingkarPinggang, setLingkarPinggang] = useState("");
  const [pCornes, setPCornes] = useState("");

  // PUTRI
  const [gamisSize, setGamisSize] = useState("");

  const isPutra = useMemo(() => PUTRA_JENJANG.includes(registrationLevel || ""), [registrationLevel]);
  const isPutri = useMemo(() => PUTRI_JENJANG.includes(registrationLevel || ""), [registrationLevel]);
  const shouldShow = isPutra || isPutri;

  const allPutraFilled = () =>
    [panjangBaju, panjangLengan, lingkarDada, lebarBahu, panjangCelana, lingkarPinggang, pCornes]
      .every((v) => v !== "" && Number(v) > 0);

  useEffect(() => {
    (async () => {
      setReady(true);
      setErr("");
      try {
        const res = await fetch("/api/uniform-size", { method: "GET", credentials: "include" });
        if (res.status === 401) { setErr("Masuk terlebih dahulu"); return; }
        if (!res.ok) throw new Error(`Gagal memuat (${res.status})`);
        const { data } = await res.json();
        if (data) {
          setPanjangBaju(data.panjangBaju || "");
          setPanjangLengan(data.panjangLengan || "");
          setLingkarDada(data.lingkarDada || "");
          setLebarBahu(data.lebarBahu || "");
          setPanjangCelana(data.panjangCelana || "");
          setLingkarPinggang(data.lingkarPinggang || "");
          setPCornes(data.pCornes || "");
          setGamisSize(data.gamisSize || "");
          if ((data.topSize || data.bottomSize) && onLoaded) onLoaded(true);
        }
      } catch (e) {
        setErr(e.message || "Gagal memuat data");
      }
    })();
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    const filled = isPutra ? allPutraFilled() : !!(gamisSize || "").trim();
    onLoaded?.(filled);
  }, [
    shouldShow, isPutra,
    panjangBaju, panjangLengan, lingkarDada, lebarBahu,
    panjangCelana, lingkarPinggang, pCornes, gamisSize,
  ]);

  const onAnyChange = () => { if (err) setErr(""); if (ok) setOk(""); };

  async function handleSave(e) {
    e.preventDefault();
    setErr(""); setOk("");

    if (isPutra && !allPutraFilled()) {
      setErr("Lengkapi semua ukuran (cm) untuk Putra. Semua kolom wajib berisi angka > 0.");
      return;
    }
    if (isPutri && !gamisSize) {
      setErr("Pilih salah satu ukuran gamis (S/M/L/XL).");
      return;
    }

    try {
      setSaving(true);
      const compat = buildCompatSizes({
        isPutra, isPutri, gamisSize,
        panjangBaju, panjangLengan, lingkarDada, lebarBahu,
        panjangCelana, lingkarPinggang, pCornes
      });

      const payload = {
        registrationLevel,
        panjangBaju, panjangLengan, lingkarDada, lebarBahu,
        panjangCelana, lingkarPinggang, pCornes,
        gamisSize,
        ...compat,
      };

      const res = await fetch("/api/uniform-size", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Gagal menyimpan (${res.status})`);

      setOk("Ukuran seragam berhasil disimpan.");
      onSaved?.();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <div className="min-h-[30vh] grid place-items-center text-slate-500">Menyiapkan…</div>;
  if (!shouldShow) return null;

  const needLogin = err === "Masuk terlebih dahulu";

  // === Wrapper: mepet layar di HP, tetap rapi di desktop ===
  const bodyClass = variant === "modal"
    ? "relative z-0 flex-1 overflow-y-auto bg-white"
    : "relative z-0 bg-white";
  const paddingClass = variant === "modal"
    ? "px-3 py-3 sm:px-6 sm:py-6"
    : "px-0 sm:px-6 py-0 sm:py-6";

  return (
    <div className={variant === "modal" ? "w-full min-h-[100dvh] flex flex-col bg-white" : "w-full bg-white"}>
      <div className={cx(bodyClass, paddingClass)}>
        {/* tarik mepet ke tepi layar khusus mobile */}
        <div className="-mx-4 sm:mx-0">
          {needLogin ? (
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 mx-4 sm:mx-0">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-1 text-slate-700" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Masuk terlebih dahulu</h3>
                  <p className="text-sm text-slate-600 mt-1">Halaman ini hanya untuk pengguna yang login dengan username (NISN).</p>
                  <a href="/login" className="inline-flex mt-4 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">Ke halaman Login</a>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} noValidate className="space-y-4 mx-4 sm:mx-0">
              {err && (
                <div className="flex items-start gap-2 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span className="font-medium">{err}</span>
                </div>
              )}
              {ok && (
                <div className="flex items-start gap-2 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  <span className="font-medium">{ok}</span>
                </div>
              )}

              {/* PUTRA */}
              {isPutra && (
                <section className="p-0 sm:p-4 sm:rounded-xl sm:border sm:border-slate-200">
                  <div className="flex items-center gap-2 text-[13px] text-slate-600 mb-2 sm:mb-3 px-0 sm:px-0">
                     <span className="font-medium text-slate-700"> <b>Ukuran Seragam | semua kolom wajib (cm) </b></span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    <NumberInput label="1. Panjang Baju" value={panjangBaju} onChange={(v)=>{setPanjangBaju(v); onAnyChange();}} required />
                    <NumberInput label="2. P. Lengan" value={panjangLengan} onChange={(v)=>{setPanjangLengan(v); onAnyChange();}} required />
                    <NumberInput label="3. Lingkar Dada" value={lingkarDada} onChange={(v)=>{setLingkarDada(v); onAnyChange();}} required />
                    <NumberInput label="4. Lebar Bahu" value={lebarBahu} onChange={(v)=>{setLebarBahu(v); onAnyChange();}} required />
                    <NumberInput label="5. Panjang Celana (di atas mata kaki)" value={panjangCelana} onChange={(v)=>{setPanjangCelana(v); onAnyChange();}} required />
                    <NumberInput label="6. Lingkar Pinggang" value={lingkarPinggang} onChange={(v)=>{setLingkarPinggang(v); onAnyChange();}} required />
                    <NumberInput label="7. P. Cornes" value={pCornes} onChange={(v)=>{setPCornes(v); onAnyChange();}} required />
                  </div>

                  <p className="mt-2 text-[12px] text-slate-500 flex items-center gap-1 px-0 sm:px-0">                   
                    <b>Gunakan angka desimal bila perlu.</b>
                  </p>
                  <p className="mt-0 text-[12px] text-slate-500 flex items-center gap-1 px-0 sm:px-0">                   
                    <b>(contoh: 70.5).</b>
                  </p>
                </section>
              )}

              {/* PUTRI */}
              {isPutri && (
                <section className="p-0 sm:p-4 sm:rounded-xl sm:border sm:border-slate-200">
                  <div className="flex items-center gap-2 text-[13px] text-slate-600 px-0 sm:px-0">
                    <Shirt className="h-4 w-4" />
                    <span className="font-medium text-slate-700">Ukuran Gamis (S–XL) — wajib pilih</span>
                  </div>

                  <div role="radiogroup" aria-label="Ukuran Gamis" className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
                    {SIZE_LIST_GAMIS.map((s) => {
                      const active = gamisSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => { setGamisSize(s); onAnyChange(); }}
                          className={cx(
                            "rounded-lg border px-3 py-2 text-sm transition-colors",
                            active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:bg-slate-50 text-slate-800"
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Save */}
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving || noticeOpen}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-white shadow-sm px-4 py-2",
                    saving || noticeOpen ? "bg-slate-400" : "bg-slate-900 hover:bg-black"
                  )}
                  title={noticeOpen ? "Baca keterangan terlebih dahulu" : undefined}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ===== POP-UP KETERANGAN: CENTER ATAS-BAWAH ===== */}
      {noticeOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md mx-auto rounded-2xl bg-white shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setNoticeOpen(false)}
              className="absolute right-3 top-3 inline-flex items-center justify-center rounded-md border border-slate-200 px-2.5 py-1.5 text-sm hover:bg-slate-50"
              aria-label="Tutup"
              title="Tutup"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="min-h-[40vh] px-6 py-8 grid place-items-center text-center">
              <div>
                <div className="inline-flex items-center justify-center rounded-full border border-slate-200 w-12 h-12 mb-4">
                  <Info className="h-5 w-5 text-slate-800" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Keterangan Pengisian</h3>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">
                    Ukuran final diberikan saat masuk sekolah. Perkiraan peningkatan ukuran sehingga tidak kekecilan.
                  </span>
                </p>
                <p className="mt-2 text-xs text-slate-500">Gunakan satuan cm, boleh desimal (mis. 70.5).</p>

                <button
                  type="button"
                  onClick={() => setNoticeOpen(false)}
                  className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Mengerti, lanjut
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ===== /POP-UP ===== */}
    </div>
  );
}

/* Input angka cm + validasi visual */
function NumberInput({ label, value, onChange, required }) {
  const invalid = value !== "" && Number(value) <= 0;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <input
          className={
            "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 " +
            (invalid ? "border-rose-300" : "border-slate-300")
          }
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          required={required}
          aria-invalid={invalid}
        />
        <span className="text-sm text-slate-600">cm</span>
      </div>
      {invalid && (
        <div className="mt-1 inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-md bg-rose-50 text-rose-900 border border-rose-200">
          <AlertCircle className="h-3.5 w-3.5" />
          Masukkan angka &gt; 0
        </div>
      )}
    </label>
  );
}
