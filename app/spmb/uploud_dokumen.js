"use client";

import React, {
  useState, useCallback, forwardRef, useImperativeHandle,
} from "react";
import { Field, Input, Section } from "./PPDBFormUI";

// ==== Firebase Storage (client) ====
import { storage } from "@/lib/firebase";
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/* ===== Util kecil ===== */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const safeName = (name, fb = "dokumen.bin") => String(name || fb).replace(/\s+/g,"_").slice(0,140);
const getExt = (name, fb="bin") => {
  const n = String(name||""); const i = n.lastIndexOf(".");
  return (i>=0 ? n.slice(i+1) : fb).toLowerCase();
};

/** Jenjang yang WAJIB paket Dhuafa / Yatim-Piatu */
const BENEFIT_ELIGIBLE = new Set([
  "PPS RA Putra",
  "PPS RA Putri",
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
  "PGMI Putra (S1) Non Asrama",
  "PGMI Putri (S1) Non Asrama",
  "MPI Putra (S1) Non Asrama",
  "MPI Putri (S1) Non Asrama",
  "PIAUD Putra (S1) Non Asrama",
  "PIAUD Putri (S1) Non Asrama",
]);

/** Jenjang yang TIDAK perlu unggah Ijazah/Suket Sekolah */
const NO_IJAZAH = new Set([
  "TK",
  "PPS RA Putra",
  "PPS RA Putri",
  "SD Putra",
  "SD Putri",
  "PPS Ula Putra",
  "PPS Ula Putri",
]);

/** Daftar wajib per tipe keringanan (tanpa foto) — 'ijazah' akan ditambahkan dinamis sesuai jenjang
 *  REVISI: untuk Yatim/Piatu TIDAK mewajibkan pkhDtks.
 */
