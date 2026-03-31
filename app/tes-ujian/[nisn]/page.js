"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock } from "lucide-react";

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
const DURATION_MS = 90 * 60 * 1000; // 90 menit
const LS_KEY = (nisn) => `examStart:${nisn}`;

const ANS_KEY = (nisn) => `examAns:${nisn}`;
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
  const [jawaban, setJawaban] = useState({});
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

  /* ========= Anti copy / security (UI) ========= */
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("no-copy");
    const onKeyDown = (e) => {
      const k = e.key?.toLowerCase?.();
      const mod = e.ctrlKey || e.metaKey;
      const blockCombo =
        (mod && ["c", "x", "v", "s", "p", "u", "a"].includes(k)) ||
        e.key === "F12";
      if (blockCombo) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    const onDragStart = (e) => { e.preventDefault(); };
    const onSelectStart = (e) => { e.preventDefault(); };
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("selectstart", onSelectStart, true);

    return () => {
      el.classList.remove("no-copy");
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("selectstart", onSelectStart, true);
    };
  }, []);

  const handleClipboardEvt = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

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
  }, [nisn, router]);

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
      if (r === 0) handleFinish(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { killed = true; clearInterval(id); };
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
  }, [allowed, regLevelSafe, nisn]);

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
      saveAnswerCloud(id, pilihanIdx, idx);
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
    return null;
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white"
           onCopy={handleClipboardEvt}
           onCut={handleClipboardEvt}
           onPaste={handleClipboardEvt}
           onContextMenu={handleContextMenu}>
        <div className="text-slate-600 animate-pulse">Memuat soal…</div>
        <style jsx global>{`
          .no-copy, .no-copy * {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
          }
          img, iframe { pointer-events: none; }
        `}</style>
      </div>
    );
  }
  if (!totalSoal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white"
           onCopy={handleClipboardEvt}
           onCut={handleClipboardEvt}
           onPaste={handleClipboardEvt}
           onContextMenu={handleContextMenu}>
        <div className="text-slate-600">Belum ada soal untuk tingkat {regLevelRaw || "-"}.</div>
        <style jsx global>{`
          .no-copy, .no-copy * {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
          }
          img, iframe { pointer-events: none; }
        `}</style>
      </div>
    );
  }

  const answeredCount = Object.keys(jawaban).length;
  const checked = current ? jawaban[current.id] : undefined;

  return (
    <div
      className="min-h-screen bg-gray-50"
      onCopy={handleClipboardEvt}
      onCut={handleClipboardEvt}
      onPaste={handleClipboardEvt}
      onContextMenu={handleContextMenu}
      onDragStart={handleClipboardEvt}
    >
      <style jsx global>{`
        .no-copy, .no-copy * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
        img, iframe { pointer-events: none; }
      `}</style>

      {/* Header - Responsive */}
      <div className="border-b-4 border-green-500 bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          {/* Mobile Layout */}
          <div className="block lg:hidden">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-sm font-bold text-gray-800">
                Ujian PPDB
              </h1>
              <div className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-mono border border-green-200">
                <Clock className="w-3 h-3" />
                {fmtRemain}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>NISN {nisn} • {regLevelRaw}</span>
              <button
                onClick={() => setShowNav(true)}
                className="text-green-600 font-medium hover:text-green-700"
              >
                Soal {idx + 1}/{totalSoal}
              </button>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                Ujian Akademik PPDB
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                NISN {nisn} • {regLevelRaw}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-mono text-sm border border-green-200">
                <Clock className="w-4 h-4" />
                {fmtRemain}
              </div>
              <button
                onClick={() => setShowNav(true)}
                className="text-sm px-3 py-1.5 rounded-lg border border-green-600 text-green-700 hover:bg-green-50 font-medium transition-colors"
              >
                Nomor Soal ({idx + 1}/{totalSoal})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="rounded-lg sm:rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-500 mb-2">
              Soal {idx + 1} dari {totalSoal}
            </div>
            <div className="font-semibold text-sm sm:text-base text-gray-800 mb-4">
              {current?.pertanyaan}
            </div>

            {current?.imageUrl ? (
              <div className="mb-4">
                <div className="w-full rounded-lg border bg-gray-50 flex justify-center p-3 sm:p-4">
                  <img 
                    src={current.imageUrl} 
                    alt="" 
                    className="max-h-48 sm:max-h-72 object-contain" 
                    draggable="false" 
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {current?.opsi?.map((ops, i) => {
                const isChecked = checked === i;

                const text =
                  typeof ops === "string"
                    ? ops
                    : (ops?.text ?? ops?.label ?? ops?.value ?? `Pilihan ${i + 1}`);

                const fromObj =
                  typeof ops === "object"
                    ? (ops.imageUrl || ops.imgUrl || ops.image || ops.img || ops.url || null)
                    : null;
                const fromArray =
                  Array.isArray(current?.opsiImages) ? (current.opsiImages[i] || null) : null;

                const optImg = fromObj || fromArray;

                return (
                  <label
                    key={i}
                    className={[
                      "flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg cursor-pointer transition-colors",
                      isChecked ? "bg-green-50 ring-1 ring-green-300" : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name={`soal-${current?.id}`}
                      checked={isChecked || false}
                      onChange={() => pilih(current.id, i)}
                      disabled={locked}
                      className="mt-0.5 sm:mt-1 accent-green-600 w-4 h-4"
                    />

                    <div className="flex-1">
                      <div className="text-sm sm:text-base text-gray-700">{text}</div>

                      {optImg ? (
                        <div className="mt-2">
                          <img
                            src={optImg}
                            alt={`opsi-${i + 1}`}
                            className="max-h-32 sm:max-h-40 rounded-md border border-gray-200 object-contain"
                            draggable="false"
                          />
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Navigation Buttons - Responsive */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={prev}
                disabled={idx === 0 || locked}
                className="w-full sm:w-auto text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Sebelumnya
              </button>
              
              <div className="text-xs sm:text-sm text-gray-500 order-first sm:order-none">
                Dijawab {answeredCount}/{totalSoal}
              </div>
              
              {idx < totalSoal - 1 ? (
                <button
                  onClick={next}
                  disabled={locked}
                  className="w-full sm:w-auto text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  onClick={() => setAskFinish(true)}
                  disabled={locked}
                  className="w-full sm:w-auto text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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