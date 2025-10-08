"use client";

import { useEffect, useMemo, useState } from "react";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ========= Firebase init ========= */
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
const db = getFirestore(app);

/* ========= Konstanta ========= */
const COLL = "interview_questions";      // koleksi konfigurasi
const CATS = [
  { id: "student", label: "Murid" },
  { id: "parent", label: "Orang Tua" },
];

/* ========= Util ========= */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function defaultOption(letter) {
  return { key: letter, text: "", points: 0 };
}
function defaultQuestion() {
  return {
    id: uid(),
    text: "",
    options: ["A", "B", "C", "D"].map(defaultOption),
  };
}
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
function normTo50(sum, max) {
  if (!max || max <= 0) return 0;
  return Math.round((sum / max) * 50 * 10) / 10; // 1 desimal
}

export default function SoalWawancaraPage() {
  const [activeCat, setActiveCat] = useState("student");
  const [cfg, setCfg] = useState({
    student: { questions: [defaultQuestion()], updatedAt: null },
    parent: { questions: [defaultQuestion()], updatedAt: null },
  });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("edit"); // "edit" | "preview"
  const [previewAns, setPreviewAns] = useState({ student: {}, parent: {} });
  const [message, setMessage] = useState("");

  /* ===== Load Config dari Firestore ===== */
  useEffect(() => {
    (async () => {
      try {
        const next = clone(cfg);
        for (const { id } of CATS) {
          const snap = await getDoc(doc(db, COLL, id));
          if (snap.exists()) {
            const data = snap.data();
            next[id] = {
              questions: Array.isArray(data.questions) && data.questions.length
                ? data.questions
                : [defaultQuestion()],
              updatedAt: data.updatedAt || null,
            };
          }
        }
        setCfg(next);
      } catch (e) {
        console.error(e);
        setMessage("Gagal memuat konfigurasi. Coba muat ulang halaman.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Helpers Edit ===== */
  const qList = cfg[activeCat]?.questions || [];

  function updateCfg(mutator) {
    setCfg((prev) => {
      const copy = clone(prev);
      mutator(copy);
      return copy;
    });
  }

  function addQuestion(catId) {
    updateCfg((copy) => {
      copy[catId].questions.push(defaultQuestion());
    });
  }
  function removeQuestion(catId, qid) {
    updateCfg((copy) => {
      const arr = copy[catId].questions;
      copy[catId].questions = arr.filter((q) => q.id !== qid);
      if (copy[catId].questions.length === 0) copy[catId].questions.push(defaultQuestion());
    });
  }
  function moveQuestion(catId, idx, dir) {
    updateCfg((copy) => {
      const arr = copy[catId].questions;
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
    });
  }
  function setQuestionText(catId, qid, text) {
    updateCfg((copy) => {
      const q = copy[catId].questions.find((x) => x.id === qid);
      if (q) q.text = text;
    });
  }
  function setOption(catId, qid, key, field, value) {
    updateCfg((copy) => {
      const q = copy[catId].questions.find((x) => x.id === qid);
      if (!q) return;
      const o = q.options.find((op) => op.key === key);
      if (!o) return;
      if (field === "points") o.points = Number(value || 0);
      else o.text = value;
    });
  }
  function addOption(catId, qid) {
    updateCfg((copy) => {
      const q = copy[catId].questions.find((x) => x.id === qid);
      if (!q) return;
      const nextLetter = String.fromCharCode(65 + q.options.length); // A,B,C...
      q.options.push(defaultOption(nextLetter));
    });
  }
  function removeOption(catId, qid, key) {
    updateCfg((copy) => {
      const q = copy[catId].questions.find((x) => x.id === qid);
      if (!q) return;
      q.options = q.options.filter((op) => op.key !== key);
      if (q.options.length === 0) q.options = ["A", "B"].map(defaultOption);
    });
  }

  /* ===== Save ke Firestore ===== */
  async function saveCategory(catId) {
    try {
      setSaving(true);
      const payload = clone(cfg[catId]);
      // sanitasi poin & teks
      payload.questions.forEach((q) => {
        q.text = (q.text || "").trim();
        q.options.forEach((o) => {
          o.text = (o.text || "").trim();
          o.points = Number(o.points || 0);
        });
      });
      await setDoc(
        doc(db, COLL, catId),
        { questions: payload.questions, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMessage(`Tersimpan untuk ${CATS.find((c) => c.id === catId)?.label || catId}.`);
      setTimeout(() => setMessage(""), 1500);
    } catch (e) {
      console.error(e);
      setMessage("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  /* ===== Preview Skor Dinormalisasi ke 50 ===== */
  const preview = useMemo(() => {
    const out = {};
    for (const { id } of CATS) {
      const qs = cfg[id]?.questions || [];
      let sum = 0;
      let max = 0;
      qs.forEach((q) => {
        const chosenKey = previewAns[id]?.[q.id];
        const chosen = q.options.find((o) => o.key === chosenKey);
        sum += (chosen?.points || 0);
        // untuk normalisasi, ambil maksimum poin tiap soal
        max += Math.max(0, ...q.options.map((o) => Number(o.points || 0)));
      });
      out[id] = {
        sum,
        max,
        norm50: normTo50(sum, max),
        totalQuestions: qs.length,
      };
    }
    return out;
  }, [cfg, previewAns]);

  return (
    <div className="min-h-screen flex flex-col bg-white">   
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Soal Wawancara</h1>
            <p className="text-sm text-slate-700">
              Dua kartu: <b>Murid</b> & <b>Orang Tua</b>. Tiap opsi punya poin dinamis. Skor akhir
              <i> per kartu</i> dinormalisasi menjadi <b>maks 50</b>.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("edit")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${mode === "edit" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-800"}`}
            >
              Mode Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${mode === "preview" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-800"}`}
            >
              Mode Preview Penilaian
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* Tabs kategori */}
        <div className="mb-3 flex gap-2">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                activeCat === c.id ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Card per kategori */}
        {CATS.map((cat) => (
          <section
            key={cat.id}
            className={`rounded-2xl border ${activeCat === cat.id ? "border-violet-200" : "border-slate-200"} bg-white p-4 md:p-6 mb-6`}
            hidden={activeCat !== cat.id}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Pertanyaan — {cat.label}</h2>
              {mode === "edit" ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addQuestion(cat.id)}
                    className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    + Tambah Soal
                  </button>
                  <button
                    onClick={() => saveCategory(cat.id)}
                    disabled={saving}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
                  >
                    {saving ? "Menyimpan…" : "Simpan Kartu"}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-slate-700">
                  Skor: <b>{preview[cat.id]?.norm50 ?? 0}</b> / 50{" "}
                  <span className="text-slate-500">
                    (raw {preview[cat.id]?.sum ?? 0} dari maks {preview[cat.id]?.max ?? 0})
                  </span>
                </div>
              )}
            </div>

            {/* Daftar Soal */}
            <div className="space-y-4">
              {qList.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 text-black">
                    <label className="flex-1 text-sm">
                      <span className="mb-1 block font-medium text-slate-800">
                        Soal {idx + 1}
                      </span>
                      {mode === "edit" ? (
                        <input
                          value={q.text}
                          onChange={(e) => setQuestionText(cat.id, q.id, e.target.value)}
                          placeholder="Tulis pertanyaan…"
                          className="w-full rounded border border-slate-300 px-3 py-2"
                        />
                      ) : (
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          {q.text || <span className="text-slate-400 italic">Belum diisi</span>}
                        </div>
                      )}
                    </label>

                    {mode === "edit" && (
                      <div className="shrink-0 flex items-center gap-2 pt-6">
                        <button
                          onClick={() => moveQuestion(cat.id, idx, -1)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveQuestion(cat.id, idx, +1)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeQuestion(cat.id, q.id)}
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Opsi */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((op) => (
                      <div key={op.key} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-black">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-xs font-semibold text-white">
                              {op.key}
                            </span>
                            {mode === "edit" ? (
                              <input
                                value={op.text}
                                onChange={(e) => setOption(cat.id, q.id, op.key, "text", e.target.value)}
                                placeholder={`Teks jawaban ${op.key}`}
                                className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
                              />
                            ) : (
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name={`ans-${cat.id}-${q.id}`}
                                  value={op.key}
                                  checked={previewAns[cat.id]?.[q.id] === op.key}
                                  onChange={(e) =>
                                    setPreviewAns((prev) => ({
                                      ...prev,
                                      [cat.id]: { ...(prev[cat.id] || {}), [q.id]: e.target.value },
                                    }))
                                  }
                                  className="h-4 w-4"
                                />
                                <span>{op.text || <span className="text-slate-400 italic">[opsi kosong]</span>}</span>
                              </label>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-black">
  {mode === "edit" ? (
    <>
      <span className="text-xs text-slate-500">Poin</span>
      {(() => {
        // maksimum poin = jumlah opsi pada soal ini
        const maxPts = q.options?.length || 1;
        // clamp nilai sekarang agar selalu di 1..maxPts
        const curr = Math.min(Math.max(1, Number(op.points || 1)), maxPts);
        return (
          <select
            value={curr}
            onChange={(e) =>
              setOption(cat.id, q.id, op.key, "points", Number(e.target.value))
            }
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            title={`Pilih poin 1–${maxPts}`}
          >
            {Array.from({ length: maxPts }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        );
      })()}
      <button
        onClick={() => removeOption(cat.id, q.id, op.key)}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
      >
        − Opsi
      </button>
    </>
  ) : (
    <span className="text-xs text-slate-500">({op.points} poin)</span>
  )}
</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {mode === "edit" && (
                    <div className="mt-2">
                      <button
                        onClick={() => addOption(cat.id, q.id)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                      >
                        + Tambah Opsi
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {mode === "edit" ? (
              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={() => saveCategory(cat.id)}
                  disabled={saving}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Menyimpan…" : "Simpan Kartu"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  Total skor mentah: <b>{preview[cat.id]?.sum ?? 0}</b> dari maksimum{" "}
                  <b>{preview[cat.id]?.max ?? 0}</b>
                </div>
                <div>
                  Skor akhir (normalisasi): <b>{preview[cat.id]?.norm50 ?? 0}</b> / 50
                </div>
                <div className="text-slate-500">
                  * Normalisasi menghitung porsi dari total maksimal poin seluruh soal pada kartu ini.
                </div>
              </div>
            )}
          </section>
        ))}
      </main>     
    </div>
  );
}
