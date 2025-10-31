"use client";

import React, {
  useState, useCallback, forwardRef, useImperativeHandle,
} from "react";
import { Field, Input, Section } from "./PPDBFormUI";

/* ===== Konstanta & util UI ===== */
const KB = 1024;
const MB = 1024 * KB;
const TARGET_BYTES = 3 * MB;       // target kompres (UX)
const LARGE_THRESHOLD = 6 * MB;    // >6MB → pakai resumable direct upload
const HARD_LIMIT_BYTES = 40 * MB;  // pagar atas untuk mencegah salah pilih

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const safeName = (name, fallback = "dokumen.jpg") =>
  String(name || fallback).replace(/\s+/g, "_").slice(0, 140);

/** Jenjang yang WAJIB paket Dhuafa / Yatim-Piatu */
const BENEFIT_ELIGIBLE = new Set([
  "PPS Ula Putra",
  "PPS Ula Putri",
  "PPS Wustho",
  "PPS Ulya",
]);

/** Jenjang Universitas (khusus minta KTP calon mahasiswa) */
const UNIVERSITY = new Set([
  "PGMI Putra (S1)",
  "PGMI Putri (S1)",
  "MPI Putra (S1)",
  "MPI Putri (S1)",
  "PIAUD Putra (S1)",
  "PIAUD Putri (S1)",
]);

/** Jenjang yang TIDAK perlu unggah Ijazah/Suket Sekolah */
const NO_IJAZAH = new Set([
  "TK",
  "SD Putra",
  "SD Putri",
  "PPS Ula Putra",
  "PPS Ula Putri",
]);

/** Daftar wajib per tipe keringanan (tanpa foto) — 'ijazah' akan ditambahkan dinamis sesuai jenjang */
const REQUIRED_BY_TYPE_BASE = {
  dhuafa: ["kk", "akta", "ktpWali", "sktm", "pkhDtks"],
  yatimPiatu: ["kk", "akta", "ktpWali", "suketMeninggalOrtu", "sktm", "pkhDtks"],
};

const LABELS = {
  kk: "Kartu Keluarga",
  akta: "Akta Kelahiran",
  ijazah: "Ijazah / Suket Aktif Sekolah",
  ktpWali: "KTP Wali",
  sktm: "Suket Keterangan Tidak Mampu",
  pkhDtks: "Nomor PKH/DTKS (unggah bukti/scan)",
  suketMeninggalOrtu: "Suket Meninggal Orang Tua",
  // khusus universitas
  ktpMahasiswa: "KTP (Calon Mahasiswa)",
};

const FILE_KEYS = [
  "kk","akta","ijazah","ktpWali","sktm","pkhDtks","suketMeninggalOrtu","ktpMahasiswa"
];

/* ===== Util kompres & networking ===== */
async function compressIfNeeded(file, maxBytes = TARGET_BYTES) {
  try {
    if (!file || !file.type?.startsWith("image/")) return file;
    if (file.size <= maxBytes) return file;

    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    URL.revokeObjectURL(url);

    const MAX_SIDE = 2000;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.8)
    );

    return new File([blob], safeName(file.name).replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg", lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("compressIfNeeded failed:", e);
    return file;
  }
}

/** POST FormData dengan deteksi non-JSON (hindari “Unexpected token 'R'…”) */
async function postFormData(url, fd) {
  const res = await fetch(url, { method: "POST", body: fd });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    if (res.status === 413) throw new Error("Berkas terlalu besar untuk jalur FormData. Sistem akan mencoba jalur upload besar otomatis.");
    throw new Error(`Server non-JSON (${res.status}). ${text.slice(0,160)}`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Gagal (${res.status})`);
  return data;
}

/** Minta sesi resumable untuk file besar (op: "init") */
async function initResumable(identifier, items) {
  const res = await fetch("/api/ppdb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "init", identifier, files: items }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || "Gagal inisialisasi sesi upload.");
  }
  return data.uploads; // { key: { path, uploadURL } }
}

/** Jalankan upload besar ke GCS Resumable: POST (init) → PUT (body) */
async function resumableUpload(uploadURL, file) {
  // Step-1: inisiasi sesi (beberapa env sudah langsung terinisiasi; tetap lakukan POST untuk aman)
  const init = await fetch(uploadURL, {
    method: "POST",
    headers: { "x-upload-content-type": file.type || "application/octet-stream" },
  });
  const sessionURL = init.headers.get("location") || uploadURL;

  // Step-2: PUT body file
  const put = await fetch(sessionURL, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload gagal (${put.status}).`);
  return sessionURL;
}

