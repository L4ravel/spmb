"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";

/** Komponen inner (pakai useSearchParams) */
function ListSoalInner() {
  const qs = useSearchParams();
  const paket = (qs.get("paket") || "").trim(); // ex: paket-1
  const mapel = (qs.get("mapel") || "").trim(); // ex: Umum (opsional)

  const [loading, setLoading] = useState(true);
  const [soal, setSoal] = useState([]);
  const [error, setError] = useState("");

  const hasFilter = useMemo(() => paket.length > 0, [paket]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasFilter) {
        setLoading(false);
        setSoal([]);
        return;
      }
      setLoading(true);
      setError("");

      try {
        const baseConstraints = [
          where("aktif", "==", true),
          where("paketId", "==", paket),
        ];
        if (mapel) baseConstraints.push(where("mapel", "==", mapel));

        const q = query(
          collection(db, "soal_akademik"),
          ...baseConstraints,
          limit(1000)
        );

        const snap = await getDocs(q);
        if (cancelled) return;

        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
          const ca = a.createdAt?.seconds || 0;
          const cb = b.createdAt?.seconds || 0;
          if (ca !== cb) return ca - cb;
          return String(a.pertanyaan || "").localeCompare(
            String(b.pertanyaan || "")
          );
        });

        setSoal(items);
      } catch (e) {
        console.error(e);
        if (!cancelled)
          setError("Gagal memuat soal. Coba cek index atau koneksi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hasFilter, paket, mapel]);

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <h1 className="text-2xl font-bold text-slate-900">List Soal</h1>
        <p className="text-sm text-slate-600 mt-1">
          Paket: <b>{paket || "—"}</b>
          {mapel ? (
            <>
              {" "}
              • Mapel: <b>{mapel}</b>
            </>
          ) : null}
        </p>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-6 pb-12">
        {!hasFilter && (
          <div className="rounded-xl border border-slate-200 p-4 text-slate-600">
            Tambahkan query <code>?paket=paket-1</code> (opsional{" "}
            <code>&mapel=Umum</code>) pada URL untuk memuat soal.
          </div>
        )}

        {hasFilter && loading && (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}

        {hasFilter && !loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        )}

        {hasFilter && !loading && !error && (
          <>
            <div className="mb-3 text-sm text-slate-600">
              Total soal: <b>{soal.length}</b>
            </div>

            <ol className="grid gap-4">
              {soal.map((q, idx) => (
                <li
                  key={q.id}
                  className="rounded-2xl bg-white p-4 ring-1 ring-violet-100 shadow-[0_8px_24px_rgba(24,0,75,.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-slate-900 font-semibold">
                      {idx + 1}.{" "}
                      {q.pertanyaan || (
                        <i className="text-slate-500">— (tanpa teks)</i>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-slate-600">
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 mr-1">
                        Bobot {Math.max(1, parseInt(String(q.bobot || 1), 10))}
                      </span>
                      {q.tingkat ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                          {q.tingkat}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {Array.isArray(q.opsi) && q.opsi.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {q.opsi.map((o, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-slate-200 px-3 py-2"
                        >
                          {o}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">
                      — Tidak ada opsi
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}

/** Halaman utama: bungkus dalam Suspense agar aman saat pre-render */
export default function ListSoalPage() {
  return (
    <Suspense fallback={null}>
      <ListSoalInner />
    </Suspense>
  );
}
