"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { ChevronLeft, BadgeCheck } from "lucide-react";

/* Firebase */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

/* Util: normalisasi jenjang → kunci */
function detectUserJenjangKey(s) {
  const v = String(s || "").toUpperCase();
  if (v.includes("SD")) return "SD";
  if (v.includes("SMP")) return "SMP";
  if (v.includes("SMA")) return "SMA";
  return "";
}

/* Opsi jenjang saudara sesuai instruksi */
const SIBLING_JENJANG_OPTS = {
  SD: [
    { value: "SD Putra", label: "SD Putra" },
    { value: "SD Putri", label: "SD Putri" },
  ],
  SMP_OR_SMA: [
    { value: "SMP Putra", label: "SMP Putra" },
    { value: "SMP Putri", label: "SMP Putri" },
    { value: "SMA Putra", label: "SMA Putra" },
    { value: "SMA Putri", label: "SMA Putri" },
  ],
};

/* Opsi kelas saudara (berdasarkan jenjang saudara) */
function siblingClassOptions(siblingJenjang) {
  const v = String(siblingJenjang || "").toUpperCase();
  const isSD = v.startsWith("SD");
  const isSMP = v.startsWith("SMP");
  const isSMA = v.startsWith("SMA");
  if (isSD) return ["1", "2", "3", "4", "5"];
  if (isSMP || isSMA) return ["1", "2"];
  return [];
}

/* Opsi instansi tempat orang tua bekerja */
const INSTANSI_OPTS = [
  "MAHAD",
  "SMP IA",
  "SMP IK",
  "SMA IA",
  "MA STIT",
  "LKSA",
  "KLLINIK",
  "TK IA",
  "SD IA",
  "SD IK",
];

/* UI Inputs */
function TextField({ label, value, onChange, error, name, autoFocus=false, placeholder="", readOnly=false }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <input
          autoFocus={autoFocus}
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm outline-none transition
            text-black placeholder:text-slate-400
            ${readOnly ? "bg-slate-50 text-slate-900" : ""}
            ${error ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-slate-200 focus:ring-2 focus:ring-emerald-200"}`}
        />
        {error ? <div className="pointer-events-none absolute -bottom-5 left-0 text-[11px] text-red-600">{error}</div> : null}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, error, children, placeholder="— Pilih —", disabled=false }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm outline-none transition
            text-black
            ${disabled ? "bg-slate-50 text-slate-900" : ""}
            ${error ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-slate-200 focus:ring-2 focus:ring-emerald-200"}`}
        >
          <option value="">{placeholder}</option>
          {children}
        </select>
        {error ? <div className="pointer-events-none absolute -bottom-5 left-0 text-[11px] text-red-600">{error}</div> : null}
      </div>
    </div>
  );
}

/** Resolve NISN: doc id | nins | username */
async function resolveNisnFromParams(raw) {
  const input = String(raw || "").trim();
  if (!input) return null;

  const d = await getDoc(doc(db, "users_app", input));
  if (d.exists()) return { nisn: d.id, studentName: d.data()?.fullName || d.data()?.nama || d.data()?.name || "" };

  const q1 = query(collection(db, "users_app"), where("nins", "==", input), limit(1));
  const s1 = await getDocs(q1);
  if (!s1.empty) {
    const x = s1.docs[0];
    return { nisn: x.id, studentName: x.data()?.fullName || x.data()?.nama || x.data()?.name || "" };
  }

  const q2 = query(collection(db, "users_app"), where("username", "==", input), limit(1));
  const s2 = await getDocs(q2);
  if (!s2.empty) {
    const x = s2.docs[0];
    return { nisn: x.id, studentName: x.data()?.fullName || x.data()?.nama || x.data()?.name || "" };
  }

  return null;
}

