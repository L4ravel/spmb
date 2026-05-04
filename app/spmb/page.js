/*
  Page PPDB utama.
  Revisi:
  - Promo Full Day Putra dan Putri bisa diatur masing-masing dengan true/false.
  - Jika status promo true, tidak muncul popup sama sekali.
  - Jika status promo false, popup peringatan muncul saat memilih jenjang Full Day.
  - Teks promo tetap 10 pendaftar pertama.
  - Biaya pendaftaran tetap bayar.
  - Yang gratis adalah biaya SPP dan uang pangkal.
*/

// page.js
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  serverTimestamp,
  runTransaction,
  getDoc,
} from "firebase/firestore";
import JenjangPicker from "./JenjangPicker";
import Ketentuan from "./ketentuan";
import WilayahPicker from "./WilayahPicker";

import {
  Field,
  Input,
  Select,
  Section,
  IncomeSelect,
  PekerjaanSelect,
  PekerjaanSelectIbu,
} from "./PPDBFormUI";

import UploudDokumen from "./uploud_dokumen";

/* ===== Utils ===== */
const digits = (s) => String(s ?? "").replace(/\D+/g, "");
const required = (v) => String(v ?? "").trim().length > 0;
const isAlive = (s) => s === "hidup";

// === Batas nomor telepon ===
const PHONE_FIELDS = new Set([
  "waliWa",
  "waliTelp",
  "ayahWa",
  "ayahTelp",
  "ibuWa",
  "ibuTelp",
  "waliHP",
]);

const clampPhoneDigits = (v) => digits(v).slice(0, 13);

/** Early: TK, SD, dan PPS Ula (Putra/Putri). */
function normalizeJenjang(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const isEarlyEducation = (jenjang) => {
  const j = normalizeJenjang(jenjang);
  if (j === "tk" || j.startsWith("sd ")) return true;
  if (j.includes("pps ula")) return true;
  return false;
};

/* ===== Promo Full Day Manual ===== */
const SMP_PUTRA_FULL_DAY = "SMP Putra Full Day";
const SMP_PUTRI_FULL_DAY = "SMP Putri Full Day";

// Teks promo tetap 10 pendaftar pertama.
const FULL_DAY_PUTRA_FREE_LIMIT = 10;
const FULL_DAY_PUTRI_FREE_LIMIT = 10;

// Ubah manual:
// true  = promo masih aktif, popup tidak muncul sama sekali
// false = promo sudah tidak aktif, popup peringatan muncul
const FULL_DAY_PUTRA_PROMO_ACTIVE = true;
const FULL_DAY_PUTRI_PROMO_ACTIVE = true;

const FULL_DAY_JENJANG = new Set([
  SMP_PUTRA_FULL_DAY,
  SMP_PUTRI_FULL_DAY,
]);

const isFullDayJenjang = (jenjang) =>
  FULL_DAY_JENJANG.has(String(jenjang || "").trim());

function getFullDayLimit(jenjang) {
  if (jenjang === SMP_PUTRA_FULL_DAY) return FULL_DAY_PUTRA_FREE_LIMIT;
  if (jenjang === SMP_PUTRI_FULL_DAY) return FULL_DAY_PUTRI_FREE_LIMIT;
  return 0;
}

function isFullDayPromoActive(jenjang) {
  if (jenjang === SMP_PUTRA_FULL_DAY) return FULL_DAY_PUTRA_PROMO_ACTIVE;
  if (jenjang === SMP_PUTRI_FULL_DAY) return FULL_DAY_PUTRI_PROMO_ACTIVE;
  return false;
}

const last8 = (nik) => digits(nik).slice(-8);

const toSafeUpperSnake = (s) =>
  (s || "LAINNYA")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^\w-]/g, "_");

/* ===== Kuota ===== */
async function claimQuota() {
  return;
}

async function releaseQuota() {
  return;
}

