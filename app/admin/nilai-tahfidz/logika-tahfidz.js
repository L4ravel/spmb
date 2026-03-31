"use client";

import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

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
const auth = getAuth(app);

/* ========= Konstanta koleksi ========= */
const USERS_COLLECTION = "users_app";
const SCORES_COLLECTION = "tahfidz_scores";

/* ========= Util ========= */
function getNisn(u) {
  return u.username || u.nisn || u.id || "";
}
function getName(u) {
  return u.fullName || u.fullname || u.displayName || u.name || "Tanpa Nama";
}
function emptyRow() {
  return {
    score: 100,
    bigErrors: 0,
    smallErrors: 0,
    memorizedCount: 0,
    recommendation: "",
  };
}
function rowFromSaved(d = {}) {
  return {
    score: Number(d.score ?? 100),
    bigErrors: Number(d.bigErrors ?? 0),
    smallErrors: Number(d.smallErrors ?? 0),
    memorizedCount: Number(d.memorizedCount ?? 0),
    recommendation: String(d.recommendation ?? ""),
  };
}

export function useNilaiTahfidzLogic() {
  // auth
  const [graderId, setGraderId] = useState("");

  // kontrol global
  const [pageSize, setPageSize] = useState(50);
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [deductBig, setDeductBig] = useState(5);
  const [deductSmall, setDeductSmall] = useState(2);
  const [examinerName, setExaminerName] = useState("");

  // data & paging
  const [items, setItems] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [anchors, setAnchors] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState(["ALL"]);
  const [errMsg, setErrMsg] = useState("");

  // state skor per siswa (yang ditampilkan/diubah user)
  const [rowsState, setRowsState] = useState({});
  const [saving, setSaving] = useState({});

  // ======= Global Search (lintas semua halaman) =======
  const [globalResults, setGlobalResults] = useState(null); // null = pakai paging normal
  const [qBusy, setQBusy] = useState(false);

  // ======= Cache nilai tersimpan =======
  // savedMap: { [nisn]: boolean }; savedDataMap: { [nisn]: docData }
  const [savedMap, setSavedMap] = useState({});
  const [savedDataMap, setSavedDataMap] = useState({});

  const pageOptions = useMemo(() => [10, 25, 50], []);

  /* ===== Auth ===== */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("tahfidz_examiner_name");
      if (v) setExaminerName(v);
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const display = user.displayName || user.email || user.uid || "";
        setExaminerName(display);
        setGraderId(user.uid || "");
      } else {
        setGraderId("");
        const v =
          typeof window !== "undefined"
            ? localStorage.getItem("tahfidz_examiner_name")
            : "";
        if (v) setExaminerName(v);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (graderId) return; // kalau login, tidak simpan ke LS
    localStorage.setItem("tahfidz_examiner_name", examinerName || "");
  }, [examinerName, graderId]);

  /* ===== Prefetch daftar jenjang ===== */
  async function loadLevels() {
    try {
      const colRef = collection(db, USERS_COLLECTION);
      let qLevels = query(
        colRef,
        where("role", "==", "siswa"),
        where("registrationPaymentStatus", "==", "verified"),
        orderBy("registrationLevel", "asc"),
        limit(200)
      );
      const lvlSet = new Set(["ALL"]);
      while (true) {
        const snap = await getDocs(qLevels);
        if (snap.empty) break;
        snap.forEach((d) => {
          const lv = (d.data() || {}).registrationLevel;
          if (lv) lvlSet.add(lv);
        });
        if (snap.size < 200) break;
        const last = snap.docs[snap.docs.length - 1];
        qLevels = query(
          colRef,
          where("role", "==", "siswa"),
          where("registrationPaymentStatus", "==", "verified"),
          orderBy("registrationLevel", "asc"),
          startAfter(last),
          limit(200)
        );
      }
      setLevels(Array.from(lvlSet));
    } catch (e) {
      console.warn("loadLevels failed:", e?.message);
    }
  }

  /* ===== Query paging ===== */
  function buildQuery(afterDoc = null) {
    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [
      where("role", "==", "siswa"),
      where("registrationPaymentStatus", "==", "verified"),
    ];
    if (levelFilter !== "ALL")
      clauses.push(where("registrationLevel", "==", levelFilter));
    let qBase = query(
      colRef,
      ...clauses,
      orderBy("username", "asc"),
      limit(pageSize)
    );
    if (afterDoc)
      qBase = query(
        colRef,
        ...clauses,
        orderBy("username", "asc"),
        startAfter(afterDoc),
        limit(pageSize)
      );
    return qBase;
  }

  /* ===== Fetch satu halaman ===== */
  async function fetchPage(targetPageIndex) {
    setLoading(true);
    setErrMsg("");
    try {
      const afterDoc =
        targetPageIndex === 0 ? null : anchors[targetPageIndex - 1] || null;
      const qBase = buildQuery(afterDoc);
      const snap = await getDocs(qBase);

      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }));

      // 1) Set data list & paging
      setItems(list);
      setPageIndex(targetPageIndex);
      setHasNext(list.length === pageSize);

      // 2) Anchor
      if (list.length > 0) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        setAnchors((prev) => {
          const clone = [...prev];
          clone[targetPageIndex] = lastDoc;
          return clone;
        });
      } else {
        setAnchors((prev) => prev.slice(0, targetPageIndex));
      }

      // 3) Prefill rowsState:
      //    - kalau ada nilai tersimpan -> set dari dokumen
      //    - kalau belum ada -> set default
      const newRows = {};
      for (const u of list) {
        const nisn = getNisn(u);
        const cached = savedDataMap[nisn];
        if (cached) {
          newRows[nisn] = rowFromSaved(cached);
        } else {
          newRows[nisn] = rowsState[nisn] ?? emptyRow();
        }
      }
      setRowsState((prev) => ({ ...newRows, ...prev })); // jangan hilangkan edit yang sedang berjalan

      // 4) Prefetch dokumen nilai untuk yang tampil (overwrite kalau ketemu)
      for (const u of list.slice(0, 100)) {
        const nisn = getNisn(u);
        if (nisn) {
          await ensureSavedAndLoad(nisn, u);
        }
      }

      // 5) lengkapi daftar level
      const union = new Set(levels);
      list.forEach((u) => u.registrationLevel && union.add(u.registrationLevel));
      setLevels(Array.from(union));
    } catch (e) {
      console.error(e);
      setErrMsg(
        "Gagal memuat data siswa. Pastikan index: (role, registrationPaymentStatus, username) & (role, registrationPaymentStatus, registrationLevel, username)."
      );
      setItems([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAnchors([]);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, pageSize]);

  function onNext() {
    if (!hasNext) return;
    fetchPage(pageIndex + 1);
  }
  function onPrev() {
    if (pageIndex === 0) return;
    fetchPage(pageIndex - 1);
  }

  /* ===== Edit helpers ===== */
  function incErr(nisn, type) {
    setRowsState((prev) => {
      const row = prev[nisn] || emptyRow();
      const delta =
        type === "big" ? Number(deductBig || 0) : Number(deductSmall || 0);
      const nextScore = Math.max(0, Number(row.score || 0) - delta);
      return {
        ...prev,
        [nisn]: {
          ...row,
          score: nextScore,
          bigErrors: row.bigErrors + (type === "big" ? 1 : 0),
          smallErrors: row.smallErrors + (type === "small" ? 1 : 0),
        },
      };
    });
  }

  function setField(nisn, key, val) {
    setRowsState((prev) => {
      const row = prev[nisn] || emptyRow();
      return { ...prev, [nisn]: { ...row, [key]: val } };
    });
  }

  /* ===== Simpan ===== */
  async function saveRow(u) {
    const nisn = getNisn(u);
    try {
      if (!examinerName.trim()) {
        alert("Isi nama penguji terlebih dahulu.");
        return;
      }
      const s = rowsState[nisn] || emptyRow();
      if (!s.recommendation) {
        alert("Pilih rekomendasi (Lulus/Tidak Lulus) terlebih dahulu.");
        return;
      }

      setSaving((sv) => ({ ...sv, [nisn]: "saving" }));
      const body = {
        nisn,
        name: getName(u),
        level: u.registrationLevel || "-",
        score: Number(s.score || 0),
        bigErrors: Number(s.bigErrors || 0),
        smallErrors: Number(s.smallErrors || 0),
        memorizedCount: Number(s.memorizedCount || 0),
        recommendation: s.recommendation,
        examinerName: examinerName.trim(),
        gradedBy: graderId || null,
        updatedAt: serverTimestamp(),
      };
      const ref = doc(db, SCORES_COLLECTION, String(nisn));
      await setDoc(ref, body, { merge: true });

      // tandai & cache nilai tersimpan
      setSaving((s0) => ({ ...s0, [nisn]: "saved" }));
      setSavedMap((m) => ({ ...m, [nisn]: true }));
      setSavedDataMap((m) => ({ ...m, [nisn]: { ...m[nisn], ...body, updatedAt: new Date() } }));
      // rowsState tetap; sudah sama dengan body
      setTimeout(() => setSaving((s1) => ({ ...s1, [nisn]: "" })), 1200);
    } catch (e) {
      console.error(e);
      setSaving((s0) => ({ ...s0, [nisn]: "error" }));
      setTimeout(() => setSaving((s1) => ({ ...s1, [nisn]: "" })), 1500);
      alert("Gagal menyimpan nilai.");
    }
  }

  /* ===== Global Search (lintas seluruh dataset terverifikasi) ===== */
  const filtered = useMemo(() => {
    const base = globalResults ?? items;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => {
      const nisn = String(getNisn(u)).toLowerCase();
      const nm = String(getName(u)).toLowerCase();
      return nisn.includes(q) || nm.includes(q);
    });
  }, [items, globalResults, search]);

  async function runGlobalSearch(qStr) {
    const qText = (qStr || "").trim().toLowerCase();
    if (!qText) {
      setGlobalResults(null);
      return;
    }

    setQBusy(true);
    try {
      const all = [];
      const SEARCH_BATCH = 400;
      const colRef = collection(db, USERS_COLLECTION);
      const clauses = [
        where("role", "==", "siswa"),
        where("registrationPaymentStatus", "==", "verified"),
      ];
      if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));

      let qRef = query(colRef, ...clauses, orderBy("username", "asc"), limit(SEARCH_BATCH));

      while (true) {
        const snap = await getDocs(qRef);
        if (snap.empty) break;

        const batchUsers = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

        const matched = batchUsers.filter((u) => {
          const nisn = String(getNisn(u)).toLowerCase();
          const nm = String(getName(u)).toLowerCase();
          return nisn.includes(qText) || nm.includes(qText);
        });

        // Push kandidat
        for (let i = 0; i < matched.length; i++) {
          const u = matched[i];
          all.push(u);
        }

        if (snap.size < SEARCH_BATCH) break;
        const last = snap.docs[snap.docs.length - 1];
        qRef = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(last), limit(SEARCH_BATCH));
      }

      setGlobalResults(all.slice(0, 2000));

      // Prefetch nilai tersimpan untuk hasil global (100 pertama biar irit)
      const pref = all.slice(0, 100);
      for (const u of pref) {
        const nisn = getNisn(u);
        await ensureSavedAndLoad(nisn, u);
      }

      // Setelah prefetch, isi rowsState dengan saved-data atau default utk yg belum ada
      setRowsState((prev) => {
        const next = { ...prev };
        for (const u of pref) {
          const nisn = getNisn(u);
          const saved = savedDataMap[nisn];
          if (!next[nisn]) {
            next[nisn] = saved ? rowFromSaved(saved) : emptyRow();
          }
        }
        return next;
      });
    } catch (e) {
      console.error("global search error:", e?.message);
      setGlobalResults([]);
    } finally {
      setQBusy(false);
    }
  }

  // Trigger Global Search (debounce)
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setGlobalResults(null);
      return;
    }
    if (q.length < 2) return;

    const t = setTimeout(() => {
      runGlobalSearch(q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, levelFilter]);

  /* ===== Prefetch & overwrite rows dari dokumen tersimpan ===== */
  async function ensureSavedAndLoad(nisn, userObj) {
    if (!nisn) return;
    // kalau sudah tahu tersimpan dan punya cache data, cukup apply rowsState dari cache
    const knownSaved = savedMap[nisn];
    const cached = savedDataMap[nisn];

    if (knownSaved && cached) {
      setRowsState((prev) => ({ ...prev, [nisn]: rowFromSaved(cached) }));
      return;
    }

    try {
      const ref = doc(db, SCORES_COLLECTION, String(nisn));
      const s = await getDoc(ref);
      const exists = s.exists();
      setSavedMap((m) => ({ ...m, [nisn]: exists }));

      if (exists) {
        const data = s.data() || {};
        // cache data & apply ke rowsState
        setSavedDataMap((m) => ({ ...m, [nisn]: data }));
        setRowsState((prev) => ({ ...prev, [nisn]: rowFromSaved(data) }));
        // optional: sync nama level bila kosong
        if (userObj && !userObj.registrationLevel && data.level) {
          // no-op UI; hanya dokumentatif
        }
      } else {
        // belum ada dokumen -> pastikan rows minimal ada default
        setRowsState((prev) => ({ ...prev, [nisn]: prev[nisn] ?? emptyRow() }));
      }
    } catch {
      // gagal cek -> jangan ganggu UI
      setRowsState((prev) => ({ ...prev, [nisn]: prev[nisn] ?? emptyRow() }));
    }
  }

  // Prefetch status & nilai untuk item yang terlihat (paging normal / hasil global)
  useEffect(() => {
    const base = globalResults ?? items;
    const slice = base.slice(0, 100);
    (async () => {
      for (const u of slice) {
        const nisn = getNisn(u);
        await ensureSavedAndLoad(nisn, u);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, globalResults]);

  const isLoggedIn = Boolean(graderId);

  return {
    // state & setter untuk UI
    graderId,
    pageSize, setPageSize,
    levelFilter, setLevelFilter,
    search, setSearch,
    deductBig, setDeductBig,
    deductSmall, setDeductSmall,
    examinerName, setExaminerName,

    items, pageIndex, hasNext, loading, levels, errMsg,
    rowsState, saving,

    pageOptions,
    filtered,
    isLoggedIn,

    // global search
    qBusy,

    // saved status & data
    savedMap,
    savedDataMap,

    // handlers
    fetchPage, onNext, onPrev, incErr, setField, saveRow,

    // utils
    getNisn, getName,
  };
}