const REQUIRED_BY_TYPE_BASE = {
  dhuafa: ["kk", "akta", "ktpWali", "sktm", "pkhDtks"],
  yatimPiatu: ["kk", "akta", "ktpWali", "suketMeninggalOrtu", "sktm"], // pkhDtks DIHAPUS
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

/* ===== (opsional) Cropper 3x4 — tidak dipakai karena field foto dihapus ===== */
function PhotoCropperModal() { return null; }

/* ===== Komponen utama: UploudDokumen ===== */
const UploudDokumen = forwardRef(function UploudDokumen(props, ref) {
  const { onFilesChange, jenjang } = props;

  // semua kemungkinan field
  const [files, setFiles] = useState({
    kk: null, akta: null, ijazah: null,
    ktpWali: null, sktm: null, pkhDtks: null, suketMeninggalOrtu: null,
    // khusus universitas
    ktpMahasiswa: null,
  });
  const [benefitType, setBenefitType] = useState(""); // "dhuafa" | "yatimPiatu"

  // progres & hasil upload (tidak mengubah UI; hanya disimpan)
  const [progressMap, setProgressMap] = useState({}); // {key: 0..100}
  const [uploadedMeta, setUploadedMeta] = useState({}); // {key: {path,url,size,contentType}}

  const isBenefitMode = BENEFIT_ELIGIBLE.has(jenjang || "");
  const isUniversity = UNIVERSITY.has(jenjang || "");
  const needIjazah = !NO_IJAZAH.has(jenjang || ""); // wajib ijazah jika BUKAN dalam daftar pengecualian

  const emitChange = useCallback((next) => {
    if (typeof onFilesChange === "function") onFilesChange(next);
  }, [onFilesChange]);

  /* ====== Helper upload satu file (sequential) ====== */
  async function uploadOne(identifier, key, file, onProgress) {
    const ts = Date.now();
    const ext = getExt(file.name, "bin");
    const path = `ppdb/${identifier}/${key}-${ts}-${safeName(file.name)}`;
    const contentType = file.type || "application/octet-stream";

    return await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(sRef(storage, path), file, { contentType });

      task.on("state_changed",
        (snap) => {
          const p = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          setProgressMap((m) => ({ ...m, [key]: p }));
          if (typeof onProgress === "function") onProgress({ key, progress: p });
        },
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref).catch(() => null);
          const meta = { path, url, size: file.size, contentType };
          setUploadedMeta((m) => ({ ...m, [key]: meta }));
          resolve(meta);
        }
      );
    });
  }

  /* expose ke parent */
  useImperativeHandle(ref, () => ({
    getFiles: () => files,
    getBenefitType: () => (isBenefitMode ? benefitType : null),
    isComplete: () => {
      // Mode dasar (non-benefit)
      if (!isBenefitMode) {
        const dasarOk = !!(files.kk && files.akta);
        const ijzOk = needIjazah ? !!files.ijazah : true;
        const univOk = isUniversity ? !!files.ktpMahasiswa : true;
        return dasarOk && ijzOk && univOk;
      }
      // Mode benefit
      if (!benefitType) return false;
      // bangun daftar wajib dinamis
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

    /** Reset progres & hasil upload */
    resetUploads: () => {
      setProgressMap({});
      setUploadedMeta({});
    },

    /**
     * Upload semua dokumen satu-per-satu ke Firebase Storage.
     * Tidak mengubah UI; kembalikan filesMeta untuk dipakai saat "Kirim".
     * @param {string} identifier NIK (TK/SD) atau NISN (lainnya)
     * @param {object} opts { onProgress?: ({key,progress})=>void, order?: string[] }
     * @returns {Promise<{filesMeta: Record<string, {path,url,size,contentType}>, uploadedKeys: string[]}>}
     */
    async uploadSequential(identifier, opts = {}) {
      const order = Array.isArray(opts.order) && opts.order.length
        ? opts.order
        : ["kk","akta","ijazah","ktpWali","sktm","pkhDtks","suketMeninggalOrtu","ktpMahasiswa"];

      const metaOut = {};
      for (const key of order) {
        const f = files[key];
        if (!f) continue;                  // lewati yang tidak diisi
        // lewati jika sudah pernah diupload & masih ada hasilnya
        if (uploadedMeta[key]?.path) { metaOut[key] = uploadedMeta[key]; continue; }
        const meta = await uploadOne(identifier, key, f, opts.onProgress);
        metaOut[key] = meta;
      }
      return { filesMeta: metaOut, uploadedKeys: Object.keys(metaOut) };
    },

    /** Ambil hasil upload terakhir (tanpa mengunggah) */
    getUploadedMeta: () => ({ ...uploadedMeta }),

    /** Ambil progres per field (0..100) */
    getProgressMap: () => ({ ...progressMap }),
  }), [files, benefitType, isBenefitMode, isUniversity, needIjazah, uploadedMeta, progressMap]);

  const onPickBenefit = (type) => setBenefitType(type);

  const handleFile = (e) => {
    const { name, files: ff } = e.target;
    const f = ff?.[0] ?? null;
    setFiles((s) => {
      const next = { ...s, [name]: f };
      if (f == null) {
        // jika dihapus, hapus progres & meta-nya
        setProgressMap((m) => {
          const n = { ...m }; delete n[name]; return n;
        });
        setUploadedMeta((m) => {
          const n = { ...m }; delete n[name]; return n;
        });
      }
      emitChange(next);
      return next;
    });
  };

  // Input file dengan indikator visual ketika sudah dipilih (UI asli tetap)
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
                  ({(currentFile.size / 1024).toFixed(1)} KB){progressMap[name]!=null ? ` • ${progressMap[name]}%` : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </Field>
    );
  };

  // daftar wajib dinamis untuk benefit
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
                <div className="text-xs text-slate-600">
                  Wajib unggah Suket Meninggal Orang Tua + SKTM (PKH/DTKS tidak diwajibkan)
                </div>
              </button>
            </div>

            {!benefitType && (
              <p className="md:col-span-2 text-xs text-rose-600 mt-2">Silakan pilih salah satu.</p>
            )}
          </Section>

          {/* Form upload HANYA muncul setelah memilih salah satu */}
          {benefitType && (
            <Section
              title="Unggah Dokumen"
              desc="Format JPG/PNG/PDF. Semua dokumen berikut wajib di-upload sesuai pilihan program."
            >
              {/* Baris 1 */}
              <FileInput name="kk"   label={LABELS.kk}   required={requiredSetBenefit.includes("kk")} />
              <FileInput name="akta" label={LABELS.akta} required={requiredSetBenefit.includes("akta")} />

              {/* Baris 2 */}
              {needIjazah && (
                <FileInput name="ijazah" label={LABELS.ijazah} required={requiredSetBenefit.includes("ijazah")} />
              )}
              <FileInput name="ktpWali" label={LABELS.ktpWali} required={requiredSetBenefit.includes("ktpWali")} />

              {/* Baris 3 */}
              <FileInput name="sktm" label={LABELS.sktm} required={requiredSetBenefit.includes("sktm")} />
              {/* REVISI: pkhDtks disembunyikan bila Yatim/Piatu */}
              {benefitType !== "yatimPiatu" && (
                <FileInput name="pkhDtks" label={LABELS.pkhDtks} required={requiredSetBenefit.includes("pkhDtks")} />
              )}

              {/* Khusus Yatim/Piatu */}
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
          {/* Ijazah hanya untuk jenjang yang MEMBUTUHKAN */}
          {needIjazah && <FileInput name="ijazah" label={LABELS.ijazah} required />}
          {/* Khusus Universitas: minta KTP calon mahasiswa */}
          {isUniversity && (
            <FileInput name="ktpMahasiswa" label={LABELS.ktpMahasiswa} required />
          )}
        </Section>
      )}

      {/* Cropper di-nonaktifkan (tidak ada field foto) */}
      {false && <PhotoCropperModal />}
    </>
  );
});

export default UploudDokumen;
