"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import ConfirmModal from "./ConfirmModal";
import ResultModal from "./ResultModal";
import NavigatorModal from "./NavigatorModal";

/* ================= Firebase ================= */
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

/* ================= Utils ================= */
const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());
const DURATION_MS = 120 * 60 * 1000; // 120 menit
const LS_KEY = (nisn) => `examStart:${nisn}`;

const ANS_KEY = (nisn) => `examAns:${nisn}`; // optional cache lokal
const IDX_KEY = (nisn) => `examIdx:${nisn}`;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function shuffleDeterministic(arr, seedStr) {
  const a = arr.slice();
  const rand = mulberry32(hash32(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

export default function UjianPage() {
  const { nisn } = useParams();
  const router = useRouter();

  /* ==== Gate & sesi ==== */
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [regLevelRaw, setRegLevelRaw] = useState(null);
  const [regLevelSafe, setRegLevelSafe] = useState(null);

  /* ==== Soal & jawaban ==== */
  const [soal, setSoal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jawaban, setJawaban] = useState({}); // {soalId: index}
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  /* ==== Modals & skor ==== */
  const [askFinish, setAskFinish] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [score, setScore] = useState({ benar: 0, total: 0, detail: [] });

  /* ==== Timer ==== */
  const [deadline, setDeadline] = useState(null);
  const [remain, setRemain] = useState(DURATION_MS);

  /* ========= Gate: ambil user & cek izin ========= */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("appUser") : null;
        if (!raw) { router.replace("/login"); return; }
        const u = JSON.parse(raw);
        const sessionNisn = u?.username;

        if (!isNISN(sessionNisn) || String(sessionNisn) !== String(nisn)) {
          router.replace("/confirm-ujian"); return;
        }

        const userRef = doc(db, "users_app", sessionNisn);
        const snap = await getDoc(userRef);
        if (!snap.exists()) { router.replace("/confirm-ujian"); return; }
        const d = snap.data() || {};

        // SYARAT SEDERHANA: pembayaran verified & belum completed
        const paid =
          d.verifiedPayment === true ||
          d.registrationPaymentStatus === "verified" ||
          d.reRegistrationPaymentStatus === "verified";

        const rawLevel = (d.registrationLevel || "").toString().trim();
        const safeLevel = rawLevel ? toSafeUpperSnake(rawLevel) : null;

        if (!cancelled) {
          setRegLevelRaw(rawLevel || null);
          setRegLevelSafe(safeLevel);
        }

        if (paid && d.examStatus !== "completed") {
          if (!cancelled) setAllowed(true);
        } else {
          router.replace("/confirm-ujian"); return;
        }
      } catch (e) {
        console.error("Gate error:", e);
        router.replace("/confirm-ujian"); return;
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nisn, router, db]);

  /* ========= Inisialisasi deadline ========= */
  useEffect(() => {
    if (!allowed) return;
    const key = LS_KEY(nisn);
    let start = null;
    try {
      const saved = localStorage.getItem(key);
      if (saved && /^\d+$/.test(saved)) start = parseInt(saved, 10);
    } catch {}
    if (!start) {
      start = Date.now();
      try { localStorage.setItem(key, String(start)); } catch {}
    }
    setDeadline(start + DURATION_MS);
  }, [allowed, nisn]);

  /* ========= Ticker ========= */
  useEffect(() => {
    if (!deadline) return;
    let killed = false;
    const tick = () => {
      if (killed) return;
      const r = Math.max(deadline - Date.now(), 0);
      setRemain(r);
      if (r === 0) handleFinish(true); // auto submit
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { killed = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  /* ========= Load soal + RESTORE jawaban dari users_app ========= */
  useEffect(() => {
    if (!allowed || !regLevelSafe) return;
    let disposed = false;
    (async () => {
      setLoading(true);
      try {
        const qRef = query(
          collection(db, "soal"),
          where("tingkat", "==", regLevelSafe),
          orderBy("updatedAt", "desc")
        );
        const snap = await getDocs(qRef);
        if (disposed) return;

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const shuffled = shuffleDeterministic(rows, String(nisn));
        setSoal(shuffled);

        // === Restore dari users_app ===
        const uSnap = await getDoc(doc(db, "users_app", String(nisn)));
        if (uSnap.exists()) {
          const u = uSnap.data() || {};
          const ans = u.examAnswers || {};
          const valid = {};
          shuffled.forEach((s) => {
            if (ans.hasOwnProperty(s.id)) valid[s.id] = ans[s.id];
          });
          setJawaban((prev) => ({ ...prev, ...valid }));
          const ci = Number.isInteger(u.examCurrentIndex) ? u.examCurrentIndex : 0;
          setIdx(Math.max(0, Math.min(ci, shuffled.length - 1)));
        } else {
          setIdx(0);
        }

        // (opsional) merge dari localStorage juga
        try {
          const rawAns = localStorage.getItem(ANS_KEY(nisn));
          if (rawAns) {
            const saved = JSON.parse(rawAns);
            const valid = {};
            shuffled.forEach((s) => {
              if (saved.hasOwnProperty(s.id)) valid[s.id] = saved[s.id];
            });
            setJawaban((prev) => ({ ...prev, ...valid }));
          }
          const rawIdx = localStorage.getItem(IDX_KEY(nisn));
          if (rawIdx && /^\d+$/.test(rawIdx)) {
            const i = Math.max(0, Math.min(parseInt(rawIdx, 10), shuffled.length - 1));
            setIdx(i);
          }
        } catch {}
      } catch (e) {
        console.error("Gagal load soal:", e);
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => { disposed = true; };
  }, [allowed, regLevelSafe, nisn, db]);

  /* ========= Derivatif ========= */
  const totalSoal = soal.length;
  const ids = soal.map((s) => s.id);
  const current = soal[idx];

  const hitungSkor = useMemo(() => {
    let benar = 0;
    const detail = soal.map((s, i) => {
      const isBenar = Number(jawaban[s.id]) === Number(s.jawabanIndex);
      if (isBenar) benar++;
      return { no: i + 1, benar: isBenar };
    });
    return { benar, total: totalSoal, detail };
  }, [jawaban, soal, totalSoal]);

  const fmtRemain = useMemo(() => {
    const s = Math.floor(remain / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }, [remain]);

  /* ========= Autosave lokal (opsional) ========= */
  useEffect(() => {
    try { localStorage.setItem(ANS_KEY(nisn), JSON.stringify(jawaban || {})); } catch {}
  }, [jawaban, nisn]);
  useEffect(() => {
    try { localStorage.setItem(IDX_KEY(nisn), String(idx)); } catch {}
  }, [idx, nisn]);

  /* ========= Helpers simpan ke Firestore (USERS_APP) ========= */
  async function saveAnswerCloud(soalId, pilihanIdx, currentIndex) {
    try {
      await updateDoc(doc(db, "users_app", String(nisn)), {
        [`examAnswers.${soalId}`]: pilihanIdx,
        examCurrentIndex: currentIndex,
        examStatus: "in_progress",
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("saveAnswerCloud failed:", e);
    }
  }
  async function saveIndexCloud(currentIndex) {
    try {
      await updateDoc(doc(db, "users_app", String(nisn)), {
        examCurrentIndex: currentIndex,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("saveIndexCloud failed:", e);
    }
  }

  /* ========= Handlers ========= */
  function pilih(id, pilihanIdx) {
    if (locked) return;
    setJawaban((prev) => {
      const next = { ...prev, [id]: pilihanIdx };
      saveAnswerCloud(id, pilihanIdx, idx); // autosave ke Firestore
      return next;
    });
  }
  function next() {
    if (idx < totalSoal - 1) {
      const ni = idx + 1;
      setIdx(ni);
      saveIndexCloud(ni);
    }
  }
  function prev() {
    if (idx > 0) {
      const pi = idx - 1;
      setIdx(pi);
      saveIndexCloud(pi);
    }
  }
  function goto(i) {
    if (i >= 0 && i < totalSoal) {
      setIdx(i);
      saveIndexCloud(i);
    }
  }

  async function writeCompletionAndExit(_score) {
    try {
      await updateDoc(doc(db, "users_app", String(nisn)), {
        examStatus: "completed",
        examScoreBenar: _score.benar,
        examScoreTotal: _score.total,
        examScorePercent:
          _score.total > 0 ? Math.round((_score.benar / _score.total) * 100) : 0,
        examFinishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Gagal update users_app:", e);
    } finally {
      try {
        localStorage.removeItem(LS_KEY(nisn));
        localStorage.removeItem(ANS_KEY(nisn));
        localStorage.removeItem(IDX_KEY(nisn));
      } catch {}
      router.replace("/portal");
    }
  }

  async function handleFinish(isAuto = false) {
    if (locked) return;
    setLocked(true);
    const s = hitungSkor;
    setScore(s);

    if (isAuto) {
      await writeCompletionAndExit(s);
    } else {
      setShowResult(true);
    }
  }

  /* ========= Render gates ========= */
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600 animate-pulse">Memeriksa izin ujian…</div>
      </div>
    );
  }
  if (!allowed) {
    return null; // router.replace sudah dijalankan
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600 animate-pulse">Memuat soal…</div>
      </div>
    );
  }
  if (!totalSoal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-600">Belum ada soal untuk tingkat {regLevelRaw || "-" }.</div>
      </div>
    );
  }

  const answeredCount = Object.keys(jawaban).length;
  const checked = current ? jawaban[current.id] : undefined;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-violet-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold">
            Ujian Akademik PPDB — NISN {nisn} • {regLevelRaw}
          </h1>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-sm" title="Sisa waktu">
              ⏳ {fmtRemain}
            </div>
            <button
              onClick={() => setShowNav(true)}
              className="rounded-full border border-white/60 text-white px-4 py-2 backdrop-blur hover:bg-white/10 text-sm"
              title="Lihat semua nomor soal"
            >
              Nomor Soal ({idx + 1}/{totalSoal})
            </button>
          </div>
        </div>
      </div>

      {/* Satu soal */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="text-sm text-slate-500 mb-1">
              Soal {idx + 1} dari {totalSoal}
            </div>
            <div className="font-semibold text-slate-800 mb-3">{current?.pertanyaan}</div>

            {current?.imageUrl ? (
              <div className="mb-4">
                <div className="w-full rounded-lg border bg-slate-50 flex justify-center p-4">
                  <img src={current.imageUrl} alt="" className="max-h-72 object-contain" />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {current?.opsi?.map((ops, i) => {
                const isChecked = checked === i;
                return (
                  <label
                    key={i}
                    className={[
                      "flex items-center gap-2 p-2 rounded-lg cursor-pointer",
                      isChecked ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name={`soal-${current?.id}`}
                      checked={isChecked || false}
                      onChange={() => pilih(current.id, i)}
                      disabled={locked}
                      className="accent-violet-600"
                    />
                    <span className="text-slate-700">{ops}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={prev}
                disabled={idx === 0 || locked}
                className="rounded-full border px-5 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                ← Sebelumnya
              </button>
              <div className="text-sm text-slate-500">
                Dijawab {answeredCount}/{totalSoal}
              </div>
              {idx < totalSoal - 1 ? (
                <button
                  onClick={next}
                  disabled={locked}
                  className="rounded-full bg-violet-700 text-white px-5 py-2 font-semibold shadow hover:bg-violet-800 disabled:opacity-50"
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  onClick={() => setAskFinish(true)}
                  disabled={locked}
                  className="rounded-full bg-violet-700 text-white px-5 py-2 font-semibold shadow hover:bg-violet-800 disabled:opacity-50"
                >
                  Selesai Ujian
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showNav && (
        <NavigatorModal
          open
          total={totalSoal}
          current={idx}
          answered={jawaban}
          ids={ids}
          onGoto={goto}
          onClose={() => setShowNav(false)}
        />
      )}

      {askFinish && (
        <ConfirmModal
          open
          onCancel={() => setAskFinish(false)}
          onConfirm={() => handleFinish(false)}
          title="Selesaikan Ujian?"
          message="Apakah Anda yakin ingin menyelesaikan ujian sekarang? Setelah menekan Selesai, Anda tidak akan bisa mengulang lagi."
          confirmText="Ya, Selesai"
          cancelText="Kembali"
        />
      )}

      {showResult && (
        <ResultModal
          open
          benar={score.benar}
          total={score.total}
          detail={score.detail}
          onClose={async () => {
            setShowResult(false);
            await writeCompletionAndExit(score);
          }}
        />
      )}
    </div>
  );
}