function scrollToAnchor(anchor) {
  if (!anchor) return;

  const el =
    document.getElementById(anchor) ||
    document.querySelector(`[name="${anchor}"]`) ||
    document.querySelector(`[data-anchor="${anchor}"]`);

  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    if (typeof el.focus === "function") el.focus();
    el.classList?.add("ring-2", "ring-rose-500");
    setTimeout(() => el.classList?.remove("ring-2", "ring-rose-500"), 1500);
  }, 200);
}

/* ===== Password hashing ===== */
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);

  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function FullDayNoticeModal({
  show,
  jenjang,
  checked,
  onCheckedChange,
  onClose,
}) {
  if (!show) return null;

  const limit = getFullDayLimit(jenjang);

  return (
    <div className="fixed inset-0 z-[998] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="h-2 bg-amber-500" />

        <div className="p-6">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl font-black text-amber-700 ring-1 ring-amber-100">
            !
          </div>

          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
            Informasi Program Full Day
          </h3>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Anda memilih jenjang{" "}
            <span className="font-extrabold text-slate-900">{jenjang}</span>.
            Promo{" "}
            <span className="font-extrabold text-emerald-700">
              biaya SPP dan uang pangkal gratis
            </span>{" "}
            hanya berlaku untuk{" "}
            <span className="font-extrabold text-emerald-700">
              {limit} pendaftar pertama
            </span>
            . Biaya pendaftaran tetap dibayar sesuai ketentuan.
          </p>

          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Anda sudah tidak mendapatkan promo biaya SPP dan uang pangkal
            gratis. Apakah Anda tetap ingin melanjutkan pendaftaran?
          </p>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-semibold leading-relaxed text-slate-700">
              Saya sudah membaca dan memahami informasi program Full Day ini.
            </span>
          </label>

          <button
            type="button"
            disabled={!checked}
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-amber-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lanjut Daftar
          </button>
        </div>
      </div>
    </div>
  );
}

