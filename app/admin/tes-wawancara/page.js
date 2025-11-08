// app/admin/tes-wawancara/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/* ========= Konstanta ========= */
const USERS_COLLECTION = "users_app";
// Default koleksi Paket 1 tetap sama agar kompatibel data lama:
const QCOLL_P1 = "interview_questions";
const QCOLL_P2 = "interview_questions_p2";
const SCORE_COLL = "interview_scores";
const PAGE_SIZE = 50; // maksimal 50 per halaman
const EXPORT_BATCH = 500; // batch ambil data saat export

/* ========= Util ========= */
function getNisn(u) {
  return u?.username || u?.nisn || u?.id || "";
}
function getName(u) {
  return u?.fullName || u?.fullname || u?.displayName || u?.name || "Tanpa Nama";
}
function normTo50(sum, max) {
  if (!max || max <= 0) return 0;
  return Math.round((sum / max) * 50 * 10) / 10;
}
function sortLevels(arr) {
  const rest = arr.filter((x) => x !== "ALL").sort((a, b) => String(a).localeCompare(String(b)));
  return ["ALL", ...rest];
}
const COLL_BY_PAKET = { p1: QCOLL_P1, p2: QCOLL_P2 };

export default function TesWawancaraPage() {
  /* ======= Filters ======= */
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | SELESAI
  const [sortMode, setSortMode] = useState("DEFAULT"); // DEFAULT | NILAI_TERTINGGI
  const [levels, setLevels] = useState(["ALL"]); // dropdown stabil

  /* ======= Data + paging ======= */
  const [items, setItems] = useState([]); // baris tabel (gabungan user + skor)
  const [pageIndex, setPageIndex] = useState(0);
  const [anchors, setAnchors] = useState([]); // last doc per page
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // skor cache (nisn -> doc data)
  const [scores, setScores] = useState({});

  /* ======= Modal State ======= */
  const [open, setOpen] = useState(false);
  const [examinerName, setExaminerName] = useState("");
  const [graderId, setGraderId] = useState(""); // ⬅️ uid penanya (akun login)
  const [currentStudent, setCurrentStudent] = useState(null);

  // Paket aktif dalam modal
  const [activePaket, setActivePaket] = useState("p1"); // "p1" | "p2"

  // Pertanyaan yang sedang aktif (tergantung paket)
  const [qsStudent, setQsStudent] = useState([]);
  const [qsParent, setQsParent] = useState([]);

  const [answers, setAnswers] = useState({ student: {}, parent: {} });
  const [saving, setSaving] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [globalResults, setGlobalResults] = useState(null); // null = pakai paging normal
  const [qBusy, setQBusy] = useState(false); // indikator loading pencarian global

  const viewItems = useMemo(() => {
    const base = globalResults ?? items; // jika ada hasil global, pakai itu
    const q = tableQuery.trim().toLowerCase();
    if (!q) return base;
    // jika globalResults ada, base sudah difilter; tetap aman untuk includes ringan
    return base.filter((r) => {
      const nisn = String(r.nisn || "").toLowerCase();
      const name = String(r.name || "").toLowerCase();
      return nisn.includes(q) || name.includes(q);
    });
  }, [items, globalResults, tableQuery]);

  const useScoresSource = statusFilter === "SELESAI" || sortMode === "NILAI_TERTINGGI";
  const isLoggedIn = Boolean(graderId);

  /* ======= Examiner from Auth (auto) + fallback localStorage ======= */
  useEffect(() => {
    // muat preferensi sebelumnya untuk non-login
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("tahfidz_examiner_name");
      if (v) setExaminerName(v);
      const p = localStorage.getItem("interview_active_paket");
      if (p === "p1" || p === "p2") setActivePaket(p);
    }

    // ambil dari akun login
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const display = user.displayName || user.email || user.uid || "";
        setExaminerName(display);
        setGraderId(user.uid || "");
      } else {
        setGraderId("");
        // keep localStorage value if any
        if (typeof window !== "undefined") {
          const v = localStorage.getItem("tahfidz_examiner_name");
          if (v) setExaminerName(v);
        }
      }
    });
    return () => unsub();
  }, []);

  // simpan ke localStorage hanya jika belum login (agar tidak override data akun)
  useEffect(() => {
    if (typeof window !== "undefined" && !isLoggedIn) {
      localStorage.setItem("tahfidz_examiner_name", examinerName || "");
    }
  }, [examinerName, isLoggedIn]);

  /* ======= Prefetch semua level (robust + fallback) ======= */
  useEffect(() => {
    (async () => {
      const setLv = new Set(["ALL"]);
      try {
        // 1) Dari users_app
        {
          const colRef = collection(db, USERS_COLLECTION);
          let qLv = query(colRef, where("role", "==", "siswa"), limit(200));
          while (true) {
            const snap = await getDocs(qLv);
            if (snap.empty) break;
            snap.forEach((d) => {
              const v = d.data()?.registrationLevel;
              if (v) setLv.add(v);
            });
            if (snap.size < 200) break;
            const last = snap.docs[snap.docs.length - 1];
            qLv = query(colRef, where("role", "==", "siswa"), startAfter(last), limit(200));
          }
        }
        // 2) Dari interview_scores
        {
          const colRef = collection(db, SCORE_COLL);
          let qLv2 = query(colRef, orderBy("level", "asc"), limit(200));
          while (true) {
            const snap = await getDocs(qLv2);
            if (snap.empty) break;
            snap.forEach((d) => {
              const v = d.data()?.level;
              if (v) setLv.add(v);
            });
            if (snap.size < 200) break;
            const last = snap.docs[snap.docs.length - 1];
            qLv2 = query(colRef, orderBy("level", "asc"), startAfter(last), limit(200));
          }
        }
      } catch (e) {
        console.warn("prefetch levels fail:", e?.message);
      } finally {
        setLevels(sortLevels(Array.from(setLv)));
      }
    })();
  }, []);

  /* ======= Query builder (dua sumber: USERS atau SCORES) ======= */
  function buildUsersQuery(afterDoc) {
    const colRef = collection(db, USERS_COLLECTION);
    const clauses = [where("role", "==", "siswa"), where("registrationPaymentStatus", "==", "verified")];
    if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));
    let qBase = query(colRef, ...clauses, orderBy("username", "asc"), limit(PAGE_SIZE));
    if (afterDoc) qBase = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(afterDoc), limit(PAGE_SIZE));
    return qBase;
  }

  function buildScoresQuery(afterDoc) {
    const colRef = collection(db, SCORE_COLL);
    const clauses = [];
    if (levelFilter !== "ALL") clauses.push(where("level", "==", levelFilter));
    // sort
    let qBase = null;
    if (sortMode === "NILAI_TERTINGGI") {
      qBase = query(colRef, ...clauses, orderBy("total100", "desc"), orderBy("nisn", "asc"), limit(PAGE_SIZE));
      if (afterDoc) {
        qBase = query(
          colRef,
          ...clauses,
          orderBy("total100", "desc"),
          orderBy("nisn", "asc"),
          startAfter(afterDoc),
          limit(PAGE_SIZE)
        );
      }
    } else {
      // default urut nisn asc
      qBase = query(colRef, ...clauses, orderBy("nisn", "asc"), limit(PAGE_SIZE));
      if (afterDoc) {
        qBase = query(colRef, ...clauses, orderBy("nisn", "asc"), startAfter(afterDoc), limit(PAGE_SIZE));
      }
    }
    return qBase;
  }

  /* ======= Fetch satu halaman ======= */
  async function fetchPage(targetIndex) {
    setLoading(true);
    setErrMsg("");
    try {
      const afterDoc = targetIndex === 0 ? null : anchors[targetIndex - 1] || null;

      if (useScoresSource) {
        // ambil dari interview_scores, lalu filter hanya user verified
        const qBase = buildScoresQuery(afterDoc);
        const snap = await getDocs(qBase);
        const list = [];
        snap.forEach((d) => list.push({ scoreDoc: d.data(), snap: d }));

        // cek status verified per nisn (users_app/{nisn})
        const verifiedFlags = {};
        await Promise.all(
          list.map(async (x) => {
            const nisn = String(x.scoreDoc.nisn || "");
            if (!nisn) return;
            const u = await getDoc(doc(db, USERS_COLLECTION, nisn));
            if (u.exists() && u.data()?.registrationPaymentStatus === "verified") {
              verifiedFlags[nisn] = true;
            }
          })
        );

        const filtered = list.filter((x) => verifiedFlags[String(x.scoreDoc.nisn || "")]);
        const rows = filtered.map((x, i) => ({
          no: targetIndex * PAGE_SIZE + (i + 1),
          nisn: x.scoreDoc.nisn,
          name: x.scoreDoc.name,
          level: x.scoreDoc.level || "-",
          examiner: x.scoreDoc.examinerName || "-",
          score: x.scoreDoc.total100 ?? null,
          done: true,
          user: null,
        }));
        setItems(rows);

        // cache skor
        setScores((prev) => {
          const copy = { ...prev };
          filtered.forEach((x) => (copy[x.scoreDoc.nisn] = x.scoreDoc));
          return copy;
        });

        if (rows.length) {
          const lastDoc = filtered.length
            ? snap.docs[list.indexOf(filtered[filtered.length - 1])]
            : snap.docs[snap.docs.length - 1];
          if (lastDoc) {
            setAnchors((prev) => {
              const c = [...prev];
              c[targetIndex] = lastDoc;
              return c;
            });
          }
        }
        setHasNext(snap.size === PAGE_SIZE);

        // union levels
        if (rows.length) {
          const union = new Set(levels);
          rows.forEach((r) => r.level && union.add(r.level));
          setLevels(sortLevels(Array.from(union)));
        }

        setPageIndex(targetIndex);
      } else {
        // ambil dari users_app (verified)
        const qBase = buildUsersQuery(afterDoc);
        const snap = await getDocs(qBase);
        const users = [];
        snap.forEach((d) => users.push({ id: d.id, ...(d.data() || {}) }));

        // prefetch skor untuk NISN di halaman ini
        const map = {};
        await Promise.all(
          users.map(async (u) => {
            const nisn = getNisn(u);
            if (!nisn) return;
            const sc = await getDoc(doc(db, SCORE_COLL, String(nisn)));
            if (sc.exists()) map[nisn] = sc.data();
          })
        );
        setScores((prev) => ({ ...prev, ...map }));

        const rows = users.map((u, i) => {
          const nisn = getNisn(u);
          const sc = map[nisn];
          return {
            no: targetIndex * PAGE_SIZE + (i + 1),
            nisn,
            name: getName(u),
            level: u.registrationLevel || "-",
            examiner: sc?.examinerName || "-",
            score: sc ? sc.total100 : null,
            done: !!sc,
            user: u,
          };
        });
        setItems(rows);

        setHasNext(users.length === PAGE_SIZE);
        if (users.length > 0) {
          const lastDoc = snap.docs[snap.docs.length - 1];
          setAnchors((prev) => {
            const c = [...prev];
            c[targetIndex] = lastDoc;
            return c;
          });
        }
        setPageIndex(targetIndex);

        // union levels dari halaman aktif
        if (rows.length) {
          const union = new Set(levels);
          rows.forEach((r) => r.level && union.add(r.level));
          setLevels(sortLevels(Array.from(union)));
        }
      }
    } catch (e) {
      console.error(e);
      setErrMsg("Gagal memuat data. Pastikan index: users(role↑,username↑) & scores(index sesuai urutan) ada.");
      setItems([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  async function runGlobalSearch(qStr) {
    const q = (qStr || "").trim().toLowerCase();
    if (!q) { setGlobalResults(null); return; }

    setQBusy(true);
    try {
      const all = [];
      const colRef = collection(db, USERS_COLLECTION);
      const clauses = [where("role", "==", "siswa"), where("registrationPaymentStatus", "==", "verified")];
      if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));

      let qRef = query(colRef, ...clauses, orderBy("username", "asc"), limit(EXPORT_BATCH));
      // loop pagination
      while (true) {
        const snap = await getDocs(qRef);
        if (snap.empty) break;

        // filter nama/nisn di batch ini lebih dulu (hemat join skor)
        const batchUsers = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        const matched = batchUsers.filter((u) => {
          const nisn = String(u?.username || u?.nisn || u?.id || "").toLowerCase();
          const name = String(u?.fullName || u?.fullname || u?.displayName || u?.name || "").toLowerCase();
          return nisn.includes(q) || name.includes(q);
        });

        // join skor hanya untuk yang match
        for (let i = 0; i < matched.length; i++) {
          const u = matched[i];
          const nisn = String(u?.username || u?.nisn || u?.id || "");
          let sc = null;
          try {
            const scDoc = await getDoc(doc(db, SCORE_COLL, String(nisn)));
            sc = scDoc.exists() ? scDoc.data() : null;
          } catch {}
          all.push({
            no: all.length + 1,
            nisn,
            name: String(u?.fullName || u?.fullname || u?.displayName || u?.name || "Tanpa Nama"),
            level: u?.registrationLevel || "-",
            examiner: sc?.examinerName || "-",
            score: sc ? sc.total100 : null,
            done: !!sc,
            user: u,
          });
        }

        if (snap.size < EXPORT_BATCH) break;
        const last = snap.docs[snap.docs.length - 1];
        qRef = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(last), limit(EXPORT_BATCH));
      }

      // batasi tampilan besar agar tetap ringan; data export tetap tersedia dari tombol export
      setGlobalResults(all.slice(0, 2000)); 
    } catch (e) {
      console.error("global search error:", e?.message);
      setGlobalResults([]); // tampilkan kosong daripada nge-freeze
    } finally {
      setQBusy(false);
    }
  }

  // load awal + reset saat filter berubah
  useEffect(() => {
    setAnchors([]);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, statusFilter, sortMode]);

  useEffect(() => {
    const q = tableQuery.trim();
    // jika kosong -> kembali ke mode paging biasa
    if (!q) {
      setGlobalResults(null);
      return;
    }
    // minimal 2 huruf untuk menahan noise
    if (q.length < 2) return;

    const t = setTimeout(() => {
      runGlobalSearch(q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableQuery, levelFilter]); // hormati filter jenjang saat cari global

  function onPrev() {
    if (pageIndex === 0 || loading) return;
    fetchPage(pageIndex - 1);
  }
  function onNext() {
    if (!hasNext || loading) return;
    fetchPage(pageIndex + 1);
  }
  
  async function fetchUserByNisn(nisn) {
    try {
      const s = await getDoc(doc(db, USERS_COLLECTION, String(nisn)));
      return s.exists() ? { id: s.id, ...(s.data() || {}) } : null;
    } catch {
      return null;
    }
  }

  /* ======= Loader pertanyaan per paket ======= */
  async function loadQuestions(paketKey = "p1") {
    const coll = COLL_BY_PAKET[paketKey] || QCOLL_P1;
    try {
      const s = await getDoc(doc(db, coll, "student"));
      const p = await getDoc(doc(db, coll, "parent"));
      setQsStudent(Array.isArray(s.data()?.questions) ? s.data().questions : []);
      setQsParent(Array.isArray(p.data()?.questions) ? p.data().questions : []);
    } catch (e) {
      console.warn("Gagal memuat pertanyaan:", e?.message);
      setQsStudent([]);
      setQsParent([]);
    }
  }

  /* ======= Mulai tes (open modal) — PREFILL jawaban tersimpan ======= */
  async function startTestFromRow(row) {
    // Pastikan kita punya objek user (baris dari sumber 'scores' tidak punya r.user)
    let userObj = row.user;
    if (!userObj) {
      userObj = await fetchUserByNisn(row.nisn);
      if (!userObj) {
        alert("Data siswa tidak ditemukan.");
        return;
      }
    }
    setCurrentStudent(userObj);

    // Ambil skor tersimpan dari cache; kalau belum ada, fetch 1x
    const nisn = getNisn(userObj);
    let saved = scores[nisn];
    if (!saved) {
      try {
        const snap = await getDoc(doc(db, SCORE_COLL, String(nisn)));
        saved = snap.exists() ? snap.data() : null;
        if (saved) setScores((prev) => ({ ...prev, [nisn]: saved }));
      } catch {}
    }

    // Tentukan paket awal:
    // - Jika ada paket tersimpan: pakai itu
    // - Jika tidak ada: pakai preferensi localStorage (default p1)
    let defaultP =
      (typeof window !== "undefined" && localStorage.getItem("interview_active_paket")) || "p1";
    const initialPaket =
      saved?.paket === "p1" || saved?.paket === "p2" ? saved.paket : defaultP === "p2" ? "p2" : "p1";

    setActivePaket(initialPaket);
    await loadQuestions(initialPaket);

    // Prefill jawaban jika ada tersimpan
    if (saved?.answers && typeof saved.answers === "object") {
      setAnswers({
        student: { ...(saved.answers.student || {}) },
        parent: { ...(saved.answers.parent || {}) },
      });
    } else {
      // Jika belum pernah isi -> kosong
      setAnswers({ student: {}, parent: {} });
    }

    setOpen(true);
  }

  /* ======= Ganti Paket di modal ======= */
  async function onChangePaket(p) {
    if (p !== "p1" && p !== "p2") return;
    setActivePaket(p);
    if (typeof window !== "undefined") localStorage.setItem("interview_active_paket", p);
    // Saat ganti paket, kosongkan jawaban agar tidak tercampur (kita simpan satu paket pada summary)
    setAnswers({ student: {}, parent: {} });
    await loadQuestions(p);
  }

  /* ======= Hitung & Simpan ======= */
  async function submitTest() {
    if (!currentStudent) return;
    if (!examinerName.trim()) {
      alert("Isi nama penanya terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      // hitung student
      let sumS = 0, maxS = 0;
      qsStudent.forEach((q) => {
        const chosen = q.options?.find((o) => o.key === answers.student[q.id]);
        const pts = Number(chosen?.points || 0);
        sumS += pts;
        const qMax = Math.max(0, ...(q.options || []).map((o) => Number(o.points || 0)));
        maxS += qMax;
      });
      // hitung parent
      let sumP = 0, maxP = 0;
      qsParent.forEach((q) => {
        const chosen = q.options?.find((o) => o.key === answers.parent[q.id]);
        const pts = Number(chosen?.points || 0);
        sumP += pts;
        const qMax = Math.max(0, ...(q.options || []).map((o) => Number(o.points || 0)));
        maxP += qMax;
      });

      const scoreStudent50 = normTo50(sumS, maxS);
      const scoreParent50 = normTo50(sumP, maxP);
      const total100 = Math.round((scoreStudent50 + scoreParent50) * 10) / 10;

      const nisn = getNisn(currentStudent);
      const payload = {
        nisn,
        name: getName(currentStudent),
        level: currentStudent.registrationLevel || "-",
        paket: activePaket, // metadata paket
        answers: { student: answers.student, parent: answers.parent },
        sumStudent: sumS,
        maxStudent: maxS,
        scoreStudent50,
        sumParent: sumP,
        maxParent: maxP,
        scoreParent50,
        total100,
        examinerName: examinerName.trim(),
        gradedBy: graderId || null, // ⬅️ simpan uid akun login
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, SCORE_COLL, String(nisn)), payload, { merge: true });
      setScores((prev) => ({ ...prev, [nisn]: payload }));

      // Update baris tabel saat ini
      setItems((prev) =>
        prev.map((r) =>
          r.nisn === nisn ? { ...r, score: payload.total100, examiner: payload.examinerName, done: true } : r
        )
      );
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan hasil wawancara.");
    } finally {
      setSaving(false);
    }
  }

  /* ======= Export XLS (tampilan saat ini) — tetap ada ======= */
  function exportXLS() {
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const cols = ["No", "NISN", "Nama", "Jenjang", "Penguji", "Nilai", "Status"];
    const headerRow = `<tr>${cols
      .map((c) => `<th style="background:#f1f5f9;text-align:left">${esc(c)}</th>`)
      .join("")}</tr>`;
    const rows = viewItems
      .map((r) => {
        const tds = [
          `<td>${esc(r.no)}</td>`,
          `<td style="mso-number-format:'\\@'">${esc(r.nisn)}</td>`,
          `<td>${esc(r.name)}</td>`,
          `<td>${esc(r.level)}</td>`,
          `<td>${esc(r.examiner ?? "-")}</td>`,
          `<td>${r.score != null ? esc(r.score) : "-"}</td>`,
          `<td>${r.done ? "Selesai" : "Belum"}</td>`,
        ];
        return `<tr>${tds.join("")}</tr>`;
      })
      .join("");
    const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head>
<body>
  <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">
    ${headerRow}
    ${rows}
  </table>
</body>
</html>`.trim();

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `tes-wawancara-TAMPILAN-${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ======= Export XLS (SEMUA sesuai jenjang) ======= */
  async function exportAllByJenjang() {
    // Barometer hanya jenjang: abaikan pencarian/status/sort/paging.
    // Ambil semua siswa "verified" dari users_app (role=siswa),
    // filter berdasarkan levelFilter (ALL = semua).
    setExporting(true);
    try {
      const esc = (s) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const cols = ["No", "NISN", "Nama", "Jenjang", "Penguji", "Nilai", "Status"];
      const headerRow = `<tr>${cols
        .map((c) => `<th style="background:#f1f5f9;text-align:left">${esc(c)}</th>`)
        .join("")}</tr>`;

      // Kumpulkan semua user sesuai jenjang
      const allRows = [];
      const colRef = collection(db, USERS_COLLECTION);
      const clauses = [where("role", "==", "siswa"), where("registrationPaymentStatus", "==", "verified")];
      if (levelFilter !== "ALL") clauses.push(where("registrationLevel", "==", levelFilter));

      let qRef = query(colRef, ...clauses, orderBy("username", "asc"), limit(EXPORT_BATCH));
      let page = 0;
      let total = 0;

      // Loop pagination sampai habis
      while (true) {
        const snap = await getDocs(qRef);
        if (snap.empty) break;

        // Buat rows dengan join skor per NISN (getDoc per item — sederhana & aman)
        const batchUsers = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        for (let i = 0; i < batchUsers.length; i++) {
          const u = batchUsers[i];
          const nisn = getNisn(u);
          const scDoc = await getDoc(doc(db, SCORE_COLL, String(nisn)));
          const sc = scDoc.exists() ? scDoc.data() : null;

          total += 1;
          allRows.push({
            no: total,
            nisn,
            name: getName(u),
            level: u.registrationLevel || "-",
            examiner: sc?.examinerName || "-",
            score: sc ? sc.total100 : null,
            done: !!sc,
          });
        }

        if (snap.size < EXPORT_BATCH) break; // sudah habis
        const last = snap.docs[snap.docs.length - 1];
        qRef = query(colRef, ...clauses, orderBy("username", "asc"), startAfter(last), limit(EXPORT_BATCH));
        page += 1;
      }

      // Render ke HTML tabel
      const bodyRows = allRows
        .map((r) => {
          const tds = [
            `<td>${esc(r.no)}</td>`,
            `<td style="mso-number-format:'\\@'">${esc(r.nisn)}</td>`,
            `<td>${esc(r.name)}</td>`,
            `<td>${esc(r.level)}</td>`,
            `<td>${esc(r.examiner ?? "-")}</td>`,
            `<td>${r.score != null ? esc(r.score) : "-"}</td>`,
            `<td>${r.done ? "Selesai" : "Belum"}</td>`,
          ];
          return `<tr>${tds.join("")}</tr>`;
        })
        .join("");

      const note = `<caption style="caption-side:top;margin-bottom:8px;font-weight:bold">
        Export Tes Wawancara — Jenjang: ${esc(levelFilter)} — Total Baris: ${allRows.length}
      </caption>`;

      const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head>
<body>
  <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">
    ${note}
    ${headerRow}
    ${bodyRows}
  </table>
</body>
</html>`.trim();

      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const jenjangSlug = levelFilter === "ALL" ? "SEMUA" : String(levelFilter).replace(/\s+/g, "_").toUpperCase();
      a.href = url;
      a.download = `tes-wawancara-${jenjangSlug}-${stamp}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal export data. Periksa koneksi & izin baca koleksi.");
    } finally {
      setExporting(false);
    }
  }

  /* ======= Render ======= */
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 w-full px-4 md:px-6 lg:px-8 py-8">
        {/* Header + meta (match Tahfidz) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Tes Wawancara</h1>
            <p className="text-sm text-slate-600 mt-1">
              Filter berdasarkan jenjang & status. Urutkan nilai tertinggi untuk melihat ranking.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white shadow-sm border border-slate-200">
            <div className="text-xs text-slate-600">
              Halaman <span className="font-bold text-slate-800">{pageIndex + 1}</span>
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            <div className="text-xs text-slate-600">
              Baris <span className="font-bold text-slate-800">{viewItems.length}</span> / {PAGE_SIZE}
            </div>
          </div>
        </div>

        {errMsg && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {errMsg}
          </div>
        )}

        {/* Toolbar (match Tahfidz card) */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {/* Filter & Pencarian */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Filter & Pencarian</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="flex-1 min-w-[120px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                title="Filter jenjang"
              >
                {levels.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 min-w-[120px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                title="Filter status"
              >
                <option value="ALL">Semua Status</option>
                <option value="SELESAI">Selesai saja</option>
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="flex-1 min-w-[120px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                title="Urutkan"
              >
                <option value="DEFAULT">Urut NISN</option>
                <option value="NILAI_TERTINGGI">Nilai tertinggi</option>
              </select>

              <button
                onClick={() => fetchPage(0)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                title="Muat ulang halaman pertama"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Cari NISN / Nama…"
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
              />
            </div>
          </div>

          {/* Export */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h6M4 12a8 8 0 108 8" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Export</h3>
            </div>
            <div className="grid gap-2">
              <button
                onClick={exportXLS}
                className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 active:scale-95 shadow-lg shadow-green-200 transition-all"
                title="Export baris tampilan saat ini (terfilter/paging)"
              >
                ⬇️ Download TAMPILAN
              </button>
              <button
                onClick={exportAllByJenjang}
                disabled={exporting}
                className="w-full rounded-xl border border-green-600 text-black px-4 py-2.5 text-sm font-semibold hover:bg-green-50 active:scale-95 transition-all disabled:opacity-50"
                title="Export SEMUA data berdasarkan jenjang (abaikan paging & pencarian)"
              >
                {exporting ? "⏳ Menyiapkan semua data…" : "⬇️ Download Semua"}
              </button>
            </div>
          </div>

          {/* Identitas Penanya */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Nama Penanya</h3>
            </div>
            <input
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              placeholder="cth: Ust. Ahmad / Ustd. Fatimah"
              className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all ${isLoggedIn ? "bg-slate-50" : ""}`}
              readOnly={isLoggedIn}
              title={isLoggedIn ? "Terisi otomatis dari akun login" : "Bisa diisi jika belum login"}
            />
          </div>
        </div>

        {/* ======= View: Mobile Cards (<md) ======= */}
        <div className="space-y-4 md:hidden">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="h-6 w-1/3 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-4 h-24 w-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          )}
          {!loading && viewItems.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">Tidak ada data.</p>
            </div>
          )}
          {!loading &&
            viewItems.map((r) => (
              <div
                key={`${r.nisn}-${r.no}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-100/70 hover:shadow-xl hover:shadow-slate-200/70 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-white text-sm font-bold mb-2">
                      {r.no}
                    </div>
                    <div className="font-bold text-lg text-slate-900">{r.name}</div>
                    <div className="font-mono text-sm text-slate-700 font-medium">{r.nisn}</div>
                    <div className="inline-block mt-1 px-2 py-1 rounded-lg bg-slate-100 text-xs text-slate-700 font-medium">
                      {r.level || "-"}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <button
                      onClick={() => startTestFromRow(r)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold text-white active:scale-95 shadow-lg transition-all
      ${r.done ? "bg-violet-600 hover:bg-violet-700 shadow-violet-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"}`}
                      title={r.done ? "Ulangi Tes" : "Mulai Tes"}
                    >
                      {r.done ? "Ulangi Tes" : "Mulai Tes"}
                    </button>
                  </div>

                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500">Penguji</div>
                  <div className="text-right">{r.examiner ?? "-"}</div>
                  <div className="text-slate-500">Nilai</div>
                  <div className="text-right font-semibold">{r.score != null ? r.score : "-"}</div>
                </div>
              </div>
            ))}
        </div>

        {/* ======= View: Desktop Table (md+) ======= */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100/70">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-sm text-black">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="px-4 py-4 text-left font-bold w-16">No</th>
                    <th className="px-4 py-4 text-left font-bold">NISN</th>
                    <th className="px-4 py-4 text-left font-bold">Nama</th>
                    <th className="px-4 py-4 text-left font-bold">Jenjang</th>
                    <th className="px-4 py-4 text-left font-bold">Penguji</th>
                    <th className="px-4 py-4 text-left font-bold w-40">Mulai Tes</th>
                    <th className="px-4 py-4 text-left font-bold">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8">
                        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    viewItems.map((r) => (
                      <tr key={`${r.nisn}-${r.no}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 text-white text-sm font-bold flex items-center justify-center">
                            {r.no}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-700 font-semibold">{r.nisn}</td>
                        <td className="px-4 py-4 text-slate-900 font-medium">{r.name}</td>
                        <td className="px-4 py-4">
                          <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs">
                            {r.level || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-4">{r.examiner ?? "-"}</td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => startTestFromRow(r)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white active:scale-95 shadow-lg transition-all
      ${r.done ? "bg-violet-600 hover:bg-violet-700 shadow-violet-200" : "bg-green-600 hover:bg-green-700 shadow-blue-200"}`}
                            title={r.done ? "Ulangi Tes" : "Mulai Tes"}
                          >
                            {r.done ? "Ulangi Tes" : "Mulai Tes"}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-semibold">{r.score != null ? r.score : "-"}</td>
                      </tr>
                    ))}

                  {!loading && viewItems.length === 0 && (
                    <tr>
                      <td className="px-4 py-12 text-center" colSpan={7}>
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2" />
                          </svg>
                        </div>
                        <p className="text-slate-600 font-medium">Tidak ada data.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pager */}
        <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-600">Halaman</span>
            <span className="font-bold text-slate-800">{pageIndex + 1}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onPrev}
              disabled={pageIndex === 0 || loading}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
            >
              ⟵ Sebelumnya
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext || loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-blue-200"
            >
              Berikutnya ⟶
            </button>
          </div>
        </div>
      </main>

      {/* ===== Modal Tes (match Tahfidz style) ===== */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-2 sm:p-4">
            <div className="mt-0 sm:mt-10 w-full max-w-none sm:max-w-4xl rounded-none sm:rounded-2xl bg-white shadow-xl ring-1 ring-black/5 h-[100dvh] sm:h-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Tes Wawancara — {currentStudent ? getName(currentStudent) : ""}
                </h3>

                {/* Paket Switcher: biru, netral */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onChangePaket("p1")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      activePaket === "p1" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
                    }`}
                    title="Gunakan Paket 1"
                  >
                    Paket 1
                  </button>
                  <button
                    onClick={() => onChangePaket("p2")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      activePaket === "p2" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
                    }`}
                    title="Gunakan Paket 2"
                  >
                    Paket 2
                  </button>

                  {/* Tombol Tutup (tetap) */}
                  <button
                    onClick={() => setOpen(false)}
                    className="ml-2 rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                  >
                    Tutup
                  </button>

                  {/* === Tambahan khusus MOBILE: Simpan di sebelah Tutup === */}
                  <button
                    onClick={submitTest}
                    disabled={saving}
                    className="sm:hidden ml-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-emerald-700 active:scale-95"
                    title="Selesai & Simpan"
                  >
                    {saving ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </div>

              <div className="px-5 py-4 max-h[calc(100dvh-8rem)] sm:max-h-none overflow-y-auto">
                <div className="mb-3 text-xs text-slate-600">
                  Paket aktif: <span className="font-semibold">{activePaket === "p1" ? "Paket 1" : "Paket 2"}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Murid */}
                  <section className="rounded-xl border border-slate-200">
                    <div className="border-b px-4 py-3 text-sm font-semibold text-black">Murid</div>
                    <div className="p-4">
                      {qsStudent.length === 0 && (
                        <div className="text-xs text-slate-500">Belum ada pertanyaan.</div>
                      )}
                      <div className="space-y-4">
                        {qsStudent.map((q, idx) => (
                          <div key={q.id} className="rounded-lg border border-slate-200 p-3 text-black">
                            <div className="mb-2 text-sm font-medium ">
                              {idx + 1}. {q.text || <span className="italic text-slate-400">[pertanyaan]</span>}
                            </div>
                            <div className="space-y-1">
                              {(q.options || []).map((op) => (
                                <label key={op.key} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`S-${q.id}`}
                                    value={op.key}
                                    checked={answers.student[q.id] === op.key}
                                    onChange={(e) =>
                                      setAnswers((prev) => ({
                                        ...prev,
                                        student: { ...prev.student, [q.id]: e.target.value },
                                      }))
                                    }
                                    className="h-4 w-4"
                                  />
                                  <span>{op.text || <span className="italic text-slate-400">[opsi]</span>}</span>
                                  <span className="text-xs text-slate-500">({op.points} poin)</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Orang Tua */}
                  <section className="rounded-xl border border-slate-200">
                    <div className="border-b px-4 py-3 text-sm font-semibold text-black">Orang Tua</div>
                    <div className="p-4">
                      {qsParent.length === 0 && (
                        <div className="text-xs text-slate-500 text-black">Belum ada pertanyaan.</div>
                      )}
                      <div className="space-y-4">
                        {qsParent.map((q, idx) => (
                          <div key={q.id} className="rounded-lg border border-slate-200 p-3 text-black">
                            <div className="mb-2 text-sm font-medium">
                              {idx + 1}. {q.text || <span className="italic text-slate-400">[pertanyaan]</span>}
                            </div>
                            <div className="space-y-1">
                              {(q.options || []).map((op) => (
                                <label key={op.key} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`P-${q.id}`}
                                    value={op.key}
                                    checked={answers.parent[q.id] === op.key}
                                    onChange={(e) =>
                                      setAnswers((prev) => ({
                                        ...prev,
                                        parent: { ...prev.parent, [q.id]: e.target.value },
                                      }))
                                    }
                                    className="h-4 w-4"
                                  />
                                  <span>{op.text || <span className="italic text-slate-400">[opsi]</span>}</span>
                                  <span className="text-xs text-slate-500">({op.points} poin)</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                {/* Penanya (auto dari login) */}
                <div className="mt-4 rounded-xl border border-slate-200 p-4 text-black">
                  <label className="text-sm">
                    <span className="text-slate-700">Nama Penanya</span>
                    <input
                      value={examinerName}
                      onChange={(e) => setExaminerName(e.target.value)}
                      placeholder="cth: Ust. Ahmad / Ustd. Fatimah"
                      className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm ${isLoggedIn ? "bg-slate-50" : ""}`}
                      readOnly={isLoggedIn}
                      title={isLoggedIn ? "Terisi otomatis dari akun login" : "Bisa diisi jika belum login"}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  onClick={submitTest}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  {saving ? "Menyimpan…" : "Selesai & Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
