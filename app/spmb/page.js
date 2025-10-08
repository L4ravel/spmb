"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import JenjangPicker from "./JenjangPicker";

// === UI imports (dipisah) ===
import {
  Field, Input, Select, Section, IncomeSelect, PekerjaanSelect, PekerjaanSelectIbu,
} from "./PPDBFormUI";

/* ===== Utils sederhana ===== */
const digits = (s) => String(s ?? "").replace(/\D+/g, "");
const required = (v) => String(v ?? "").trim().length > 0;
const isAlive = (s) => s === "hidup";

// HANYA TK, SD, PPS Ula (bukan karena mengandung kata putra/putri)
function normalizeJenjang(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const isEarlyEducation = (jenjang) => {
  const j = normalizeJenjang(jenjang);
  if (j === "tk" || j === "taman kanak kanak") return true;
  if (j === "sd" || j.startsWith("sd ")) return true;
  if (j.includes("pps ula")) return true;
  return false;
};
const last8 = (nik) => digits(nik).slice(-8);

/* ===== Helper kuota ===== */
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

/** Klaim 1 slot kuota untuk jenjang (transaction-safe).
 *  Throw jika: dokumen kuota belum diset, status closed, atau penuh.
 */
async function claimQuota(jenjangLabel) {
  const key = toSafeUpperSnake(jenjangLabel);
  const ref = doc(db, "quotas", key);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("Kuota untuk jenjang ini belum diset admin.");
    }
    const q = snap.data();
    const limit = Number(q.limit || 0);
    const used = Number(q.used || 0);
    const open = !!q.open;

    if (!open) throw new Error("Pendaftaran untuk jenjang ini sedang DITUTUP.");
    if (!(limit > 0)) throw new Error("Limit kuota belum diatur (>0).");
    if (used >= limit) throw new Error("Kuota untuk jenjang ini sudah PENUH.");

    tx.update(ref, { used: used + 1, updatedAt: serverTimestamp() });
  });

  return { key };
}

/** Kembalikan 1 slot (dipakai kalau langkah selanjutnya gagal) */
async function releaseQuota(jenjangLabel) {
  const key = toSafeUpperSnake(jenjangLabel);
  const ref = doc(db, "quotas", key);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const q = snap.data();
    const used = Math.max(0, Number(q.used || 0) - 1);
    tx.update(ref, { used, updatedAt: serverTimestamp() });
  });
}

/* ===== Password hashing (SHA-256 hex) ===== */
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ====== GENERATOR ID PENDAFTARAN (2026) ====== */
async function generateRegistrationId2026() {
  const counterRef = doc(db, "counters", "pendaftaran");
  const nextNum = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() && typeof snap.data().count === "number" ? snap.data().count : 0;
    const next = current + 1;
    tx.set(counterRef, { count: next, updatedAt: serverTimestamp(), year: 2026 }, { merge: true });
    return next;
  });
  const padded = String(nextNum).padStart(6, "0");
  return `PPDB-2026-${padded}`;
}

