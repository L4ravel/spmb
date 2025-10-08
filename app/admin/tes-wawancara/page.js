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

/* ========= Konstanta ========= */
const USERS_COLLECTION = "users_app";
const QCOLL = "interview_questions";
const SCORE_COLL = "interview_scores";
const PAGE_SIZE = 50; // maksimal 50 per halaman

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
  const [currentStudent, setCurrentStudent] = useState(null);
  const [qsStudent, setQsStudent] = useState([]);
  const [qsParent, setQsParent] = useState([]);
  const [answers, setAnswers] = useState({ student: {}, parent: {} });
  const [saving, setSaving] = useState(false);
  const [tableQuery, setTableQuery] = useState("");

  const viewItems = useMemo(() => {
  const q = tableQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter((r) => {
    const nisn = String(r.nisn || "").toLowerCase();
    const name = String(r.name || "").toLowerCase();
    return nisn.includes(q) || name.includes(q);
  });
}, [items, tableQuery]);

  /* ======= Persist examiner name ======= */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("tahfidz_examiner_name");
      if (v) setExaminerName(v);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tahfidz_examiner_name", examinerName || "");
    }
  }, [examinerName]);

  /* ======= Load pertanyaan sekali ======= */
  useEffect(() => {
    (async () => {
      try {
        const s = await getDoc(doc(db, QCOLL, "student"));
        const p = await getDoc(doc(db, QCOLL, "parent"));
        setQsStudent(Array.isArray(s.data()?.questions) ? s.data().questions : []);
        setQsParent(Array.isArray(p.data()?.questions) ? p.data().questions : []);
      } catch (e) {
        console.warn("Gagal memuat pertanyaan wawancara:", e?.message);
      }
    })();
  }, []);

  /* ======= Prefetch semua level (robust + fallback) ======= */
  useEffect(() => {
    (async () => {
      const setLv = new Set(["ALL"]);
      try {
        // 1) Dari users_app (tanpa orderBy registrationLevel untuk hindari kebutuhan index)
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
        // 2) Dari interview_scores (single-field orderBy biasanya aman)
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
  const useScoresSource = statusFilter === "SELESAI" || sortMode === "NILAI_TERTINGGI";

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

        // cache skor + union level dari halaman ini (jaga dropdown tetap terisi)
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
        // next page?
        setHasNext(snap.size === PAGE_SIZE);

        // union levels dari halaman aktif (fallback jika prefetch gagal)
        if (rows.length) {
          const union = new Set(levels);
          rows.forEach((r) => r.level && union.add(r.level));
          setLevels(sortLevels(Array.from(union)));
        }

        setPageIndex(targetIndex);
      } else {
        // ambil dari users_app (langsung hanya verified via where)
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

        // union levels dari halaman aktif (jaga dropdown tetap terisi)
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

  // load awal + reset saat filter berubah
  useEffect(() => {
    setAnchors([]);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, statusFilter, sortMode]);

  function onPrev() {
    if (pageIndex === 0 || loading) return;
    fetchPage(pageIndex - 1);
  }
  function onNext() {
    if (!hasNext || loading) return;
    fetchPage(pageIndex + 1);
  }

  /* ======= Mulai tes (open modal) ======= */
  function startTestFromRow(row) {
    if (row.done) return;
    setCurrentStudent(row.user);
    setAnswers({ student: {}, parent: {} });
    setOpen(true);
  }

  /* ======= Hitung & Simpan ======= */
  async function submitTest() {
    if (!currentStudent) return;
    if (!examinerName.trim()) {
      alert("Isi nama penguji terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      // hitung student
      let sumS = 0,
        maxS = 0;
      qsStudent.forEach((q) => {
        const chosen = q.options?.find((o) => o.key === answers.student[q.id]);
        const pts = Number(chosen?.points || 0);
        sumS += pts;
        const qMax = Math.max(0, ...(q.options || []).map((o) => Number(o.points || 0)));
        maxS += qMax;
      });
      // hitung parent
      let sumP = 0,
        maxP = 0;
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
        answers: { student: answers.student, parent: answers.parent },
        sumStudent: sumS,
        maxStudent: maxS,
        scoreStudent50,
        sumParent: sumP,
        maxParent: maxP,
        scoreParent50,
        total100,
        examinerName: examinerName.trim(),
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

  /* ======= Export XLS (tampilan saat ini) ======= */
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
    const rows = viewItems.map((r) => {
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
    a.download = `tes-wawancara-${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ======= Render ======= */
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 min-h-0 w-full max-w-none px-0 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Tes Wawancara</h1>
          <div className="text-xs text-slate-600">
            Halaman <b>{pageIndex + 1}</b> • Baris: <b>{viewItems.length}</b> / {PAGE_SIZE}
          </div>
        </div>
        <p className="text-sm text-slate-700">
          Filter berdasarkan jenjang & status. Urutkan nilai tertinggi untuk melihat ranking. Data per halaman maksimal {PAGE_SIZE}.
        </p>

        {errMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errMsg}
          </div>
        )}

        {/* Toolbar (stack di mobile) */}
        <div className="mt-4 -mx-4 sm:mx-0">
  <div className="rounded-none sm:rounded-xl border-y sm:border border-slate-200 bg-white p-3 sm:p-4">
    <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
              {/* Jenjang */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Filter jenjang"
              >
                {levels.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Filter status selesai"
              >
                <option value="ALL">Semua Status</option>
                <option value="SELESAI">Selesai saja</option>
              </select>

              {/* Urut */}
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Urutkan"
              >
                <option value="DEFAULT">Urut NISN</option>
                <option value="NILAI_TERTINGGI">Nilai tertinggi</option>
              </select>

              <input
  value={tableQuery}
  onChange={(e) => setTableQuery(e.target.value)}
  placeholder="Cari nama / NISN…"
  className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
  title="Ketik untuk memfilter daftar"
/>

              {/* Actions */}
              <button
                onClick={() => fetchPage(0)}
                className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                Refresh
              </button>

              <button
                onClick={exportXLS}
                className="w-full sm:w-auto rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE: Cards (<md) */}
        <div className="mt-4 -mx-4 sm:mx-0 space-y-3 md:hidden">
          {loading && (
            <div className="h-16 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          )}
          {!loading && viewItems.length === 0 && (
            <div className="rounded-none sm:rounded-xl border-y sm:border border-slate-200 bg-white p-4">
              Tidak ada data.
            </div>
          )}
          {!loading && viewItems.map((r) => (
              <div key={`${r.nisn}-${r.no}`} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">No {r.no}</div>
                    <div className="mt-0.5 font-semibold text-slate-900">{r.name}</div>
                    <div className="font-mono text-sm text-slate-700">{r.nisn}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{r.level}</div>
                    <div className="mt-1 text-sm">
                      {r.done ? (
                        <span className="inline-flex items-center rounded bg-slate-200 px-2.5 py-1 text-xs text-slate-700">
                          Selesai
                        </span>
                      ) : (
                        <button
                          onClick={() => startTestFromRow(r)}
                          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Mulai Tes
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500">Penguji</div>
                  <div className="text-right">{r.examiner ?? "-"}</div>
                  <div className="text-slate-500">Nilai</div>
                  <div className="text-right font-semibold">{r.score != null ? r.score : "-"}</div>
                </div>
              </div>
            ))}
        </div>

        {/* DESKTOP: Table (≥md) */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white text-black hidden md:block">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left w-12">No</th>
                <th className="px-3 py-2 text-left">NISN</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Jenjang</th>
                <th className="px-3 py-2 text-left">Penguji</th>
                <th className="px-3 py-2 text-left">Mulai Tes</th>
                <th className="px-3 py-2 text-left">Nilai</th>
              </tr>
            </thead>
            <tbody>
  {loading && (
    <tr>
      <td colSpan={7} className="px-3 py-6">
        <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      </td>
    </tr>
  )}

  {!loading &&
    viewItems.map((r) => (
      <tr key={`${r.nisn}-${r.no}`} className="border-t">
        <td className="px-3 py-2">{r.no}</td>
        <td className="px-3 py-2 font-mono">{r.nisn}</td>
        <td className="px-3 py-2">{r.name}</td>
        <td className="px-3 py-2">{r.level}</td>
        <td className="px-3 py-2">{r.examiner ?? "-"}</td>
        <td className="px-3 py-2">
          {r.done ? (
            <span className="inline-flex items-center rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700">
              Tes selesai
            </span>
          ) : (
            <button
              onClick={() => startTestFromRow(r)}
              className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Mulai Tes
            </button>
          )}
        </td>
        <td className="px-3 py-2 font-semibold">{r.score != null ? r.score : "-"}</td>
      </tr>
    ))}

  {!loading && viewItems.length === 0 && (
    <tr>
      <td colSpan={7} className="px-3 py-8 text-center text-slate-600">
        Tidak ada data.
      </td>
    </tr>
  )}
</tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">
            Halaman <b>{pageIndex + 1}</b>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onPrev}
              disabled={pageIndex === 0 || loading}
              className="w-full sm:w-auto rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
            >
              ⟵ Sebelumnya
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext || loading}
              className="w-full sm:w-auto rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
            >
              Berikutnya ⟶
            </button>
          </div>
        </div>
      </main>

      {/* ===== Modal Tes ===== */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-2 sm:p-4">
            <div className="mt-0 sm:mt-10 w-full max-w-none sm:max-w-4xl rounded-none sm:rounded-2xl bg-white shadow-xl ring-1 ring-black/5 h-[100dvh] sm:h-auto">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Tes Wawancara — {currentStudent ? getName(currentStudent) : ""}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                >
                  Tutup
                </button>
              </div>

              <div className="px-5 py-4 max-h-[calc(100dvh-8rem)] sm:max-h-none overflow-y-auto">
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

                {/* Penguji */}
                <div className="mt-4 rounded-xl border border-slate-200 p-4 text-black">
                  <label className="text-sm">
                    <span className="text-slate-700">Nama Penanya</span>
                    <input
                      value={examinerName}
                      onChange={(e) => setExaminerName(e.target.value)}
                      placeholder="cth: Ust. Ahmad / Ustd. Fatimah"
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  onClick={submitTest}
                  disabled={saving}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
