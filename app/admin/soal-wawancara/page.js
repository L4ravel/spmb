// app/admin/soal-wawancara/page.js
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
const CATS = [
  { id: "student", label: "Murid" },
  { id: "parent", label: "Orang Tua" },
];

// Pemetaan koleksi per paket (Paket 1 tetap kompatibel dengan data lama)
const COLL_BY_PAKET = {
  p1: "interview_questions",
  p2: "interview_questions_p2",
  p3: "interview_questions_p3",
  p4: "interview_questions_p4", // ✅ paket 4
};

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
  const [activePaket, setActivePaket] = useState("p1"); // "p1" | "p2" | "p3" | "p4"
  const [activeCat, setActiveCat] = useState("student"); // kategori per paket
  const [cfg, setCfg] = useState({
    p1: {
      student: { questions: [defaultQuestion()], updatedAt: null },
      parent: { questions: [defaultQuestion()], updatedAt: null },
    },
    p2: {
      student: { questions: [defaultQuestion()], updatedAt: null },
      parent: { questions: [defaultQuestion()], updatedAt: null },
    },
    p3: {
      student: { questions: [defaultQuestion()], updatedAt: null },
      parent: { questions: [defaultQuestion()], updatedAt: null },
    },
    p4: {
      student: { questions: [defaultQuestion()], updatedAt: null },
      parent: { questions: [defaultQuestion()], updatedAt: null },
    },
  });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("edit"); // "edit" | "preview"
  const [previewAns, setPreviewAns] = useState({
    p1: { student: {}, parent: {} },
    p2: { student: {}, parent: {} },
    p3: { student: {}, parent: {} },
    p4: { student: {}, parent: {} },
  });
  const [message, setMessage] = useState("");

  const getColl = (paket) => COLL_BY_PAKET[paket] || COLL_BY_PAKET.p1;

  /* ===== Load Config P1, P2, P3, P4 dari Firestore ===== */
  useEffect(() => {
    (async () => {
      try {
        const next = clone(cfg);

        // helper load satu paket
        const loadPaket = async (paketKey) => {
          const coll = getColl(paketKey);
          for (const { id } of CATS) {
            const snap = await getDoc(doc(db, coll, id));
            if (snap.exists()) {
              const data = snap.data();
              next[paketKey][id] = {
                questions:
                  Array.isArray(data.questions) && data.questions.length
                    ? data.questions
                    : [defaultQuestion()],
                updatedAt: data.updatedAt || null,
              };
            } else {
              // doc belum ada → biarkan default
            }
          }
        };

        await loadPaket("p1");
        await loadPaket("p2");
        await loadPaket("p3");
        await loadPaket("p4");

        setCfg(next);
      } catch (e) {
        console.error(e);
        setMessage("Gagal memuat konfigurasi. Coba muat ulang halaman.");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Helpers Edit ===== */
  const qList = cfg?.[activePaket]?.[activeCat]?.questions || [];

  function updateCfg(mutator) {
    setCfg((prev) => {
      const copy = clone(prev);
      mutator(copy);
      return copy;
    });
  }

  function addQuestion(paketKey, catId) {
    updateCfg((copy) => {
      copy[paketKey][catId].questions.push(defaultQuestion());
    });
  }
  function removeQuestion(paketKey, catId, qid) {
    updateCfg((copy) => {
      const arr = copy[paketKey][catId].questions;
      copy[paketKey][catId].questions = arr.filter((q) => q.id !== qid);
      if (copy[paketKey][catId].questions.length === 0)
        copy[paketKey][catId].questions.push(defaultQuestion());
    });
  }
  function moveQuestion(paketKey, catId, idx, dir) {
    updateCfg((copy) => {
      const arr = copy[paketKey][catId].questions;
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
    });
  }
  function setQuestionText(paketKey, catId, qid, text) {
    updateCfg((copy) => {
      const q = copy[paketKey][catId].questions.find((x) => x.id === qid);
      if (q) q.text = text;
    });
  }
  function setOption(paketKey, catId, qid, key, field, value) {
    updateCfg((copy) => {
      const q = copy[paketKey][catId].questions.find((x) => x.id === qid);
      if (!q) return;
      const o = q.options.find((op) => op.key === key);
      if (!o) return;
      if (field === "points") o.points = Number(value || 0);
      else o.text = value;
    });
  }
  function addOption(paketKey, catId, qid) {
    updateCfg((copy) => {
      const q = copy[paketKey][catId].questions.find((x) => x.id === qid);
      if (!q) return;
      const nextLetter = String.fromCharCode(65 + q.options.length); // A,B,C...
      q.options.push(defaultOption(nextLetter));
    });
  }
  function removeOption(paketKey, catId, qid, key) {
    updateCfg((copy) => {
      const q = copy[paketKey][catId].questions.find((x) => x.id === qid);
      if (!q) return;
      q.options = q.options.filter((op) => op.key !== key);
      if (q.options.length === 0) q.options = ["A", "B"].map(defaultOption);
    });
  }

  /* ===== Save ke Firestore per Paket & Kategori ===== */
  async function saveCategory(paketKey, catId) {
    try {
      setSaving(true);
      const payload = clone(cfg[paketKey][catId]);
      // sanitasi poin & teks
      payload.questions.forEach((q) => {
        q.text = (q.text || "").trim();
        q.options.forEach((o) => {
          o.text = (o.text || "").trim();
          o.points = Number(o.points || 0);
        });
      });
      await setDoc(
        doc(db, getColl(paketKey), catId),
        { questions: payload.questions, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMessage(
        `Tersimpan untuk ${
          paketKey === "p1"
            ? "Paket 1"
            : paketKey === "p2"
            ? "Paket 2"
            : paketKey === "p3"
            ? "Paket 3"
            : "Paket 4"
        } — ${CATS.find((c) => c.id === catId)?.label || catId}.`
      );
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
    const out = { p1: {}, p2: {}, p3: {}, p4: {} };
    for (const paketKey of ["p1", "p2", "p3", "p4"]) {
      for (const { id } of CATS) {
        const qs = cfg?.[paketKey]?.[id]?.questions || [];
        let sum = 0;
        let max = 0;
        qs.forEach((q) => {
          const chosenKey = previewAns?.[paketKey]?.[id]?.[q.id];
          const chosen = q.options.find((o) => o.key === chosenKey);
          sum += chosen?.points || 0;
          max += Math.max(0, ...q.options.map((o) => Number(o.points || 0)));
        });
        out[paketKey][id] = {
          sum,
          max,
          norm50: normTo50(sum, max),
          totalQuestions: qs.length,
        };
      }
    }
    return out;
  }, [cfg, previewAns]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 min-h-0 w-full max-w-none px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Soal Wawancara
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("edit")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                mode === "edit"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-300 text-slate-800"
              }`}
            >
              Mode Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                mode === "preview"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-300 text-slate-800"
              }`}
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

        {/* Tabs paket */}
        <div className="mb-3 flex gap-2">
          {[
            { id: "p1", label: "Paket 1" },
            { id: "p2", label: "Paket 2" },
            { id: "p3", label: "Paket 3" },
            { id: "p4", label: "Paket 4" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePaket(p.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                activePaket === p.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Tabs kategori */}
        <div className="mb-3 flex gap-2">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                activeCat === c.id
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Card per kategori, hanya render yang aktif */}
        {CATS.map((cat) => {
          const visible = activeCat === cat.id;
          const pvw = preview?.[activePaket]?.[cat.id] || {
            sum: 0,
            max: 0,
            norm50: 0,
          };

          return (
            <section
              key={`${activePaket}-${cat.id}`}
              className={`rounded-2xl border ${
                visible ? "border-violet-200" : "border-slate-200"
              } bg-white p-4 md:p-6 mb-6`}
              hidden={!visible}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Pertanyaan — {cat.label} (
                  {activePaket === "p1"
                    ? "Paket 1"
                    : activePaket === "p2"
                    ? "Paket 2"
                    : activePaket === "p3"
                    ? "Paket 3"
                    : "Paket 4"}
                  )
                </h2>
                {mode === "edit" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addQuestion(activePaket, cat.id)}
                      className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      + Tambah Soal
                    </button>
                    <button
                      onClick={() => saveCategory(activePaket, cat.id)}
                      disabled={saving}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Menyimpan…" : "Simpan Kartu"}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-700">
                    Skor: <b>{pvw.norm50}</b> / 50{" "}
                    <span className="text-slate-500">
                      (raw {pvw.sum} dari maks {pvw.max})
                    </span>
                  </div>
                )}
              </div>

              {/* Daftar Soal */}
              <div className="space-y-4">
                {qList.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3 text-black">
                      <label className="flex-1 text-sm">
                        <span className="mb-1 block font-medium text-slate-800">
                          Soal {idx + 1}
                        </span>
                        {mode === "edit" ? (
                          <input
                            value={q.text}
                            onChange={(e) =>
                              setQuestionText(
                                activePaket,
                                cat.id,
                                q.id,
                                e.target.value
                              )
                            }
                            placeholder="Tulis pertanyaan…"
                            className="w-full rounded border border-slate-300 px-3 py-2"
                          />
                        ) : (
                          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                            {q.text || (
                              <span className="text-slate-400 italic">
                                Belum diisi
                              </span>
                            )}
                          </div>
                        )}
                      </label>

                      {mode === "edit" && (
                        <div className="shrink-0 flex items-center gap-2 pt-6">
                          <button
                            onClick={() =>
                              moveQuestion(activePaket, cat.id, idx, -1)
                            }
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() =>
                              moveQuestion(activePaket, cat.id, idx, +1)
                            }
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() =>
                              removeQuestion(activePaket, cat.id, q.id)
                            }
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
                        <div
                          key={op.key}
                          className="rounded-lg border border-slate-200 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-black">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-xs font-semibold text-white">
                                {op.key}
                              </span>
                              {mode === "edit" ? (
                                <input
                                  value={op.text}
                                  onChange={(e) =>
                                    setOption(
                                      activePaket,
                                      cat.id,
                                      q.id,
                                      op.key,
                                      "text",
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Teks jawaban ${op.key}`}
                                  className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`ans-${activePaket}-${cat.id}-${q.id}`}
                                    value={op.key}
                                    checked={
                                      previewAns?.[activePaket]?.[cat.id]?.[
                                        q.id
                                      ] === op.key
                                    }
                                    onChange={(e) =>
                                      setPreviewAns((prev) => ({
                                        ...prev,
                                        [activePaket]: {
                                          ...(prev?.[activePaket] || {}),
                                          [cat.id]: {
                                            ...(prev?.[activePaket]?.[
                                              cat.id
                                            ] || {}),
                                            [q.id]: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    className="h-4 w-4"
                                  />
                                  <span>
                                    {op.text || (
                                      <span className="text-slate-400 italic">
                                        [opsi kosong]
                                      </span>
                                    )}
                                  </span>
                                </label>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-black">
                              {mode === "edit" ? (
                                <>
                                  <span className="text-xs text-slate-500">
                                    Poin
                                  </span>
                                  {(() => {
                                    const maxPts = q.options?.length || 1;
                                    const curr = Math.min(
                                      Math.max(1, Number(op.points || 1)),
                                      maxPts
                                    );
                                    return (
                                      <select
                                        value={curr}
                                        onChange={(e) =>
                                          setOption(
                                            activePaket,
                                            cat.id,
                                            q.id,
                                            op.key,
                                            "points",
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                                        title={`Pilih poin 1–${maxPts}`}
                                      >
                                        {Array.from(
                                          { length: maxPts },
                                          (_, i) => i + 1
                                        ).map((n) => (
                                          <option key={n} value={n}>
                                            {n}
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  })()}
                                  <button
                                    onClick={() =>
                                      removeOption(
                                        activePaket,
                                        cat.id,
                                        q.id,
                                        op.key
                                      )
                                    }
                                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                                  >
                                    − Opsi
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  ({op.points} poin)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {mode === "edit" && (
                      <div className="mt-2">
                        <button
                          onClick={() => addOption(activePaket, cat.id, q.id)}
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
                    onClick={() => saveCategory(activePaket, cat.id)}
                    disabled={saving}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? "Menyimpan…" : "Simpan Kartu"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div>
                    Total skor mentah:{" "}
                    <b>{preview?.[activePaket]?.[cat.id]?.sum ?? 0}</b> dari
                    maksimum <b>{preview?.[activePaket]?.[cat.id]?.max ?? 0}</b>
                  </div>
                  <div>
                    Skor akhir (normalisasi):{" "}
                    <b>{preview?.[activePaket]?.[cat.id]?.norm50 ?? 0}</b> / 50
                  </div>
                  <div className="text-slate-500">
                    * Normalisasi menghitung porsi dari total maksimal poin
                    seluruh soal pada kartu ini.
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}