/* ====== 3x4 Photo Cropper (inline) ====== */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function PhotoCropperModal({ src, onClose, onApply }) {
  const OUT_W = 450, OUT_H = 600;
  const containerRef = useRef(null);
  const [frameW, setFrameW] = useState(450);
  const [frameH, setFrameH] = useState(600);
  const [iw, setIw] = useState(0);
  const [ih, setIh] = useState(0);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const imgRef = useRef(null);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const computeFrameSize = () => {
    const vw = Math.max(320, Math.min(window.innerWidth, 900));
    const maxW = vw - 48;
    const w = clamp(Math.floor(maxW), 270, 450);
    const h = Math.round((w * 4) / 3);
    setFrameW(w);
    setFrameH(h);
  };

  useEffect(() => {
    computeFrameSize();
    const onR = () => computeFrameSize();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.decode().catch(() => {}).finally(() => {
      if (cancelled) return;
      setIw(img.naturalWidth || img.width);
      setIh(img.naturalHeight || img.height);
      imgRef.current = img;
    });
    return () => { cancelled = true; };
  }, [src]);

  const centerAndCover = useCallback(() => {
    if (!iw || !ih || !frameW || !frameH) return;
    const SAFE = 1.02;
    const bs = Math.max(frameW / iw, frameH / ih) * SAFE;
    setBaseScale(bs);
    setZoom(1);
    setDx((frameW - bs * iw) / 2);
    setDy((frameH - bs * ih) / 2);
  }, [iw, ih, frameW, frameH]);

  useEffect(() => { centerAndCover(); }, [centerAndCover]);

  const effectiveScale = baseScale * zoom;
  useEffect(() => {
    if (!iw || !ih) return;
    const W = iw * effectiveScale, H = ih * effectiveScale;
    const minDx = Math.min(0, frameW - W), maxDx = Math.max(0, frameW - W);
    const minDy = Math.min(0, frameH - H), maxDy = Math.max(0, frameH - H);
    setDx((v) => clamp(v, minDx, maxDx));
    setDy((v) => clamp(v, minDy, maxDy));
  }, [iw, ih, effectiveScale, frameW, frameH]);

  const onPointerDown = (e) => { dragging.current = true; last.current = { x: e.clientX, y: e.clientY }; };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dx0 = e.clientX - last.current.x;
    const dy0 = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    const W = iw * effectiveScale, H = ih * effectiveScale;
    const minDx = Math.min(0, frameW - W), maxDx = Math.max(0, frameW - W);
    const minDy = Math.min(0, frameH - H), maxDy = Math.max(0, frameH - H);
    setDx((v) => clamp(v + dx0, minDx, maxDx));
    setDy((v) => clamp(v + dy0, minDy, maxDy));
  };
  const onPointerUp = () => { dragging.current = false; };

  const doApply = async () => {
    const s = effectiveScale;
    const x0 = (0 - dx) / s, y0 = (0 - dy) / s;
    const x1 = (frameW - dx) / s, y1 = (frameH - dy) / s;

    const sx = clamp(x0, 0, iw), sy = clamp(y0, 0, ih);
    const sw = clamp(x1, 0, iw) - sx, sh = clamp(y1, 0, ih) - sy;

    const canvas = document.createElement("canvas");
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

    canvas.toBlob((blob) => {
      const file = new File([blob], "foto-3x4.jpg", { type: "image/jpeg" });
      onApply({ file, previewUrl: URL.createObjectURL(blob) });
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-4"
         onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div ref={containerRef} className="w-full max-w-[900px] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-slate-900">Crop Pas Foto 3×4 (Backround Merah)</div>
            <div className="text-[12px] text-slate-500">Seret gambar untuk mengatur posisi • Gunakan slider untuk zoom</div>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100">Tutup</button>
        </div>

        <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-[minmax(450px,600px),1fr] gap-5">
          <div className="mx-auto">
            <div className="relative border bg-white shadow-inner rounded-sm"
                 style={{ width: `${frameW}px`, height: `${frameH}px`, touchAction: "none", userSelect: "none", cursor: "grab" }}
                 onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
              <div className="absolute inset-0 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_75%,#f8fafc_75%,#f8fafc),linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_75%,#f8fafc_75%,#f8fafc)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]" />
              <img src={src} alt="to-crop" draggable={false}
                   style={{ position: "absolute", left: 0, top: 0, transform: `translate(${dx}px, ${dy}px) scale(${effectiveScale})`, transformOrigin: "top left" }} />
              <div className="absolute inset-0 ring-2 ring-indigo-500 pointer-events-none rounded-sm" />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Zoom</label>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={centerAndCover} className="rounded-lg border px-3 py-2 text-slate-700 hover:bg-slate-50">Reset</button>
              <button type="button" onClick={doApply} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white shadow hover:bg-indigo-700">Crop & Terapkan</button>
            </div>
            <div className="mt-6 text-xs text-slate-500">Frame otomatis menyesuaikan layar (3:4). Hasil disimpan 450×600 px (3×4).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PPDBPage() {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    jenjang: "",
    nik: "", noKK: "", nama: "", jk: "", tempatLahir: "", tglLahir: "",
    agama: "Islam", kewarganegaraan: "Indonesia",
    alamat: "", rt: "", rw: "", desa: "", kec: "", kab: "", prov: "", kodePos: "",
    nisn: "", asalSekolah: "", noIjazah: "", rataRapor: "",
    ayahNama: "", ayahNIK: "", ayahDidik: "", ayahKerja: "", ayahHP: "", ayahStatus: "", ayahIncome: "",
    ibuNama: "", ibuNIK: "", ibuDidik: "", ibuKerja: "", ibuHP: "", ibuStatus: "", ibuIncome: "",
    waliNama: "", waliHub: "", waliHP: "", waliAlamat: "",
    hpSiswa: "", email: "", transport: "", jarakKm: "", kebutuhanKhusus: "", riwayatPenyakit: "",
  });

  const [files, setFiles] = useState({ kk: null, akta: null, ijazah: null, foto: null, kip: null });
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  const handle = (e) => { const { name, value } = e.target; setForm((s) => ({ ...s, [name]: value })); };

  const handleFile = (e) => {
    const { name, files: ff } = e.target;
    const f = ff?.[0] ?? null;
    if (name === "foto" && f) {
      const reader = new FileReader();
      reader.onload = () => { setCropSrc(reader.result); setShowCropper(true); };
      reader.readAsDataURL(f);
      return;
    }
    setFiles((s) => ({ ...s, [name]: f }));
  };

  const onCropApply = ({ file, previewUrl }) => {
    setFiles((s) => ({ ...s, foto: file }));
    setFotoPreview(previewUrl);
    setShowCropper(false);
    setCropSrc(null);
  };

  const handleFormKeyDown = (e) => {
    if (e.key === "Enter") {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "select" || tag === "input") e.preventDefault();
    }
  };

  /* ===== VALIDASI ===== */
  const validateMinimal = () => {
    if (!required(form.jenjang)) return false;
    if (!required(form.nik) || !required(form.noKK) || !required(form.nama) ||
        !required(form.jk) || !required(form.tempatLahir) || !required(form.tglLahir) ||
        !required(form.alamat)) return false;

    // Jenjang non-early: NISN & asal sekolah wajib
    const showPendidikan = !isEarlyEducation(form.jenjang);
    if (showPendidikan) {
      const nisnDigits = digits(form.nisn);
      if (!(nisnDigits.length >= 8 && nisnDigits.length <= 12)) return false;
      if (!required(form.asalSekolah)) return false;
    }

    if (!required(form.ayahNama) || !required(form.ibuNama)) return false;
    if (isAlive(form.ayahStatus)) {
      if (!required(form.ayahKerja) || !required(form.ayahIncome) || !required(form.ayahHP)) return false;
    }
    if (isAlive(form.ibuStatus)) {
      if (!required(form.ibuKerja) || !required(form.ibuIncome) || !required(form.ibuHP)) return false;
    }
    if (!files.kk || !files.akta || !files.foto) return false; // Ijazah opsional
    return true;
  };

  /* ===== Membuat akun user ===== */
  const createUserAccount = async (registrationId, fullName, jenjang, nik, nisn) => {
    const isEarly = isEarlyEducation(jenjang);
    const username = isEarly ? last8(nik) : digits(nisn);
    const passwordHash = await sha256Hex(username);

    const ref = doc(db, "users_app", username);

    // jalankan transaksi: fail kalau sudah ada
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        throw new Error("Akun sudah ada untuk ID ini. Hubungi admin bila perlu reset.");
      }
      tx.set(ref, {
        username,
        role: "siswa",
        registrationId,
        fullName: fullName || "",
        fullNameLower: (fullName || "").toLowerCase(),
        registrationLevel: jenjang || "",
        nik: digits(nik) || "",
        nisn: digits(nisn) || "",
        registrationPaymentProof: null,
        registrationPaymentStatus: null,
        registrationPaymentAt: null,
        registrationPaymentVerifiedBy: null,
        reRegistrationPaymentProof: null,
        reRegistrationPaymentStatus: null,
        reRegistrationPaymentAt: null,
        reRegistrationVerifiedBy: null,
        examAllowed: false,
        examAccessStatus: "pending",
        requestExamAt: serverTimestamp(),
        verifiedPayment: false,
        examPaketId: null,
        examMapel: null,
        examScheduleId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        passwordHash,
      });
    });

    return username;
  };


  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validateMinimal()) {
      alert("Lengkapi data wajib (termasuk KK, Akta, dan Foto 3×4).");
      return;
    }

    // Validasi NIK harus 16 digit
    if (form.nik.length !== 16) {
      alert("NIK harus 16 digit!");
      return;
    }

    // Validasi NISN hanya untuk jenjang yang menampilkan form pendidikan
    const showPendidikan = !isEarlyEducation(form.jenjang);
    if (showPendidikan && form.nisn.length > 0 && (form.nisn.length < 8 || form.nisn.length > 12)) {
      alert("NISN tidak valid (harus 8-12 digit).");
      return;
    }

    setSubmitting(true);
    let quotaClaimed = false;

    try {
      // 0) CEK & KLAIM KUOTA (akan throw jika ditutup/penuh)
      await claimQuota(form.jenjang);
      quotaClaimed = true;

      // 1) Generate ID pendaftaran (transaction-safe)
      const regId = await generateRegistrationId2026();

      // 2) Kumpulkan FormData (+ sertakan ID)
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      Object.entries(files).forEach(([k, f]) => { if (f) fd.append(k, f); });
      fd.append("id", regId);
      fd.append("registrationId", regId);
      fd.append("jenjang", form.jenjang);

      // 3) Submit ke API
      const res = await fetch("/api/ppdb", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal menyimpan data PPDB.");

      // 4) Buat akun user
      const username = await createUserAccount(regId, form.nama, form.jenjang, form.nik, form.nisn);

      // 5) Redirect sukses
      const namaEnc = encodeURIComponent(form.nama);
      router.push(`/spmb/success?id=${regId}&username=${username}&nama=${namaEnc}`);
    } catch (err) {
      console.error(err);
      // Jika sudah klaim kuota tapi proses gagal → release kembali
      if (quotaClaimed) {
        try { await releaseQuota(form.jenjang); } catch {}
      }
      alert("❌ " + (err?.message || "Terjadi kesalahan saat pendaftaran."));
    } finally {
      setSubmitting(false);
    }
  };

  // Check apakah jenjang saat ini adalah pendidikan dini
  const showPendidikanSebelumnya = !isEarlyEducation(form.jenjang);

  /* ===== RENDER ===== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px_4 px-4 py-8">
        {/* Header */}
        <div className="relative mb-6">
  <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />
  <div className="relative grid grid-cols-1 lg:grid-cols-2 rounded-[26px] bg-white ring-1 ring-slate-200 overflow-hidden">
    
    {/* Kolom Ungu - Order 1 di mobile, Order 2 di desktop */}
    <div className="order-1 lg:order-2 relative isolate overflow-hidden rounded-t-[26px] lg:rounded-t-none lg:rounded-tr-[26px] lg:rounded-br-[26px]">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 to-violet-600" />
      <div className="hidden md:block absolute -left-25 top-0 h-full w-32 rounded-r-[60px] bg-white -z-10 pointer-events-none" />
      <div className="relative z-10 h-full p-8 md:p-10 text-white flex items-center">
        <div className="space-y-2.5 text-sm w-full">
          <div className="backdrop-blur-md bg-white/10 border border-white/20 p-2.5 rounded-lg shadow-lg">
            <div className="font-semibold text-white mb-0.5 text-xs">Persyaratan Dokumen</div>
            <div className="text-indigo-100 text-xs leading-snug">
              KK, Akta, dan Pas Foto 3×4 (Backround Merah).
            </div>
          </div>
          
          <div className="backdrop-blur-md bg-white/10 border border-white/20 p-2.5 rounded-lg shadow-lg">
            <div className="font-semibold text-white mb-0.5 text-xs">Kredensial Akun</div>
            <div className="text-indigo-100 text-xs leading-snug">
              • TK/SD/PPS Ula: 8 digit terakhir NIK<br />
              • SMP/SMA/Universitas: NISN
            </div>
          </div>
          
          <div className="backdrop-blur-md bg-white/10 border border-white/20 p-2.5 rounded-lg shadow-lg">
            <div className="font-semibold text-white mb-0.5 text-xs">Format ID</div>
            <div className="text-indigo-100 font-mono text-xs">PPDB-2026-XXXXXX</div>
          </div>
        </div>
      </div>
    </div>

    {/* Kolom Putih - Order 2 di mobile, Order 1 di desktop */}
    <div className="order-2 lg:order-1 p-8 md:p-10">
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Pendaftaran Siswa (PPDB)</h2>
      <p className="mt-2 text-slate-600">Isi form berikut dengan data yang valid sesuai dokumen resmi.</p>
      <div className="mt-4">
        <Link href="/" className="text-indigo-600 hover:underline">← Kembali ke Beranda</Link>
      </div>
    </div>
    
  </div>