export default function ConfirmPTKPage() {
  const params = useParams();
  const router = useRouter();

  const paramInput = useMemo(() => {
    const p = params || {};
    return (p?.nisn || p?.nins || p?.username || "").toString();
  }, [params]);

  const [resolved, setResolved] = useState(null); // { nisn, studentName }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  // data
  const [studentName, setStudentName] = useState(""); // read-only
  const [parentName, setParentName] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [jenjang, setJenjang] = useState(""); // jenjang akun (read-only, dari registrationLevel)
  const [parentInstitution, setParentInstitution] = useState(""); // instansi tempat orang tua bekerja

  // saudara
  const [siblingsCount, setSiblingsCount] = useState(""); // string angka "0..10"
  const [siblings, setSiblings] = useState([]); // [{name, jenjang, class}]

  // errors
  const [eParent, setEParent] = useState("");
  const [eJenjang, setEJenjang] = useState("");
  const [eJabatan, setEJabatan] = useState("");
  const [siblingsClassErr, setSiblingsClassErr] = useState({}); // {index: "error msg"}

  const isTK = useMemo(() => {
  const v = String(jenjang || "").toLowerCase();
  return v.includes("tk");
}, [jenjang]);

  // Load & prefill
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await resolveNisnFromParams(paramInput);
        if (!alive) return;
        if (!r) { setLoading(false); return; }
        setResolved(r);
        setStudentName(r.studentName || "");

        // 1) Baca users_app/{nisn} → registrationLevel
        let registrationLevel = "";
        const udoc = await getDoc(doc(db, "users_app", r.nisn));
        if (udoc.exists()) {
          registrationLevel = udoc.data()?.registrationLevel || "";
        }

        // 2) Prefill dari API jika ada
        const res = await fetch(`/api/ptk/confirm?nisn=${encodeURIComponent(r.nisn)}`);
        if (res.ok) {
          const j = await res.json();
          if (!alive) return;
          if (j?.student?.name && !r.studentName) setStudentName(j.student.name);
          if (j?.data) {
            const d = j.data;
            setParentName(d.parentName || "");
            setJabatan(d.jabatan || "");
            setParentInstitution(d.parentInstitution || "");
            // jumlah & array saudara
            const preCount = (d.siblingsCount === 0) ? "0" : (d.siblingsCount ? String(d.siblingsCount) : "");
            setSiblingsCount(preCount);

            // dukung format baru (array) & lama (single)
            if (Array.isArray(d.siblings)) {
              setSiblings(
                d.siblings.map((s) => ({
                  name: s?.name || "",
                  jenjang: s?.jenjang || "",
                  class: s?.class || "",
                }))
              );
            } else {
              const first = {
                name: d.siblingName || "",
                jenjang: d.siblingJenjang || "",
                class: d.siblingClass || "",
              };
              setSiblings(first.name || first.jenjang || first.class ? [first] : []);
            }

            const jenjangFromApi = d.jenjang || "";
            setJenjang(registrationLevel || jenjangFromApi || "");
          } else {
            setJenjang(registrationLevel || "");
          }
        } else {
          setJenjang(registrationLevel || "");
        }
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [paramInput]);

  // Sinkron panjang array siblings saat siblingsCount berubah
  useEffect(() => {
    const n = Math.max(0, Number(siblingsCount || 0) || 0);
    setSiblings((prev) => {
      const copy = [...prev];
      if (copy.length > n) return copy.slice(0, n);
      if (copy.length < n) {
        const add = Array.from({ length: n - copy.length }, () => ({ name: "", jenjang: "", class: "" }));
        return copy.concat(add);
      }
      return copy;
    });
    // reset error per perubahan jumlah
    setSiblingsClassErr({});
  }, [siblingsCount]);

  // Validasi
  const validate = () => {
    let ok = true;
    setEParent(""); setEJenjang(""); setEJabatan(""); setSiblingsClassErr({});
    const ne = (s) => typeof s === "string" && s.trim().length > 0;

    if (!ne(parentName)) { setEParent("Nama orang tua/wali wajib diisi."); ok = false; }
    if (!ne(jenjang)) { setEJenjang("Jenjang akun belum tersedia."); ok = false; }
    if (!ne(jabatan)) { setEJabatan("Jabatan/Profesi orang tua wajib diisi."); ok = false; }

    // Validasi saudara (opsional): jika jenjang diisi → kelas wajib; jika nama diisi → jenjang juga sebaiknya diisi
    const errs = {};
    siblings.forEach((s, idx) => {
      const hasAny = ne(s.name) || ne(s.jenjang) || ne(s.class);
      if (hasAny) {
        if (ne(s.jenjang) && !ne(s.class)) { errs[idx] = "Pilih kelas."; ok = false; }
      }
    });
    setSiblingsClassErr(errs);

    return ok;
  };

  const onBack = useCallback(() => router.back(), [router]);

  // Simpan -> auto close (back)
  const onSubmit = useCallback(async () => {
    if (!validate()) return;
    if (!resolved?.nisn) { alert("NISN tidak ditemukan."); return; }
    try {
      setSaving(true); setOk(false);

      // payload kompatibel mundur: kirim array "siblings", plus first item sebagai field lama
      const first = siblings[0] || { name: "", jenjang: "", class: "" };

      const res = await fetch("/api/ptk/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nisn: resolved.nisn,
          parentName: parentName.trim(),
          jenjang, // dari users_app.registrationLevel (read-only)
          jabatan: jabatan.trim(),
          parentInstitution: parentInstitution || "",
          siblingsCount: siblingsCount === "" ? null : Number(siblingsCount),

          // format baru:
          siblings: siblings.map((s) => ({
            name: (s.name || "").trim(),
            jenjang: s.jenjang || "",
            class: s.class || "",
          })),

          // kompatibilitas lama (biar server lama tetap aman)
          siblingName: (first.name || "").trim(),
          siblingJenjang: first.jenjang || "",
          siblingClass: first.class || "",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Gagal menyimpan");
      }
      setOk(true);
      setTimeout(() => router.back(), 250);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }, [resolved?.nisn, parentName, jenjang, jabatan, parentInstitution, siblingsCount, siblings, router]);

  // Opsi dropdown jenjang saudara tergantung jenjang akun (read-only)
  const userJenjangKey = detectUserJenjangKey(jenjang);
  const siblingJenjangOptions = useMemo(() => {
    if (userJenjangKey === "SD") return SIBLING_JENJANG_OPTS.SD;
    if (userJenjangKey === "SMA" || userJenjangKey === "SMP") return SIBLING_JENJANG_OPTS.SMP_OR_SMA;
    return [];
  }, [userJenjangKey]);

  // Helpers mutasi siblings
  const setSibling = (idx, patch) => {
    setSiblings((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      // reset kelas kalau jenjang berubah
      if ("jenjang" in patch) copy[idx].class = "";
      return copy;
    });
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50/60">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Kembali
              </button>
              <div>
                <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-900">
                  Konfirmasi Data Orang Tua/Wali
                </h1>
                <p className="text-[12px] md:text-sm text-slate-600">
                  Isi identitas orang tua/wali. Jenjang akun otomatis dari sistem.
                </p>
              </div>
            </div>
            {ok ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Tersimpan
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 md:p-6 space-y-6">
            {/* Identitas siswa */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-600">Akun</div>
              <div className="text-base font-semibold text-slate-900">{resolved?.nisn || paramInput || "-"}</div>

              <div className="mt-3 text-sm text-slate-600">Nama Anak</div>
              <div className="text-base font-semibold text-slate-900">{studentName || "-"}</div>

              {/* Jenjang (Akun Ini) dipindah ke bawah Nama Anak */}
              <div className="mt-3">
                <TextField
                  label="Jenjang (Akun Ini)"
                  name="jenjang"
                  value={jenjang || (loading ? "Memuat..." : "-")}
                  readOnly
                  error={eJenjang}
                />
              </div>
            </div>

            {/* Input orang tua + jabatan + INSTANSI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TextField
                autoFocus
                label="Nama Orang Tua"
                name="parentName"
                value={parentName}
                onChange={setParentName}
                error={eParent}                
              />
              <TextField
                label="Jabatan Orang Tua"
                name="jabatan"
                value={jabatan}
                onChange={setJabatan}
                error={eJabatan}
                placeholder="cth: Guru / TU / dll."
              />
              <SelectField
                label="Instansi Tempat Orang Tua Bekerja"
                value={parentInstitution}
                onChange={setParentInstitution}
              >
                {INSTANSI_OPTS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </SelectField>
            </div>

            {/* ====== Data Saudara (dinamis) ====== */}
            {!isTK && (
  <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="text-sm font-semibold text-slate-900">Data Saudara</div>

              {/* Jumlah Saudara */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectField
                  label="Jumlah Saudara"
                  value={siblingsCount}
                  onChange={setSiblingsCount}
                >
                  {Array.from({ length: 11 }).map((_, i) => (
                    <option key={i} value={String(i)}>{i}</option>
                  ))}
                </SelectField>
                <div className="hidden md:block" />
              </div>

              {/* Render N blok sesuai jumlah */}
              <div className="space-y-6">
                {siblings.map((s, idx) => {
                  const classOpts = siblingClassOptions(s.jenjang);
                  return (
                    <div key={idx} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 text-sm font-semibold text-slate-900">Saudara #{idx + 1}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TextField
                          label="Nama Saudara"
                          value={s.name}
                          onChange={(v) => setSibling(idx, { name: v })}                         
                        />
                        <SelectField
                          label="Jenjang Saudara"
                          value={s.jenjang}
                          onChange={(v) => setSibling(idx, { jenjang: v })}
                          disabled={siblingJenjangOptions.length === 0}
                        >
                          {siblingJenjangOptions.length === 0 ? (
                            <option value="" disabled>
                              {jenjang ? "Tidak ada opsi untuk jenjang ini" : "Menunggu jenjang akun..."}
                            </option>
                          ) : null}
                          {siblingJenjangOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </SelectField>

                        <SelectField
                          label="Kelas Saudara"
                          value={s.class}
                          onChange={(v) => setSibling(idx, { class: v })}
                          error={siblingsClassErr[idx]}
                        >
                          {classOpts.length === 0 ? (
                            <option value="" disabled>
                              {s.jenjang ? "Tidak ada opsi kelas" : "Pilih jenjang saudara terlebih dulu"}
                            </option>
                          ) : null}
                          {classOpts.map((k) => (
                            <option key={k} value={k}>Kelas {k}</option>
                          ))}
                        </SelectField>
                      </div>
                      {siblingsClassErr[idx] ? (
                        <p className="mt-2 text-[11px] text-red-600">{siblingsClassErr[idx]}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>           
            </div>
            )}
          </div>
          

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving || !resolved?.nisn}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan & Tutup"}
            </button>
          </div>
        </div>
      </div>
    </div>

    
  );
}
