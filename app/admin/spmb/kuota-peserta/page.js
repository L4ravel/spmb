"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import { HIERARCHY } from "@/app/spmb/JenjangPicker";

const PROGRAMS = Object.values(HIERARCHY)
  .flat()
  .flatMap((group) => group.values)
  .map((option) => option.value);

const isNonAsrama = (label) => /non\s*asrama|full\s*day/i.test(label);

const GROUPS = [
  {
    key: "asrama",
    title: "Asrama",
    description: "Kuota untuk program asrama.",
    labels: PROGRAMS.filter((label) => !isNonAsrama(label)),
  },
  {
    key: "non-asrama",
    title: "Non Asrama",
    description: "Kuota untuk program non asrama dan Full Day.",
    labels: PROGRAMS.filter(isNonAsrama),
  },
];

const numberFormat = new Intl.NumberFormat("id-ID");

async function getQuotas() {
  const response = await fetch("/api/quotas", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Gagal memuat kuota peserta.");
  }
  return data.items || [];
}

async function saveQuota(payload) {
  const response = await fetch("/api/quotas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Gagal menyimpan kuota peserta.");
  }
  return data;
}

function QuotaTable({ group, drafts, dirtyLabels, savingLabels, onChange, onSave }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold text-slate-900">{group.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{group.description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr className="border-b border-slate-200 text-left">
              <th className="w-16 px-5 py-3 font-semibold">No.</th>
              <th className="px-5 py-3 font-semibold">Jenjang / Program</th>
              <th className="w-52 px-5 py-3 font-semibold">Kuota Peserta</th>
              <th className="w-44 px-5 py-3 font-semibold">Status</th>
              <th className="w-36 px-5 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {group.labels.map((label, index) => {
              const draft = drafts[label] || { limit: 0, open: true };
              const isDirty = dirtyLabels.has(label);
              const isSaving = savingLabels.has(label);

              return (
                <tr key={label} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{label}</td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={draft.limit}
                      onChange={(event) => onChange(label, "limit", event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      aria-label={`Kuota ${label}`}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={draft.open ? "open" : "closed"}
                      onChange={(event) => onChange(label, "open", event.target.value === "open")}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      aria-label={`Status pendaftaran ${label}`}
                    >
                      <option value="open">Dibuka</option>
                      <option value="closed">Ditutup</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSave(label)}
                      disabled={!isDirty || isSaving}
                      className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Menyimpan" : "Simpan"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={2} className="px-5 py-3 font-bold text-slate-800">
                Total kuota {group.title}
              </td>
              <td className="px-5 py-3 font-bold text-blue-800">
                {numberFormat.format(
                  group.labels.reduce(
                    (total, label) => total + (Number(drafts[label]?.limit) || 0),
                    0
                  )
                )}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default function KuotaPesertaPage() {
  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState([]);
  const [saving, setSaving] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const dirtyLabels = useMemo(() => new Set(dirty), [dirty]);
  const savingLabels = useMemo(() => new Set(saving), [saving]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const items = await getQuotas();
      const byLabel = new Map(items.map((item) => [String(item.label || "").trim(), item]));
      const nextDrafts = {};
      for (const label of PROGRAMS) {
        const item = byLabel.get(label);
        nextDrafts[label] = {
          limit: Number(item?.limit) || 0,
          open: item?.open !== false,
        };
      }
      setDrafts(nextDrafts);
      setDirty([]);
    } catch (loadError) {
      setError(loadError?.message || "Gagal memuat kuota peserta.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateDraft(label, field, value) {
    setDrafts((current) => ({
      ...current,
      [label]: {
        ...(current[label] || { limit: 0, open: true }),
        [field]: field === "limit" ? Math.max(0, Number(value) || 0) : value,
      },
    }));
    setDirty((current) => (current.includes(label) ? current : [...current, label]));
    setMessage("");
  }

  async function save(label) {
    const draft = drafts[label] || { limit: 0, open: true };
    setSaving((current) => [...current, label]);
    setError("");
    setMessage("");
    try {
      await saveQuota({ label, limit: draft.limit, open: draft.open });
      setDirty((current) => current.filter((item) => item !== label));
      setMessage(`Kuota ${label} berhasil disimpan.`);
    } catch (saveError) {
      setError(saveError?.message || `Gagal menyimpan kuota ${label}.`);
    } finally {
      setSaving((current) => current.filter((item) => item !== label));
    }
  }

  async function saveAll() {
    const labels = [...dirtyLabels];
    if (!labels.length) return;
    setSaving(labels);
    setError("");
    setMessage("");
    try {
      await Promise.all(
        labels.map((label) => {
          const draft = drafts[label] || { limit: 0, open: true };
          return saveQuota({ label, limit: draft.limit, open: draft.open });
        })
      );
      setDirty([]);
      setMessage(`${labels.length} perubahan kuota berhasil disimpan.`);
    } catch (saveError) {
      setError(saveError?.message || "Sebagian kuota gagal disimpan. Silakan coba lagi.");
    } finally {
      setSaving([]);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Pengaturan SPMB</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Kuota Peserta</h1>
          <p className="mt-2 text-sm text-slate-600">
            Atur kuota dan status pendaftaran setiap program dalam tabel Asrama dan Non Asrama.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={!dirty.length || saving.length > 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save className="h-4 w-4" />
            Simpan Semua ({dirty.length})
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-slate-600">
          Memuat kuota peserta…
        </div>
      ) : (
        GROUPS.map((group) => (
          <QuotaTable
            key={group.key}
            group={group}
            drafts={drafts}
            dirtyLabels={dirtyLabels}
            savingLabels={savingLabels}
            onChange={updateDraft}
            onSave={save}
          />
        ))
      )}
    </div>
  );
}