</div>

        {/* FORM */}
        <form onSubmit={onSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
          {/* [JENJANG] */}
          <Section title="Klasifikasi Pendaftaran" desc="Pilih jenjang yang dituju (TK/SD/SMP/SMA/UNIVERSITAS).">
            <div className="md:col-span-2">
              <JenjangPicker value={form.jenjang} onChange={(val) => setForm((s) => ({ ...s, jenjang: val }))} />
            </div>
          </Section>

          {/* 1) Identitas Utama */}
          <Section title="Identitas Utama" desc="Sesuai Kartu Keluarga / Akta Kelahiran.">
            <Field label="NIK" required><Input name="nik" value={form.nik} onChange={handle} maxLength={16} /></Field>
            <Field label="Nomor KK" required><Input name="noKK" value={form.noKK} onChange={handle} maxLength={16} /></Field>
            <Field label="Nama Lengkap" required><Input name="nama" value={form.nama} onChange={handle} /></Field>
            <Field label="Jenis Kelamin" required>
              <Select name="jk" value={form.jk} onChange={handle}>
                <option value="">— Pilih —</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </Select>
            </Field>
            <Field label="Tempat Lahir" required><Input name="tempatLahir" value={form.tempatLahir} onChange={handle} /></Field>
            <Field label="Tanggal Lahir" required><Input type="date" name="tglLahir" value={form.tglLahir} onChange={handle} /></Field>
            <Field label="Agama"><Input name="agama" value={form.agama} onChange={handle} placeholder="Islam / Kristen / dll" /></Field>
            <Field label="Kewarganegaraan"><Input name="kewarganegaraan" value={form.kewarganegaraan} onChange={handle} /></Field>
            <Field label="Alamat Lengkap" required className="md:col-span-2">
              <Input name="alamat" value={form.alamat} onChange={handle} placeholder="Nama jalan, nomor rumah…" />
            </Field>
            <Field label="RT"><Input name="rt" value={form.rt} onChange={handle} /></Field>
            <Field label="RW"><Input name="rw" value={form.rw} onChange={handle} /></Field>
            <Field label="Desa/Kel."><Input name="desa" value={form.desa} onChange={handle} /></Field>
            <Field label="Kecamatan"><Input name="kec" value={form.kec} onChange={handle} /></Field>
            <Field label="Kabupaten/Kota"><Input name="kab" value={form.kab} onChange={handle} /></Field>
            <Field label="Provinsi"><Input name="prov" value={form.prov} onChange={handle} /></Field>
            <Field label="Kode Pos"><Input name="kodePos" value={form.kodePos} onChange={handle} /></Field>
          </Section>

          {/* 2) Pendidikan Sebelumnya - hanya muncul jika bukan TK/SD/PPS */}
          {showPendidikanSebelumnya && (
            <Section title="Pendidikan Sebelumnya" desc="Isi sesuai dokumen resmi sekolah asal.">              
<Field
  /* HAPUS prop `required` di Field agar tidak muncul bintang di bawah */
  label={
    <div className="flex items-baseline gap-1">
      <span className="font-semibold">NISN</span>
      <span aria-hidden className="text-rose-500">*</span>
      <span
        id="nisn-help-desktop"
        className="hidden md:inline italic text-slate-500 text-sm ml-2"
      >
        8 digit akhir NIK (jika tidak memiliki NISN)
      </span>
    </div>
  }
>
  <Input
    name="nisn"
    value={form.nisn}
    onChange={handle}
    maxLength={10}
    inputMode="numeric"
    required                // <-- required pindah ke input
    aria-describedby="nisn-help-mobile nisn-help-desktop"
  />
  {/* Keterangan di bawah khusus mobile */}
  <p id="nisn-help-mobile" className="mt-1 md:hidden italic text-slate-500 text-xs">
    8 digit akhir NIK (jika tidak memiliki NISN)
  </p>
</Field>
              <Field label="Asal Sekolah" required><Input name="asalSekolah" value={form.asalSekolah} onChange={handle} /></Field>
              <Field label="Nomor Ijazah / SKL"><Input name="noIjazah" value={form.noIjazah} onChange={handle} /></Field>
              <Field label="Rata-rata Rapor (opsional)"><Input name="rataRapor" value={form.rataRapor} onChange={handle} placeholder="contoh: 86.5" /></Field>
            </Section>
          )}

          {/* 3) Data Ayah */}
          <Section
            title="Data Ayah"
            desc="Nama wajib. Jika status 'Hidup' → Pekerjaan, Penghasilan, HP wajib. (NIK tidak wajib)"
          >
            <Field label="Nama Ayah" required><Input name="ayahNama" value={form.ayahNama} onChange={handle} /></Field>
            <Field label="Status Ayah" required>
              <Select name="ayahStatus" value={form.ayahStatus} onChange={handle}>
                <option value="">— Pilih Status —</option>
                <option value="hidup">Hidup</option>
                <option value="meninggal">Meninggal</option>
              </Select>
            </Field>
            <Field label="NIK Ayah"><Input name="ayahNIK" value={form.ayahNIK} onChange={handle} /></Field>
            <Field label="Pendidikan Ayah">
              <Select name="ayahDidik" value={form.ayahDidik} onChange={handle} disabled={!isAlive(form.ayahStatus)}>
                <option value="">— Pilih Pendidikan —</option>
                <option value="sd">SD</option>
                <option value="smp">SMP / Sederajat</option>
                <option value="sma">SMA / Sederajat</option>
                <option value="d3">D3</option>
                <option value="s1">S1</option>
                <option value="s2">S2</option>
                <option value="s3">S3</option>
                <option value="lainnya">Lainnya</option>
              </Select>
            </Field>
            <Field label="Pekerjaan Ayah" required={isAlive(form.ayahStatus)}>
              <PekerjaanSelect name="ayahKerja" value={form.ayahKerja} onChange={handle} disabled={!isAlive(form.ayahStatus)} />
            </Field>
            <Field label="Penghasilan Ayah" required={isAlive(form.ayahStatus)}>
              <IncomeSelect name="ayahIncome" value={form.ayahIncome} onChange={handle} disabled={!isAlive(form.ayahStatus)} />
            </Field>
            <Field label="HP Ayah" required={isAlive(form.ayahStatus)}>
              <Input name="ayahHP" value={form.ayahHP} onChange={handle} disabled={!isAlive(form.ayahStatus)} />
            </Field>
          </Section>

          {/* 4) Data Ibu */}
          <Section
            title="Data Ibu"
            desc="Nama wajib. Jika status 'Hidup' → Pekerjaan, Penghasilan, HP wajib. (NIK tidak wajib)"
          >
            <Field label="Nama Ibu" required><Input name="ibuNama" value={form.ibuNama} onChange={handle} /></Field>
            <Field label="Status Ibu" required>
              <Select name="ibuStatus" value={form.ibuStatus} onChange={handle}>
                <option value="">— Pilih Status —</option>
                <option value="hidup">Hidup</option>
                <option value="meninggal">Meninggal</option>
              </Select>
            </Field>
            <Field label="NIK Ibu"><Input name="ibuNIK" value={form.ibuNIK} onChange={handle} /></Field>
            <Field label="Pendidikan Ibu">
              <Select name="ibuDidik" value={form.ibuDidik} onChange={handle} disabled={!isAlive(form.ibuStatus)}>
                <option value="">— Pilih Pendidikan —</option>
                <option value="sd">SD</option>
                <option value="smp">SMP / Sederajat</option>
                <option value="sma">SMA / Sederajat</option>
                <option value="d3">D3</option>
                <option value="s1">S1</option>
                <option value="s2">S2</option>
                <option value="s3">S3</option>
                <option value="lainnya">Lainnya</option>
              </Select>
            </Field>
            <Field label="Pekerjaan Ibu" required={isAlive(form.ibuStatus)}>
              <PekerjaanSelectIbu name="ibuKerja" value={form.ibuKerja} onChange={handle} disabled={!isAlive(form.ibuStatus)} />
            </Field>
            <Field label="Penghasilan Ibu" required={isAlive(form.ibuStatus)}>
              <IncomeSelect name="ibuIncome" value={form.ibuIncome} onChange={handle} disabled={!isAlive(form.ibuStatus)} />
            </Field>
            <Field label="HP Ibu" required={isAlive(form.ibuStatus)}>
              <Input name="ibuHP" value={form.ibuHP} onChange={handle} disabled={!isAlive(form.ibuStatus)} />
            </Field>
          </Section>

          {/* 5) Kontak & Kondisi Khusus */}
          <Section title="Kontak & Kondisi Khusus">
            <Field label="HP/WA Siswa"><Input name="hpSiswa" value={form.hpSiswa} onChange={handle} /></Field>
            <Field label="Email Siswa"><Input type="email" name="email" value={form.email} onChange={handle} /></Field>
            <Field label="Transport ke Sekolah"><Input name="transport" value={form.transport} onChange={handle} placeholder="jalan kaki / motor / jemputan" /></Field>
            <Field label="Jarak ke Sekolah (km)"><Input name="jarakKm" value={form.jarakKm} onChange={handle} /></Field>
            <Field label="Kebutuhan Khusus (jika ada)" className="md:col-span-2">
              <Input name="kebutuhanKhusus" value={form.kebutuhanKhusus} onChange={handle} />
            </Field>
            <Field label="Riwayat Penyakit / Alergi (opsional)" className="md:col-span-2">
              <Input name="riwayatPenyakit" value={form.riwayatPenyakit} onChange={handle} />
            </Field>
          </Section>

          {/* 6) Upload Dokumen */}
          <Section title="Unggah Dokumen" desc="Format JPG/PNG/PDF. KIP/KIS/PKH opsional.">
            <Field label="Scan KK" required>
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" name="kk" onChange={handleFile} />
            </Field>
            <Field label="Scan Akta Kelahiran" required>
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" name="akta" onChange={handleFile} />
            </Field>
            <Field label="Scan Ijazah / SKL (opsional)">
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" name="ijazah" onChange={handleFile} />
            </Field>
            <Field label="Pas Foto Terbaru (3×4) Backround Merah" required>
              <div className="space-y-2">
                <Input type="file" accept=".jpg,.jpeg,.png" name="foto" onChange={handleFile} />
                {fotoPreview && (
                  <div className="rounded-lg border p-2 inline-block bg-white">
                    <img src={fotoPreview} alt="Preview Foto 3x4" className="h-40 object-cover rounded" />
                  </div>
                )}
                <p className="text-xs text-slate-500">Saat memilih foto, cropper 3×4 akan terbuka otomatis.</p>
              </div>
            </Field>
            <Field label="KIP / KIS / PKH (opsional)" className="md:col-span-2">
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" name="kip" onChange={handleFile} />
            </Field>
          </Section>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="text-rose-600">*</span> Wajib diisi (lihat ketentuan status orang tua).
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? "Mengirim..." : "Kirim Pendaftaran"}
            </button>
          </div>
        </form>
      </div>

      {/* Cropper Modal */}
      {showCropper && cropSrc && (
        <PhotoCropperModal
          src={cropSrc}
          onClose={() => { setShowCropper(false); setCropSrc(null); }}
          onApply={onCropApply}
        />
      )}
    </div>
  );
}