/** Minta downloadURL via Firebase Storage SDK (agar finalize punya url) */
async function getDownloadURLByPath(path) {
  try {
    const { storage } = await import("@/lib/firebase");
    const { ref, getDownloadURL } = await import("firebase/storage");
    const r = ref(storage, path);
    return await getDownloadURL(r);
  } catch (e) {
    console.warn("getDownloadURLByPath failed:", e);
    return null; // server masih bisa pakai signedURL jika perlu
  }
}

/** Finalize (op: "finalize") — simpan form + meta */
async function finalizePPDB(payload) {
  const res = await fetch("/api/ppdb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "finalize", ...payload }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || "Finalize gagal.");
  }
  return data;
}

/* ===== Komponen utama: UploudDokumen ===== */
const UploudDokumen = forwardRef(function UploudDokumen(props, ref) {
  const { onFilesChange, jenjang } = props;

  // semua field
  const [files, setFiles] = useState({
    kk: null, akta: null, ijazah: null,
    ktpWali: null, sktm: null, pkhDtks: null, suketMeninggalOrtu: null,
    ktpMahasiswa: null,
  });
  const [benefitType, setBenefitType] = useState(""); // "dhuafa" | "yatimPiatu"

  const isBenefitMode = BENEFIT_ELIGIBLE.has(jenjang || "");
  const isUniversity = UNIVERSITY.has(jenjang || "");
  const needIjazah = !NO_IJAZAH.has(jenjang || "");

  const emitChange = useCallback((next) => {
    if (typeof onFilesChange === "function") onFilesChange(next);
  }, [onFilesChange]);

  useImperativeHandle(ref, () => ({
    getFiles: () => files,
    getBenefitType: () => (isBenefitMode ? benefitType : null),
    isComplete: () => {
      if (!isBenefitMode) {
        const dasarOk = !!(files.kk && files.akta);
        const ijzOk = needIjazah ? !!files.ijazah : true;
        const univOk = isUniversity ? !!files.ktpMahasiswa : true;
        return dasarOk && ijzOk && univOk;
      }
      if (!benefitType) return false;
      const req = [...(REQUIRED_BY_TYPE_BASE[benefitType] || [])];
      if (needIjazah) req.push("ijazah");
      return req.every((k) => !!files[k]);
    },
    getMissingFields: () => {
      if (!isBenefitMode) {
        const miss = [];
        if (!files.kk) miss.push(LABELS.kk);
        if (!files.akta) miss.push(LABELS.akta);
        if (needIjazah && !files.ijazah) miss.push(LABELS.ijazah);
        if (isUniversity && !files.ktpMahasiswa) miss.push(LABELS.ktpMahasiswa);
        return miss;
      }
      if (!benefitType) return Object.keys(REQUIRED_BY_TYPE_BASE).flatMap(t => REQUIRED_BY_TYPE_BASE[t]);
      const req = [...(REQUIRED_BY_TYPE_BASE[benefitType] || [])];
      if (needIjazah) req.push("ijazah");
      return req.filter((k) => !files[k]).map((k) => LABELS[k] || k);
    },

    /**
     * Kirim berkas: otomatis pilih jalur
     * - Kecil (<= LARGE_THRESHOLD): FormData ke /api/ppdb (legacy)
     * - Besar  (> LARGE_THRESHOLD): resumable direct upload + finalize JSON
     * @param {Object} formValues field text (nik/nisn/jenjang/...)
     * @returns Promise<any> hasil finalize API
     */
    async submit(formValues) {
      // identitas: NIK (TK/SD) → 16 digit; selain itu NISN
      const jen = String(formValues?.jenjang || "");
      const isEarly = (() => {
        const norm = jen.toLowerCase().replace(/[().]/g,"").replace(/\s+/g," ").trim();
        return norm === "tk" || norm === "taman kanak kanak" || norm === "sd" || norm.startsWith("sd ");
      })();
      const digits = (s) => String(s || "").replace(/\D+/g, "");
      const identifier = isEarly ? digits(formValues?.nik || "") : digits(formValues?.nisn || "");
      if (!identifier) throw new Error("Identifier kosong. Pastikan NIK/NISN diisi.");

      // pisahkan file kecil vs besar
      const smallKeys = [];
      const largeItems = []; // { key, file, filename, contentType }

      for (const k of FILE_KEYS) {
        const f = files[k];
        if (!f) continue;
        if (f.size > HARD_LIMIT_BYTES) {
          throw new Error(`${LABELS[k] || k}: ukuran berkas terlalu besar (>${HARD_LIMIT_BYTES/MB|0}MB).`);
        }
        if (f.size > LARGE_THRESHOLD) {
          largeItems.push({ key: k, file: f, filename: safeName(f.name || `${k}.bin`), contentType: f.type || "application/octet-stream" });
        } else {
          smallKeys.push(k);
        }
      }

      // 1) jika ADA file besar → jalur resumable
      const filesMeta = {};
      if (largeItems.length) {
        // INIT
        const uploads = await initResumable(identifier, largeItems.map(it => ({
          key: it.key, filename: it.filename, contentType: it.contentType
        }))); // { key: { path, uploadURL } }

        // UPLOAD tiap key
        for (const it of largeItems) {
          const { path, uploadURL } = uploads[it.key] || {};
          if (!path || !uploadURL) throw new Error(`Init upload gagal untuk ${it.key}.`);
          await resumableUpload(uploadURL, it.file);
          const url = await getDownloadURLByPath(path); // bisa null jika rules tak mengizinkan membaca
          filesMeta[it.key] = {
            path, url, size: it.file.size, contentType: it.contentType, uploadedAt: Date.now(),
          };
        }
      }

      // 2) jika ADA file kecil → kirim FormData legacy (sekali tembak)
      let legacyResult = null;
      if (smallKeys.length) {
        const fd = new FormData();
        // append fields text
        Object.entries(formValues || {}).forEach(([k, v]) => {
          if (v == null) return;
          fd.append(k, typeof v === "string" ? v : String(v));
        });
        // append file kecil
        for (const k of smallKeys) {
          const f = files[k];
          if (f) fd.append(k, f, safeName(f.name || `${k}.bin`));
        }

        try {
          legacyResult = await postFormData("/api/ppdb", fd);
          // merge filesMeta dari server legacy (kalau ada)
          if (legacyResult?.filesMeta) {
            Object.assign(filesMeta, legacyResult.filesMeta);
          }
        } catch (e) {
          // Jika FormData ditolak (proxy 413), informasikan untuk kecilkan/ambil ulang
          // tapi kita sudah memfilter >6MB ke jalur besar, jadi mestinya aman
          throw e;
        }
      }

      // 3) FINALIZE jika ada file besar (atau jika kamu ingin konsisten satu pintu)
      if (largeItems.length) {
        const finalizePayload = {
          identifier,
          form: formValues,
          filesMeta, // sudah berisi path/url untuk yang besar; plus (opsional) hasil legacyResult
        };
        return await finalizePPDB(finalizePayload);
      }

      // Hanya file kecil → hasil legacy sudah cukup
      return legacyResult;
    },
  }), [files, benefitType, isBenefitMode, isUniversity, needIjazah]);

  const onPickBenefit = (type) => setBenefitType(type);

  /* ===== pilih file: kompres opsional & simpan ===== */
  const handleFile = async (e) => {
    const { name, files: ff } = e.target;
    let f = ff?.[0] ?? null;
    if (!f) return;

    try {
      // Kompres bila perlu (gambar kamera besar); tetap izinkan >6MB (akan dialihkan ke jalur besar)
      const { compressImageIfNeeded } = await import("@/lib/imageCompress").catch(() => ({}));
      if (compressImageIfNeeded) {
        f = await compressImageIfNeeded(f, TARGET_BYTES);
      } else {
        f = await compressIfNeeded(f, TARGET_BYTES);
      }
    } catch (err) {
      console.warn("compressImageIfNeeded failed:", err);
    }

    setFiles((s) => {
      const next = { ...s, [name]: f };
      emitChange(next);
      return next;
    });
  };

  /* ===== UI input ===== */
  const FileInput = ({ name, label, required = false, accept = ".jpg,.jpeg,.png,.pdf", extra }) => {
    const currentFile = files[name];
    return (
      <Field label={label} required={required} className={extra}>
        <div className="relative">
          <Input
            type="file"
            accept={accept}
            name={name}
            onChange={handleFile}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          {currentFile && (
            <div className="absolute inset-0 flex items-center px-3 pointer-events-none bg-white rounded-lg border border-emerald-500">
              <div className="flex items-center gap-2 text-sm text-emerald-600 w-full">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium truncate">{currentFile.name}</span>
                <span className="text-xs text-emerald-700 flex-shrink-0 ml-auto">
                  ({(currentFile.size / KB).toFixed(1)} KB)
                </span>
              </div>
            </div>
          )}
        </div>
      </Field>
    );
  };

  /* ===== daftar wajib dinamis untuk benefit ===== */
  const requiredSetBenefit = (() => {
    if (!benefitType) return [];
    const base = REQUIRED_BY_TYPE_BASE[benefitType] || [];
    return needIjazah ? [...base, "ijazah"] : base;
  })();

  return (
    <>
      {/* === MODE BENEFIT (khusus jenjang tertentu) === */}
      {isBenefitMode ? (
        <>
          <Section
            title="Program Keringanan"
            desc="Pilih salah satu (Wajib). Dokumen yang diminta akan menyesuaikan pilihan."
          >
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onPickBenefit("dhuafa")}
                className={[
                  "rounded-xl border px-4 py-3 text-left",
                  benefitType === "dhuafa"
                    ? "border-emerald-600 bg-emerald-50 font-semibold"
                    : "border-slate-300 bg-white hover:border-emerald-400",
                ].join(" ")}
              >
                <div className="text-slate-900">Dhuafa</div>
                <div className="text-xs text-slate-600">Mengunggah SKTM & PKH/DTKS</div>
              </button>

              <button
                type="button"
                onClick={() => onPickBenefit("yatimPiatu")}
                className={[
                  "rounded-xl border px-4 py-3 text-left",
                  benefitType === "yatimPiatu"
                    ? "border-indigo-600 bg-indigo-50 font-semibold"
                    : "border-slate-300 bg-white hover:border-indigo-400",
                ].join(" ")}
              >
                <div className="text-slate-900">Yatim atau Piatu</div>
                <div className="text-xs text-slate-600">Wajib unggah Suket Meninggal Orang Tua + SKTM & PKH/DTKS</div>
              </button>
            </div>

            {!benefitType && (
              <p className="md:col-span-2 text-xs text-rose-600 mt-2">Silakan pilih salah satu.</p>
            )}
          </Section>

          {benefitType && (
            <Section
              title="Unggah Dokumen"
              desc="Format JPG/PNG/PDF. Semua dokumen berikut wajib di-upload sesuai pilihan program."
            >
              <FileInput name="kk"   label={LABELS.kk}   required={requiredSetBenefit.includes("kk")} />
              <FileInput name="akta" label={LABELS.akta} required={requiredSetBenefit.includes("akta")} />
              {needIjazah && (
                <FileInput name="ijazah" label={LABELS.ijazah} required={requiredSetBenefit.includes("ijazah")} />
              )}
              <FileInput name="ktpWali" label={LABELS.ktpWali} required={requiredSetBenefit.includes("ktpWali")} />
              <FileInput name="sktm"    label={LABELS.sktm}    required={requiredSetBenefit.includes("sktm")} />
              <FileInput name="pkhDtks" label={LABELS.pkhDtks} required={requiredSetBenefit.includes("pkhDtks")} />
              {benefitType === "yatimPiatu" && (
                <FileInput
                  name="suketMeninggalOrtu"
                  label={LABELS.suketMeninggalOrtu}
                  required={requiredSetBenefit.includes("suketMeninggalOrtu")}
                  extra="md:col-span-2"
                />
              )}
            </Section>
          )}
        </>
      ) : (
        /* === MODE DASAR (jenjang lain) === */
        <Section title="Unggah Dokumen" desc="Format JPG/PNG/PDF.">
          <FileInput name="kk"   label={LABELS.kk}   required />
          <FileInput name="akta" label={LABELS.akta} required />
          {needIjazah && <FileInput name="ijazah" label={LABELS.ijazah} required />}
          {isUniversity && (<FileInput name="ktpMahasiswa" label={LABELS.ktpMahasiswa} required />)}
        </Section>
      )}
    </>
  );
});

export default UploudDokumen;
