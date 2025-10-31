"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ========== Firebase Client (Storage + Firestore) ========== */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  limit,
  deleteDoc,
} from "firebase/firestore";

function getFirebaseApp() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return getApps().length ? getApp() : initializeApp(cfg);
}
const app = getFirebaseApp();
const storage = getStorage(app);
const db = getFirestore(app);

// normalisasi label → aman untuk path / query
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

// normalisasi longgar untuk pencocokan label fees vs registrationLevel
const normLoose = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Cari label fees paling cocok */
function chooseMatchingLabel(userLevel, feeLabels) {
  if (!feeLabels?.length) return "";
  if (!userLevel) return feeLabels[0];

  const exact = feeLabels.find((l) => l === userLevel);
  if (exact) return exact;

  const nUser = normLoose(userLevel);
  const byLoose = feeLabels.find((l) => normLoose(l) === nUser);
  if (byLoose) return byLoose;

  const sUser = toSafeUpperSnake(userLevel);
  const bySnake = feeLabels.find((l) => toSafeUpperSnake(l) === sUser);
  if (bySnake) return bySnake;

  return feeLabels[0];
}

export default function SoalModal({
  open,
  onClose,
  onSaved,
  defaultPaketId = "paket-1",
  initialData = null,   // jika edit, { id, ... }
  nisnTarget = null,    // opsional: NISN user untuk auto pilih tingkat
}) {
  const [paketId, setPaketId] = useState(defaultPaketId);
  const [mapel, setMapel] = useState("Umum");

  // tingkat
  const [tingkat, setTingkat] = useState("");
  const [tingkatOptions, setTingkatOptions] = useState([]);
  const [tingkatLoading, setTingkatLoading] = useState(false);
  const [tingkatErr, setTingkatErr] = useState("");
  const [userRegLevel, setUserRegLevel] = useState("");

  const [pertanyaan, setPertanyaan] = useState("");
  const [opsi, setOpsi] = useState(["", "", "", ""]);
  const [opsiImages, setOpsiImages] = useState([]); // URL per opsi
  const [jawabanIndex, setJawabanIndex] = useState(0);

  // gambar soal
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrl, setImageUrl] = useState(""); // URL langsung (opsional)
  const fileInputRef = useRef(null);

  // input file khusus ikon gambar Opsi
  const optFileInputRef = useRef(null);
  const [optUploadIndex, setOptUploadIndex] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [appeared, setAppeared] = useState(false);

  const isEdit = !!initialData?.id;

  /* ===== Prefill modal & reset ===== */
  useEffect(() => {
    if (!open) { setAppeared(false); return; }

    let _paketId    = defaultPaketId;
    let _mapel      = "Umum";
    let _tingkat    = "";
    let _pertanyaan = "";
    let _opsi       = ["", "", "", ""];
    let _opsiImages = [];
    let _jawab      = 0;
    let _imgUrl     = "";

    if (isEdit) {
      _paketId    = initialData.paketId    ?? _paketId;
      _mapel      = initialData.mapel      ?? _mapel;
      _tingkat    = initialData.tingkatRaw ?? initialData.tingkat ?? _tingkat;
      _pertanyaan = initialData.pertanyaan ?? _pertanyaan;
      _opsi       = Array.isArray(initialData.opsi) && initialData.opsi.length ? initialData.opsi : _opsi;
      _opsiImages = Array.isArray(initialData.opsiImages) ? initialData.opsiImages : [];
      _jawab      = typeof initialData.jawabanIndex === "number" ? initialData.jawabanIndex : 0;
      _imgUrl     = (
        initialData.imageUrl ?? initialData.image ?? initialData.imgUrl ??
        initialData.gambarUrl ?? initialData.gambar ?? ""
      );
    }

    setPaketId(_paketId);
    setMapel(_mapel);
    setTingkat((_tingkat || "").toString());
    setPertanyaan(_pertanyaan);
    setOpsi(_opsi);
    setOpsiImages(_opsiImages);
    setJawabanIndex(_jawab);
    setImageFile(null);
    setImagePreview("");
    setImageUrl(_imgUrl);
    setErr("");
    setTingkatErr("");

    requestAnimationFrame(() => setAppeared(true));
  }, [open, isEdit, defaultPaketId, initialData]);

  // ESC untuk tutup
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ===== Ambil daftar TINGKAT dari fees ===== */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setTingkatLoading(true);
        setTingkatErr("");

        const snap = await getDocs(collection(db, "fees"));
        const labels = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          const label = (data.label || "").toString().trim();
          if (label) labels.push(label);
        });

        labels.sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" }));

        if (!cancelled) {
          setTingkatOptions(labels);
          setTingkat((prev) => prev || labels[0] || "");
        }
      } catch (e) {
        if (!cancelled) setTingkatErr(String(e.message || e));
      } finally {
        if (!cancelled) setTingkatLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  /* ===== Jika nisnTarget diberikan: baca users_app/{nisn}/registrationLevel ===== */
  useEffect(() => {
    if (!open || !nisnTarget) return;
    let cancelled = false;

    (async () => {
      try {
        const ref = doc(db, "users_app", String(nisnTarget));
        const snap = await getDoc(ref);
        const lv = snap.exists() ? (snap.data()?.registrationLevel || "") : "";
        if (!cancelled) setUserRegLevel(lv);
      } catch {
        if (!cancelled) setUserRegLevel("");
      }
    })();

    return () => { cancelled = true; };
  }, [open, nisnTarget]);

  /* ===== Tentukan default tingkat berdasar opsi & userRegLevel ===== */
  useEffect(() => {
    if (!open) return;
    if (!tingkatOptions.length) return;
    if (tingkat && tingkatOptions.includes(tingkat)) return;

    if (userRegLevel) {
      const match = chooseMatchingLabel(userRegLevel, tingkatOptions);
      setTingkat(match);
      return;
    }
    setTingkat((prev) => prev || tingkatOptions[0] || "");
  }, [open, tingkatOptions, userRegLevel, tingkat]);

  /* ========== Helpers opsi ========== */
  function setOpsiAt(i, v) {
    setOpsi((o) => o.map((x, idx) => (idx === i ? v : x)));
  }
  function addOpsi() {
    if (opsi.length < 8) {
      setOpsi((o) => [...o, ""]);
      setOpsiImages((imgs) => [...imgs, undefined]);
    }
  }
  function removeOpsi(i) {
    if (opsi.length <= 2) return;
    const next = opsi.slice(); next.splice(i, 1);
    const nextImg = (opsiImages || []).slice(); nextImg.splice(i, 1);
    setOpsi(next);
    setOpsiImages(nextImg);
    if (jawabanIndex >= next.length) setJawabanIndex(0);
  }

  /* ========== Upload gambar SOAL ========== */
  function onPickImage() { fileInputRef.current?.click(); }
  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("File harus gambar (JPG/PNG/WebP/SVG).");
    if (f.size > 1.5 * 1024 * 1024) return setErr("Ukuran gambar maks 1.5MB.");
    setErr(""); setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || "")); // preview
    reader.readAsDataURL(f);
  }
  function removeImage() { setImageFile(null); setImagePreview(""); }

  /* ========== Upload gambar untuk OPSI ========== */
  function onPickOpsiImage(i) {
    setOptUploadIndex(i);
    optFileInputRef.current?.click();
  }
  async function onOpsiFileChange(e) {
    const f = e.target.files?.[0];
    if (!f || optUploadIndex == null) return;
    if (!f.type.startsWith("image/")) { setErr("File harus gambar (JPG/PNG/WebP/SVG)."); return; }
    if (f.size > 1024 * 1024) { setErr("Gambar opsi maks 1MB."); return; }
    setErr("");

    try {
      const tingkatRaw = (tingkat || "").toString().trim();
      const safeTingkat = toSafeUpperSnake(tingkatRaw);
      const ext = (() => {
        const n = f.name || "";
        const dot = n.lastIndexOf(".");
        return dot >= 0 ? n.slice(dot + 1).toLowerCase() : "jpg";
      })();
      const key = `soal/${safeTingkat}/opsi/${Date.now()}_${optUploadIndex}.${ext}`;
      const sref = storageRef(storage, key);
      await uploadBytes(sref, f, { contentType: f.type });
      const url = await getDownloadURL(sref);
      setOpsiImages((imgs) => {
        const next = imgs.slice();
        next[optUploadIndex] = url;
        return next;
      });
    } catch (err) {
      setErr(String(err?.message || err));
    } finally {
      e.target.value = "";
      setOptUploadIndex(null);
    }
  }
  function removeOpsiImage(i) {
    setOpsiImages((imgs) => {
      const next = imgs.slice();
      next[i] = undefined;
      return next;
    });
  }

  /* ========== Validasi minimal ========== */
  const disabledSave = useMemo(() => {
    const filled = opsi.filter((x) => x.trim());
    return (
      !pertanyaan.trim() ||
      filled.length < 2 ||
      jawabanIndex < 0 || jawabanIndex >= opsi.length ||
      !opsi[jawabanIndex].trim() ||
      !tingkat.trim()
    );
  }, [pertanyaan, opsi, jawabanIndex, tingkat]);

  /* ========== Simpan ke Firestore ========== */
  async function save() {
    if (disabledSave) return;
    setLoading(true); setErr("");
    try {
      const tingkatRaw = (tingkat || "").toString().trim();
      const safeTingkat = toSafeUpperSnake(tingkatRaw);

      // Upload gambar SOAL jika ada file baru; jika tidak, pakai imageUrl
      let finalImageUrl = (imageUrl || "").trim();
      if (imageFile) {
        const ext = (() => {
          const n = imageFile.name || "";
          const dot = n.lastIndexOf(".");
          return dot >= 0 ? n.slice(dot + 1).toLowerCase() : "jpg";
        })();
        const key = `soal/${safeTingkat}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const sref = storageRef(storage, key);
        await uploadBytes(sref, imageFile, { contentType: imageFile.type });
        finalImageUrl = await getDownloadURL(sref);
      }

      const payload = {
        paketId: (paketId || "").trim(),
        mapel: (mapel || "").trim(),
        tingkat: safeTingkat,        // untuk filter cepat
        tingkatRaw,                  // label fees
        pertanyaan,
        opsi: opsi.map((s) => s.trim()).filter(Boolean),
        opsiImages: (opsiImages || []).map((u) => (u || "")).slice(0, opsi.length),
        jawabanIndex,
        aktif: true,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      };

      let result = null;

      if (isEdit) {
        const ref = doc(db, "soal", String(initialData.id));
        await setDoc(ref, payload, { merge: true });
        result = { id: String(initialData.id), ...initialData, ...payload };
      } else {
        const ref = await addDoc(collection(db, "soal"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        result = { id: ref.id, ...payload };
      }

      onSaved?.(result);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  /* ========== Hapus Soal (edit mode) ========== */
  async function handleDelete() {
    if (!isEdit || !initialData?.id) return;
    if (!confirm("Hapus soal ini secara permanen?")) return;

    setLoading(true);
    setErr("");
    try {
      await deleteDoc(doc(db, "soal", String(initialData.id)));
      onSaved?.({ id: String(initialData.id), deleted: true });
      onClose?.();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div
        className={["absolute inset-0 bg-black/50 transition-opacity duration-200", appeared ? "opacity-100" : "opacity-0"].join(" ")}
        onClick={onClose}
      />
      {/* modal card */}
      <div className="absolute inset-0 flex items-start justify-center p-4 md:p-6 overflow-auto">
        <div
          className={[
            "w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-violet-100",
            "transition-all duration-200",
            appeared ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[.98]",
          ].join(" ")}
          role="dialog" aria-modal="true"
        >
          {/* header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">#</span>
              <span className="font-semibold">{isEdit ? "Edit Soal" : "Pertanyaan"}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">Pilihan ganda</span>
            </div>

            <div className="flex items-center gap-2">
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-60"
                  title="Hapus soal"
                >
                  Hapus Soal
                </button>
              )}
              <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" title="Tutup" aria-label="Tutup">✕</button>
            </div>
          </div>

          {/* body */}
          <div className="px-5 py-4 space-y-4">
            {/* meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-sm text-slate-600">Paket</label>
                <input value={paketId} onChange={(e) => setPaketId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-sm text-slate-600">Mapel</label>
                <input value={mapel} onChange={(e) => setMapel(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-sm text-slate-600">Tingkat</label>
                <select
                  value={tingkat}
                  onChange={(e) => setTingkat(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none bg-white"
                  title="Label jenjang diambil dari koleksi fees"
                  disabled={tingkatLoading || tingkatOptions.length === 0}
                >
                  {tingkatLoading && <option>Memuat…</option>}
                  {!tingkatLoading && tingkatOptions.length === 0 && <option>Tidak ada data</option>}
                  {!tingkatLoading && tingkatOptions.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                {userRegLevel ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Registrasi akun: <b>{userRegLevel}</b>
                  </div>
                ) : null}
                {tingkatErr && <div className="text-xs text-amber-600 mt-1">{tingkatErr}</div>}
              </div>
            </div>

            {/* pertanyaan + upload gambar */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr,240px] gap-3">
              <textarea
                value={pertanyaan}
                onChange={(e) => setPertanyaan(e.target.value)}
                rows={4}
                className="w-full rounded-lg border px-3 py-2 outline-none"
                placeholder="Silakan masukkan pertanyaan Anda"
              />

              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium text-slate-700">Gambar Soal (opsional)</div>

                {/* gambar dari file baru */}
                {imagePreview ? (
                  <div className="mt-2 space-y-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-36 object-contain rounded-md border" />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={removeImage} className="rounded-full border px-3 py-1 text-sm hover:bg-slate-50">
                        Hapus
                      </button>
                      <a href={imagePreview} target="_blank" rel="noreferrer" className="text-sm text-violet-700 hover:underline">
                        Lihat ukuran penuh
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    {!imagePreview && imageUrl ? (
                      <img src={imageUrl} alt="Gambar Soal" className="mt-2 w-full h-24 object-contain rounded-md border" />
                    ) : null}

                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={onPickImage}
                        className="w-full rounded-lg bg-violet-50 text-violet-700 py-2 hover:bg-violet-100"
                      >
                        Upload Gambar
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                      <div className="text-xs text-slate-500">
                        Atau gunakan URL:
                        <input
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className="mt-1 w-full rounded-md border px-2 py-1 outline-none"
                          placeholder="https://…"
                        />
                      </div>
                      <div className="text-[11px] text-slate-400">Maks 1.5MB. Format umum: JPG/PNG/WebP.</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* opsi jawaban (+ ikon gambar) */}
            <div className="space-y-2">
              {opsi.map((v, i) => {
                const img = opsiImages?.[i];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setJawabanIndex(i)}
                  >
                    <label
                      className="flex items-center gap-2 rounded-full border px-3 py-1 text-slate-600 cursor-pointer select-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-sm">Benar</span>
                      <input
                        type="radio" name="benar"
                        checked={jawabanIndex === i}
                        onChange={() => setJawabanIndex(i)}
                        className="accent-violet-600"
                        aria-label={`Tandai opsi ${i + 1} sebagai benar`}
                      />
                    </label>

                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ background: ["#ef4444","#a855f7","#3b82f6","#f59e0b","#10b981","#ec4899","#06b6d4","#84cc16"][i % 8] }}
                    />

                    {/* input teks opsi */}
                    <input
                      value={v}
                      onChange={(e) => setOpsiAt(i, e.target.value)}
                      className="flex-1 rounded-lg border px-3 py-2 outline-none"
                      placeholder={`Opsi ${i + 1}`}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* ikon gambar minimalis */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title={img ? "Ganti gambar" : "Tambahkan gambar"}
                        className="rounded-full p-2 hover:bg-slate-100"
                        onClick={() => onPickOpsiImage(i)}
                        aria-label="Upload gambar opsi"
                      >
                        🖼️
                      </button>
                      {img && (
                        <>
                          <a
                            href={img}
                            target="_blank"
                            rel="noreferrer"
                            title="Lihat gambar"
                            className="rounded-full p-2 hover:bg-slate-100"
                            aria-label="Lihat gambar opsi"
                          >
                            🔍
                          </a>
                          <button
                            type="button"
                            title="Hapus gambar"
                            className="rounded-full p-2 hover:bg-slate-100"
                            onClick={() => removeOpsiImage(i)}
                            aria-label="Hapus gambar opsi"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>

                    {/* thumb kecil */}
                    {img && (
                      <img src={img} alt="" className="ml-1 h-8 w-8 object-cover rounded border" />
                    )}

                    {/* hapus opsi */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeOpsi(i); }}
                      className="rounded-full p-2 hover:bg-slate-100"
                      title="Hapus opsi"
                      disabled={opsi.length <= 2}
                      aria-label={`Hapus opsi ${i + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={addOpsi}
                  className="w-full rounded-lg bg-violet-50 text-violet-700 py-2 hover:bg-violet-100"
                >
                  Tambahkan opsi jawaban +
                </button>
              </div>
            </div>

            {err && <div className="text-amber-600 text-sm">{err}</div>}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t">
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700">Batal</button>

            <div className="flex items-center gap-2">
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="rounded-lg bg-rose-50 text-rose-700 px-4 py-2 font-semibold ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50"
                  title="Hapus soal"
                >
                  {loading ? "Memproses…" : "Hapus Soal"}
                </button>
              )}
              <button
                onClick={save}
                disabled={loading || disabledSave}
                className="rounded-lg bg-violet-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
              >
                {loading ? "Menyimpan…" : (isEdit ? "Simpan Perubahan" : "Simpan")}
              </button>
            </div>
          </div>

          {/* hidden input untuk ikon gambar opsi */}
          <input
            ref={optFileInputRef}
            type="file"
            accept="image/*"
            onChange={onOpsiFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