function FullDayInfoModal({ info, onClose }) {
  if (!info?.show) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="absolute inset-x-0 top-0 h-2 bg-amber-500" />

        <div className="p-6">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl font-black text-amber-700 ring-1 ring-amber-100">
            !
          </div>

          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
            Anda Tidak Mendapatkan Promo
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Anda terdaftar pada jenjang{" "}
            <span className="font-bold text-slate-900">{info.jenjang}</span>.
          </p>

          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Anda sudah tidak mendapatkan promo biaya SPP dan uang pangkal
            gratis. Pendaftaran tetap berhasil dikirim dan akan diproses oleh
            panitia.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-amber-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-amber-700"
          >
            Lanjut ke Halaman Berhasil
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PPDBPage() {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const [missing, setMissing] = useState([]);

  const [successRedirect, setSuccessRedirect] = useState("");
  const [fullDayInfo, setFullDayInfo] = useState({
    show: false,
    jenjang: "",
  });

  const [fullDayNotice, setFullDayNotice] = useState({
    show: false,
    jenjang: "",
  });

  const [fullDayNoticeRead, setFullDayNoticeRead] = useState(false);

  const [form, setForm] = useState({
    jenjang: "",
    nik: "",
    noKK: "",
    nama: "",
    jk: "",
    tempatLahir: "",
    tglLahir: "",

    provinceCode: "52",
    regencyCode: "",
    districtCode: "",
    alamat: "",

    nisn: "",
    asalSekolah: "",

    ayahNama: "",
    ayahDidik: "",
    ayahKerja: "",
    ayahStatus: "",
    ayahIncome: "",
    ayahWa: "",
    ayahTelp: "",

    ibuNama: "",
    ibuDidik: "",
    ibuKerja: "",
    ibuStatus: "",
    ibuIncome: "",
    ibuWa: "",
    ibuTelp: "",

    waliNama: "",
    waliHub: "",
    waliHP: "",
    waliWa: "",
    waliTelp: "",
    waliAlamat: "",
  });

  const filesRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  const handle = (e) => {
    const { name, value } = e.target;
    let v = value;

    if (PHONE_FIELDS.has(name)) v = clampPhoneDigits(value);

    setForm((s) => {
      if (name === "ayahStatus" && v === "meninggal") {
        return {
          ...s,
          ayahStatus: v,
          ayahKerja: "",
          ayahIncome: "",
          ayahDidik: "",
        };
      }

      return { ...s, [name]: v };
    });
  };

  const handleFormKeyDown = (e) => {
    if (e.key === "Enter") {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "select" || tag === "input") e.preventDefault();
    }
  };

  const validateDetailed = () => {
    const miss = [];

    const digitsOnly = (s) => String(s ?? "").replace(/\D+/g, "");

    const isNTB = (provCode) => {
      const code = String(provCode || "");
      return code === "52" || code.split(".")[0] === "52";
    };

    if (!required(form.jenjang)) {
      miss.push({ name: "jenjang", label: "Pilih jenjang", anchor: "jenjang" });
    }

    if (!required(form.nik)) {
      miss.push({ name: "nik", label: "NIK harus diisi", anchor: "nik" });
    }

    if (!required(form.noKK)) {
      miss.push({ name: "noKK", label: "Nomor KK harus diisi", anchor: "noKK" });
    }

    if (!required(form.nama)) {
      miss.push({ name: "nama", label: "Nama lengkap harus diisi", anchor: "nama" });
    }

    if (!required(form.jk)) {
      miss.push({ name: "jk", label: "Pilih jenis kelamin", anchor: "jk" });
    }

    if (!required(form.tempatLahir)) {
      miss.push({
        name: "tempatLahir",
        label: "Isi tempat lahir",
        anchor: "tempatLahir",
      });
    }

    if (!required(form.tglLahir)) {
      miss.push({
        name: "tglLahir",
        label: "Tanggal lahir harus diisi",
        anchor: "tglLahir",
      });
    }

    if (!required(form.provinceCode)) {
      miss.push({
        name: "provinceCode",
        label: "Pilih Provinsi",
        anchor: "alamat-rumah",
      });
    }

    const ntbSelected = isNTB(form.provinceCode);

    if (!required(form.alamat)) {
      miss.push({
        name: "alamat",
        label: "Alamat lengkap harus diisi",
        anchor: "alamat-rumah",
      });
    }

    if (ntbSelected) {
      if (!required(form.regencyCode)) {
        miss.push({
          name: "regencyCode",
          label: "Pilih Kab/Kota",
          anchor: "alamat-rumah",
        });
      }

      if (!required(form.districtCode)) {
        miss.push({
          name: "districtCode",
          label: "Pilih Kecamatan",
          anchor: "alamat-rumah",
        });
      }
    }

    const showPendidikan = !isEarlyEducation(form.jenjang);

    if (showPendidikan) {
      const nisnDigits = digitsOnly(form.nisn);

      if (!(nisnDigits.length >= 8 && nisnDigits.length <= 12)) {
        miss.push({
          name: "nisn",
          label: "NISN (8–12 digit)",
          anchor: "nisn",
        });
      }

      if (!required(form.asalSekolah)) {
        miss.push({
          name: "asalSekolah",
          label: "Asal sekolah harus diisi",
          anchor: "asalSekolah",
        });
      }
    }

    if (!required(form.ayahNama)) {
      miss.push({ name: "ayahNama", label: "Nama Ayah harus diisi" });
    }

    if (!required(form.ibuNama)) {
      miss.push({ name: "ibuNama", label: "Nama Ibu harus diisi" });
    }

    if (!required(form.ayahStatus)) {
      miss.push({ name: "ayahStatus", label: "Pilih status Ayah" });
    }

    if (!required(form.ibuStatus)) {
      miss.push({ name: "ibuStatus", label: "Pilih status Ibu" });
    }

    if (isAlive(form.ayahStatus)) {
      if (!required(form.ayahKerja)) {
        miss.push({ name: "ayahKerja", label: "Pilih pekerjaan Ayah" });
      }

      if (!required(form.ayahIncome)) {
        miss.push({ name: "ayahIncome", label: "Pilih penghasilan Ayah" });
      }
    }

    if (isAlive(form.ibuStatus)) {
      if (!required(form.ibuKerja)) {
        miss.push({ name: "ibuKerja", label: "Pilih pekerjaan Ibu" });
      }

      if (!required(form.ibuIncome)) {
        miss.push({ name: "ibuIncome", label: "Pilih penghasilan Ibu" });
      }
    }

    if (!required(form.waliWa)) {
      miss.push({ name: "waliWa", label: "(masukkan nomor wali)" });
    }

    if (!required(form.waliTelp)) {
      miss.push({ name: "waliTelp", label: "(masukkan nomor wali)" });
    }

    if (digitsOnly(form.waliWa).length > 13) {
      miss.push({
        name: "waliWa",
        label: "Nomor maksimal 13 digit",
        anchor: "waliWa",
      });
    }

    if (digitsOnly(form.waliTelp).length > 13) {
      miss.push({
        name: "waliTelp",
        label: "Nomor maksimal 13 digit",
        anchor: "waliTelp",
      });
    }

    const okFiles = filesRef.current?.isComplete?.();

    if (!okFiles) {
      const missingDocs = filesRef.current?.getMissingFields?.() || [];

      if (missingDocs.length === 0) {
        miss.push({
          name: "upload",
          label: "Lengkapi dokumen",
          anchor: "upload-section",
        });
      } else {
        missingDocs.forEach((label) =>
          miss.push({ name: `doc:${label}`, label, anchor: "upload-section" })
        );
      }
    }

    return miss;
  };

  const getErr = (name) => {
    const it = missing.find((m) => m.name === name);
    return it ? it.label : "";
  };

  const createUserAccount = async (
    registrationId,
    fullName,
    jenjang,
    nik,
    nisn,
    preferredUsername
  ) => {
    const isEarly = isEarlyEducation(jenjang);
    const nikDigits = digits(nik);
    const nisnDigits = digits(nisn);

    let username = preferredUsername || (isEarly ? last8(nikDigits) : nisnDigits);

    const ensureUniqueUsername = async () => {
      const tryGet = async (u) => {
        const ref = doc(db, "users_app", u);
        const s = await getDoc(ref);
        return { ref, snap: s };
      };

      let { ref, snap } = await tryGet(username);

      if (!snap.exists()) return ref;

      const data = snap.data() || {};
      const sameNik = digits(data.nik || "") === nikDigits;
      const sameNisn = digits(data.nisn || "") === nisnDigits;

      if (sameNik || sameNisn) return ref;

      if (!isEarly) {
        throw new Error("Akun sudah ada untuk ID ini. Hubungi admin bila perlu reset.");
      }

      for (let len = Math.max(8, String(username).length + 1); len <= 16; len++) {
        const candidate = nikDigits.slice(-len);
        const { ref: r2, snap: s2 } = await tryGet(candidate);

        if (!s2.exists()) {
          username = candidate;
          return r2;
        }

        const d2 = s2.data() || {};
        const sameNik2 = digits(d2.nik || "") === nikDigits;

        if (sameNik2) {
          username = candidate;
          return r2;
        }
      }

      throw new Error("Gagal memilih username unik (NIK ekor 8–16).");
    };

    const userRef = await ensureUniqueUsername();

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);

      if (snap.exists()) {
        const data = snap.data() || {};

        tx.update(userRef, {
          registrationId: data.registrationId || registrationId,
          fullName: fullName || data.fullName || "",
          fullNameLower: (fullName || data.fullName || "").toLowerCase(),
          registrationLevel: jenjang || data.registrationLevel || "",
          nik: nikDigits || data.nik || "",
          nisn: nisnDigits || data.nisn || "",
          provinceCode: form.provinceCode || data.provinceCode || "",
          regencyCode: form.regencyCode || data.regencyCode || "",
          districtCode: form.districtCode || data.districtCode || "",
          addressLine: form.alamat || data.addressLine || "",
          updatedAt: serverTimestamp(),
        });
      } else {
        const passwordHash = await sha256Hex(username);

        tx.set(userRef, {
          username,
          role: "siswa",
          registrationId,
          fullName: fullName || "",
          fullNameLower: (fullName || "").toLowerCase(),
          registrationLevel: jenjang || "",
          nik: nikDigits || "",
          nisn: nisnDigits || "",

          provinceCode: form.provinceCode || "",
          regencyCode: form.regencyCode || "",
          districtCode: form.districtCode || "",
          addressLine: form.alamat || "",

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
      }
    });

    return username;
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const miss = validateDetailed();

    if (miss.length) {
      setMissing(miss);
      const first = miss[0];
      scrollToAnchor(first.anchor || first.name);
      return;
    }

    if (digits(form.nik).length !== 16) {
      setMissing([{ name: "nik", label: "NIK harus 16 digit", anchor: "nik" }]);
      return;
    }

    if (!isEarlyEducation(form.jenjang)) {
      const nisnD = digits(form.nisn);

      if (!(nisnD.length >= 8 && nisnD.length <= 12)) {
        setMissing([
          {
            name: "nisn",
            label: "NISN tidak valid (8–12 digit).",
            anchor: "nisn",
          },
        ]);
        return;
      }
    }

    setMissing([]);
    setSubmitting(true);

    let quotaClaimed = false;

    try {
      await claimQuota(form.jenjang);
      quotaClaimed = true;

      const early = isEarlyEducation(form.jenjang);
      const identifier = early ? digits(form.nik) : digits(form.nisn);

      const { filesMeta } = await filesRef.current.uploadSequential(identifier);

      const res = await fetch("/api/ppdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "finalize",
          identifier,
          form,
          filesMeta,
        }),
      });

      const ct = (res.headers.get("content-type") || "").toLowerCase();

      const payload = ct.includes("application/json")
        ? await res.json()
        : { success: false, error: await res.text() };

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Gagal menyimpan data PPDB.");
      }

      const registrationId = payload.registrationId;
      const preferredUsername = early ? String(payload.id) : digits(form.nisn);

      const username = await createUserAccount(
        registrationId,
        form.nama,
        form.jenjang,
        form.nik,
        form.nisn,
        preferredUsername
      );

      const namaEnc = encodeURIComponent(form.nama);
      const redirectUrl = `/spmb/success?id=${registrationId}&username=${username}&nama=${namaEnc}`;

      if (
        isFullDayJenjang(form.jenjang) &&
        !isFullDayPromoActive(form.jenjang)
      ) {
        setSuccessRedirect(redirectUrl);
        setFullDayInfo({
          show: true,
          jenjang: form.jenjang,
        });

        return;
      }

      router.push(redirectUrl);
    } catch (err) {
      if (quotaClaimed) {
        try {
          await releaseQuota(form.jenjang);
        } catch {}
      }

      const msg = String(err?.message || err || "");

      if (/entity too large|413/i.test(msg)) {
        alert(
          "❌ Ukuran unggahan terlalu besar. Dokumen sudah otomatis diunggah per-berkas; coba perkecil ukuran file dan kirim ulang."
        );
      } else {
        alert("❌ " + msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Ketentuan>
      <FullDayNoticeModal
        show={fullDayNotice.show}
        jenjang={fullDayNotice.jenjang}
        checked={fullDayNoticeRead}
        onCheckedChange={setFullDayNoticeRead}
        onClose={() => {
          setFullDayNotice({
            show: false,
            jenjang: "",
          });
          setFullDayNoticeRead(false);
        }}
      />

      <FullDayInfoModal
        info={fullDayInfo}
        onClose={() => {
          setFullDayInfo({ show: false, jenjang: "" });
          if (successRedirect) router.push(successRedirect);
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-slate-50">
        <div className="mx-auto max-w-5xl px_4 px-4 py-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />
            <div className="relative grid grid-cols-1 overflow-hidden rounded-[26px] bg-white ring-1 ring-slate-200 lg:grid-cols-2">
              <div className="order-1 hidden overflow-hidden rounded-t-[26px] lg:order-2 lg:block lg:rounded-t-none lg:rounded-br-[26px] lg:rounded-tr-[26px]">
                <div className="h-full bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white md:p-8">
                  <div className="flex h-full items-center">
                    <div className="w-full space-y-2 text-xs">
                      <div className="rounded-lg border border-white/20 bg-white/10 p-2 shadow backdrop-blur-md">
                        <div className="mb-0.5 text-[11px] font-semibold text-white">
                          Persyaratan Dokumen
                        </div>
                        <div className="text-[11px] leading-snug text-indigo-100">
                          Minimal: KK & Akta. Persyaratan lain mengikuti
                          jenjang/program.
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/20 bg-white/10 p-2 shadow backdrop-blur-md">
                        <div className="mb-0.5 text-[11px] font-semibold text-white">
                          Kredensial Akun
                        </div>
                        <div className="text-[11px] leading-snug text-indigo-100">
                          • TK/SD/PPS Ula: 8–16 digit akhir NIK (otomatis unik)
                          <br />• Jenjang lainnya: NISN
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-2 p-6 md:p-8 lg:order-1">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">
                  Pendaftaran Siswa (SPMB)
                </h2>
                <p className="mt-1 text-[13px] text-slate-600 md:text-sm">
                  Isi form berikut dengan data yang valid sesuai dokumen resmi.
                </p>

                <div className="mt-3">
                  <Link href="/" className="text-indigo-600 hover:underline">
                    ← Kembali ke Beranda
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            onKeyDown={handleFormKeyDown}
            className={[
              "space-y-2",
              "[&_input]:py-2 [&_input]:px-3 [&_input]:text-sm",
              "[&_select]:py-2 [&_select]:px-3 [&_select]:text-sm",
              "[&_textarea]:py-2 [&_textarea]:px-3 [&_textarea]:text-sm",
              "[&_label]:text-sm",
              "[&_.grid]:gap-1",
            ].join(" ")}
          >
            <Section title="Klasifikasi Pendaftaran" desc="Pilih jenjang yang dituju.">
              <div className="md:col-span-2">
                <JenjangPicker
                  value={form.jenjang}
                  onChange={(val) => {
                    setForm((s) => ({ ...s, jenjang: val }));

                    if (
                      isFullDayJenjang(val) &&
                      !isFullDayPromoActive(val)
                    ) {
                      setFullDayNoticeRead(false);

                      setFullDayNotice({
                        show: true,
                        jenjang: val,
                      });
                    } else {
                      setFullDayNotice({
                        show: false,
                        jenjang: "",
                      });
                      setFullDayNoticeRead(false);
                    }
                  }}
                />

                <Input
                  name="jenjang"
                  value={form.jenjang}
                  readOnly
                  className="opacity-0 h-0 p-0 m-0 -mt-3 pointer-events-none"
                  error={getErr("jenjang")}
                />
              </div>
            </Section>

            <Section title="Identitas Utama" desc="Sesuai Kartu Keluarga / Akta Kelahiran.">
              <Field label="NIK" required>
                <Input
                  name="nik"
                  id="nik"
                  value={form.nik}
                  onChange={handle}
                  maxLength={16}
                  error={getErr("nik")}
                />
              </Field>

              <Field label="Nomor KK" required>
                <Input
                  name="noKK"
                  value={form.noKK}
                  onChange={handle}
                  maxLength={16}
                  error={getErr("noKK")}
                />
              </Field>

              <Field label="Nama Lengkap" required>
                <Input
                  name="nama"
                  value={form.nama}
                  onChange={handle}
                  error={getErr("nama")}
                />
              </Field>

              <Field label="Jenis Kelamin" required>
                <Select name="jk" value={form.jk} onChange={handle} error={getErr("jk")}>
                  <option value="">— Pilih —</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </Select>
              </Field>

              <Field label="Tempat Lahir" required>
                <Input
                  name="tempatLahir"
                  value={form.tempatLahir}
                  onChange={handle}
                  error={getErr("tempatLahir")}
                />
              </Field>

              <Field label="Tanggal Lahir" required>
                <Input
                  type="date"
                  name="tglLahir"
                  value={form.tglLahir}
                  onChange={handle}
                  error={getErr("tglLahir")}
                />
              </Field>
            </Section>

            <Section
              title="Alamat Rumah"
              desc="Pilih wilayah domisili dan tulis alamat lengkap."
              id="alamat-rumah"
            >
              <div className="text-black md:col-span-2">
                <WilayahPicker
                  compact
                  label="Wilayah Domisili (Provinsi NTB, Kab/Kota, Kecamatan)"
                  value={{
                    provinceCode: form.provinceCode,
                    regencyCode: form.regencyCode,
                    districtCode: form.districtCode,
                    addressLine: form.alamat,
                  }}
                  onChange={(v) =>
                    setForm((s) => ({
                      ...s,
                      provinceCode: v.provinceCode || "",
                      regencyCode: v.regencyCode || "",
                      districtCode: v.districtCode || "",
                      alamat: v.addressLine || "",
                    }))
                  }
                  addressLabel="Alamat Lengkap"
                  addressRequired
                  addressPlaceholder=""
                />

                <Input
                  name="provinceCode"
                  id="provinceCode"
                  value={form.provinceCode}
                  readOnly
                  className="sr-only opacity-0 h-0 p-0 m-0 pointer-events-none"
                  error={getErr("provinceCode")}
                />

                <Input
                  name="regencyCode"
                  id="regencyCode"
                  value={form.regencyCode}
                  readOnly
                  className="sr-only opacity-0 h-0 p-0 m-0 pointer-events-none"
                  error={getErr("regencyCode")}
                />

                <Input
                  name="districtCode"
                  id="districtCode"
                  value={form.districtCode}
                  readOnly
                  className="sr-only opacity-0 h-0 p-0 m-0 pointer-events-none"
                  error={getErr("districtCode")}
                />

                <Input
                  name="alamat"
                  id="alamat"
                  value={form.alamat}
                  readOnly
                  className="sr-only opacity-0 h-0 p-0 m-0 pointer-events-none"
                  error={getErr("alamat")}
                />
              </div>
            </Section>

            {!isEarlyEducation(form.jenjang) && (
              <Section title="Pendidikan Sebelumnya">
                <Field label="NISN" required>
                  <Input
                    name="nisn"
                    id="nisn"
                    value={form.nisn}
                    onChange={handle}
                    maxLength={12}
                    inputMode="numeric"
                    error={getErr("nisn")}
                  />
                </Field>

                <Field label="Asal Sekolah" required>
                  <Input
                    name="asalSekolah"
                    value={form.asalSekolah}
                    onChange={handle}
                    error={getErr("asalSekolah")}
                  />
                </Field>
              </Section>
            )}

            <Section title="Data Ayah" desc="Jika status 'Hidup' → Pekerjaan & Penghasilan wajib.">
              <Field label="Nama Ayah" required>
                <Input
                  name="ayahNama"
                  value={form.ayahNama}
                  onChange={handle}
                  error={getErr("ayahNama")}
                />
              </Field>

              <Field label="Status Ayah" required>
                <Select
                  name="ayahStatus"
                  value={form.ayahStatus}
                  onChange={handle}
                  error={getErr("ayahStatus")}
                >
                  <option value="">— Pilih Status —</option>
                  <option value="hidup">Hidup</option>
                  <option value="meninggal">Meninggal</option>
                </Select>
              </Field>

              <Field label="Pendidikan Ayah">
                <Select
                  name="ayahDidik"
                  value={form.ayahDidik}
                  onChange={handle}
                  disabled={!isAlive(form.ayahStatus)}
                >
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
                <PekerjaanSelect
                  name="ayahKerja"
                  value={form.ayahKerja}
                  onChange={handle}
                  disabled={!isAlive(form.ayahStatus)}
                  error={isAlive(form.ayahStatus) ? getErr("ayahKerja") : ""}
                />
              </Field>

              <Field label="Penghasilan Ayah" required={isAlive(form.ayahStatus)}>
                <IncomeSelect
                  name="ayahIncome"
                  value={form.ayahIncome}
                  onChange={handle}
                  disabled={!isAlive(form.ayahStatus)}
                  error={isAlive(form.ayahStatus) ? getErr("ayahIncome") : ""}
                />
              </Field>
            </Section>

            <Section title="Data Ibu" desc="Jika status 'Hidup' → Pekerjaan & Penghasilan wajib.">
              <Field label="Nama Ibu" required>
                <Input
                  name="ibuNama"
                  value={form.ibuNama}
                  onChange={handle}
                  error={getErr("ibuNama")}
                />
              </Field>

              <Field label="Status Ibu" required>
                <Select
                  name="ibuStatus"
                  value={form.ibuStatus}
                  onChange={handle}
                  error={getErr("ibuStatus")}
                >
                  <option value="">— Pilih Status —</option>
                  <option value="hidup">Hidup</option>
                  <option value="meninggal">Meninggal</option>
                </Select>
              </Field>

              <Field label="Pendidikan Ibu">
                <Select
                  name="ibuDidik"
                  value={form.ibuDidik}
                  onChange={handle}
                  disabled={!isAlive(form.ibuStatus)}
                >
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
                <PekerjaanSelectIbu
                  name="ibuKerja"
                  value={form.ibuKerja}
                  onChange={handle}
                  disabled={!isAlive(form.ibuStatus)}
                  error={isAlive(form.ibuStatus) ? getErr("ibuKerja") : ""}
                />
              </Field>

              <Field label="Penghasilan Ibu" required={isAlive(form.ibuStatus)}>
                <IncomeSelect
                  name="ibuIncome"
                  value={form.ibuIncome}
                  onChange={handle}
                  disabled={!isAlive(form.ibuStatus)}
                  error={isAlive(form.ibuStatus) ? getErr("ibuIncome") : ""}
                />
              </Field>
            </Section>

            <Section title="Masukkan Nomor Wali" desc="Isi nomor HP/WA wali untuk keperluan kontak.">
              <Field label="Nomor Wali (WA)" required>
                <Input
                  name="waliWa"
                  value={form.waliWa}
                  onChange={handle}
                  inputMode="numeric"
                  maxLength={13}
                  error={getErr("waliWa")}
                />
              </Field>

              <Field label="Nomor Wali (Non-WA)" required>
                <Input
                  name="waliTelp"
                  value={form.waliTelp}
                  onChange={handle}
                  inputMode="numeric"
                  maxLength={13}
                  error={getErr("waliTelp")}
                />
              </Field>
            </Section>

            <Section title="Upload Dokumen">
              <div id="upload-section">
                <UploudDokumen ref={filesRef} jenjang={form.jenjang} />

                {missing.some((m) => m.anchor === "upload-section") && (
                  <div className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-400">
                    Lengkapi dokumen:{" "}
                    {missing
                      .filter((m) => m.anchor === "upload-section")
                      .map((m) => m.label)
                      .join(", ")}
                  </div>
                )}
              </div>
            </Section>

            <div className="flex items-center justify-between">
              <p className="text-[13px] text-slate-600">
                <span className="text-rose-600">*</span> Wajib diisi (lihat
                ketentuan status orang tua).
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? "Mengirim..." : "Kirim Pendaftaran"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Ketentuan>
  );
}