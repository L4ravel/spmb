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

export function useNilaiTahfidzLogic() {
  // graderId now comes from auth (state), fallback null
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

  // state skor lokal per siswa
  const [rowsState, setRowsState] = useState({});
  const [saving, setSaving] = useState({});

  const pageOptions = useMemo(() => [10, 25, 50], []);

  /* ===== Auth: ambil akun yang login ===== */
  useEffect(() => {
    // fallback load dari localStorage seperti sebelumnya (untuk kasus tidak login)
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

  // sync localStorage only when user belum login
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (graderId) return;
    localStorage.setItem("tahfidz_examiner_name", examinerName || "");
  }, [examinerName, graderId]);

  /* ===== Prefetch semua jenjang (sekali) ===== */
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
      let last = null;
      const lvlSet = new Set(["ALL"]);
      while (true) {
        const snap = await getDocs(qLevels);
        if (snap.empty) break;
        snap.forEach((d) => {
          const lv = (d.data() || {}).registrationLevel;
          if (lv) lvlSet.add(lv);
        });
        if (snap.size < 200) break;
        last = snap.docs[snap.docs.length - 1];
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

  // Query builder untuk halaman tertentu
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

  // Fetch satu halaman
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

      // seed state baris (skor default 100)
      setRowsState((prev) => {
        const next = { ...prev };
        list.forEach((u) => {
          const nisn = getNisn(u);
          if (!next[nisn])
            next[nisn] = {
              score: 100,
              bigErrors: 0,
              smallErrors: 0,
              memorizedCount: 0,
              recommendation: "",
            };
        });
        return next;
      });

      setItems(list);
      setPageIndex(targetPageIndex);
      setHasNext(list.length === pageSize);

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

      const union = new Set(levels);
      list.forEach((u) => u.registrationLevel && union.add(u.registrationLevel));
      setLevels(Array.from(union));
    } catch (e) {
      console.error(e);
      setErrMsg(
        "Gagal memuat data siswa. Pastikan rules & index: (role, registrationPaymentStatus, username) serta (role, registrationPaymentStatus, registrationLevel, username)."
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

  function incErr(nisn, type) {
    setRowsState((prev) => {
      const row =
        prev[nisn] || {
          score: 100,
          bigErrors: 0,
          smallErrors: 0,
          memorizedCount: 0,
          recommendation: "",
        };
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
      const row =
        prev[nisn] || {
          score: 100,
          bigErrors: 0,
          smallErrors: 0,
          memorizedCount: 0,
          recommendation: "",
        };
      return { ...prev, [nisn]: { ...row, [key]: val } };
    });
  }

  async function saveRow(u) {
    const nisn = getNisn(u);
    try {
      if (!examinerName.trim()) {
        alert("Isi nama penguji terlebih dahulu.");
        return;
      }
      const s =
        rowsState[nisn] || {
          score: 100,
          bigErrors: 0,
          smallErrors: 0,
          memorizedCount: 0,
          recommendation: "",
        };

      if (!s.recommendation) {
        alert("Pilih rekomendasi (Lulus/Tidak Lulus) terlebih dahulu.");
        return;
      }

      setSaving((sv) => ({ ...sv, [nisn]: "saving" }));
      const ref = doc(db, SCORES_COLLECTION, String(nisn));
      await setDoc(
        ref,
        {
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
        },
        { merge: true }
      );
      setSaving((s0) => ({ ...s0, [nisn]: "saved" }));
      setTimeout(() => setSaving((s1) => ({ ...s1, [nisn]: "" })), 1200);
    } catch (e) {
      console.error(e);
      setSaving((s0) => ({ ...s0, [nisn]: "error" }));
      setTimeout(() => setSaving((s1) => ({ ...s1, [nisn]: "" })), 1500);
      alert("Gagal menyimpan nilai.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const nisn = String(getNisn(u)).toLowerCase();
      const nm = String(getName(u)).toLowerCase();
      return nisn.includes(q) || nm.includes(q);
    });
  }, [items, search]);

  const isLoggedIn = Boolean(graderId);

  return {
    // state & setter yang dipakai UI
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

    // handlers
    fetchPage, onNext, onPrev, incErr, setField, saveRow,

    // util untuk UI
    getNisn, getName,
  };
}
