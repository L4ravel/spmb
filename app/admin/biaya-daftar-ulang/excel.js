"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { JENJANG_OPTIONS } from  "@/app/spmb/JenjangPicker";

/* ======================
 * Util umum
 * ====================== */
export function toIDR(n) {
  const num = Number(String(n).replace(/[^\d.-]/g, "")) || 0;
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  } catch {
    return `Rp${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }
}
export function safeNum(v) {
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* ======================
 * Template & Parser
 * ====================== */
const TEMPLATE_HEADERS = [
  "jenjangLabel",
  "spp",
  "pakaian",
  "sarpras",
  "kasur",
  "kitab",
  "bp3",
];

const HEADER_MAP = {
  jenjanglabel: "jenjangLabel",
  jenjang: "jenjangLabel",
  label: "jenjangLabel",
  spp: "spp",
  pakaian: "pakaian",
  sarpras: "sarpras",
  kasur: "kasur",
  kitab: "kitab",
  bp3: "bp3",
};

/** ✅ Semua jenjang diambil dari JenjangPicker agar konsisten */
const ALL_JENJANG = Array.from(
  new Set((JENJANG_OPTIONS || []).map((x) => String(x?.value || "").trim()).filter(Boolean))
);

/** ✅ Template .xls berisi TSV dengan seluruh jenjang (angka kosong) */
function makeXlsTemplateTSV() {
  const header = TEMPLATE_HEADERS.join("\t");
  const body = ALL_JENJANG.map((label) =>
    [label, "", "", "", "", "", ""].join("\t")
  );
  return [header, ...body].join("\n");
}

export function downloadXlsTemplate(filename = "template_biaya_daftar_ulang.xls") {
  const content = makeXlsTemplateTSV();
  const blob = new Blob([content], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Auto-deteksi delimiter lalu parse ke objek normal */
function parseDelimited(text) {
  const sample = text.slice(0, 2000);
  const scored = [
    { d: "\t", n: (sample.match(/\t/g) || []).length },
    { d: ";", n: (sample.match(/;/g) || []).length },
    { d: ",", n: (sample.match(/,/g) || []).length },
  ].sort((a, b) => b.n - a.n);
  const delim = scored[0].n > 0 ? scored[0].d : "\t";

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const rawHeaders = lines[0]
    .split(delim)
    .map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "")
    );

  const headerIdx = rawHeaders.map((h) => HEADER_MAP[h] || null);
  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    const row = {};
    headerIdx.forEach((mapped, idx) => {
      if (mapped) row[mapped] = (cols[idx] ?? "").trim();
    });
    const payload = {
      jenjangLabel: String(row.jenjangLabel || "").trim(),
      spp: safeNum(row.spp),
      uangPangkal: {
        pakaian: safeNum(row.pakaian),
        sarpras: safeNum(row.sarpras),
        kasur: safeNum(row.kasur),
        kitab: safeNum(row.kitab),
        bp3: safeNum(row.bp3),
      },
      __row: i + 1,
    };
    const empty =
      !payload.jenjangLabel &&
      !payload.spp &&
      !payload.uangPangkal.pakaian &&
      !payload.uangPangkal.sarpras &&
      !payload.uangPangkal.kasur &&
      !payload.uangPangkal.kitab &&
      !payload.uangPangkal.bp3;
    if (!empty) out.push(payload);
  }
  return out;
}

function validateRows(list) {
  const errs = [];
  const validSet = new Set(ALL_JENJANG);
  list.forEach((r) => {
    if (!r.jenjangLabel) {
      errs.push({ row: r.__row, message: "Kolom jenjangLabel wajib diisi." });
    } else if (!validSet.has(r.jenjangLabel)) {
      errs.push({
        row: r.__row,
        message: `jenjangLabel tidak valid. Gunakan salah satu dari: ${ALL_JENJANG.join(", ")}`,
      });
    }
   const sppVal = Number.isFinite(Number(r.spp)) ? Number(r.spp) : safeNum(r.spp);
if (sppVal < 0) errs.push({ row: r.__row, message: "SPP harus angka ≥ 0." });
  });
  return errs;
}

/* ======================
 * Komponen Import Excel
 * ====================== */
export default function ExcelImport({
  endpoint = "/api/re_registration_fees",
  title = "Import Massal (XLS/CSV/TSV)",
  maxPreview = 100,
  onAfterImport,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState([]); // parsed rows
  const [errors, setErrors] = useState([]); // validation errors
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // {ok, fail}
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  function resetAll() {
    setRows([]);
    setErrors([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleText(text) {
    const parsed = parseDelimited(text);
    setRows(parsed);
    setErrors(validateRows(parsed));
    setResult(null);
  }

  function onInputFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      alert("File terlalu besar. Maksimum 5MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result || ""));
    reader.onerror = () => alert("Gagal membaca file.");
    reader.readAsText(f, "utf-8");
  }

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over = (ev) => {
      ev.preventDefault();
      setDragOver(true);
    };
    const leave = () => setDragOver(false);
    const drop = (ev) => {
      ev.preventDefault();
      setDragOver(false);
      const f = ev.dataTransfer.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => handleText(String(reader.result || ""));
      reader.readAsText(f, "utf-8");
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("drop", drop);
    };
  }, []);

  async function saveToEndpoint() {
    if (!rows.length) {
      alert("Tidak ada data untuk diimpor.");
      return;
    }
    const errs = validateRows(rows);
    setErrors(errs);
    if (errs.length) {
      alert("Perbaiki error pada data impor terlebih dahulu.");
      return;
    }
    setImporting(true);
    let ok = 0,
      fail = 0;
    try {
      for (const r of rows) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jenjangLabel: r.jenjangLabel,
              spp: safeNum(r.spp),
              uangPangkal: {
                pakaian: safeNum(r.uangPangkal.pakaian),
                sarpras: safeNum(r.uangPangkal.sarpras),
                kasur: safeNum(r.uangPangkal.kasur),
                kitab: safeNum(r.uangPangkal.kitab),
                bp3: safeNum(r.uangPangkal.bp3),
              },
            }),
          });
          if (!res.ok) throw new Error();
          ok++;
        } catch {
          fail++;
        }
      }
      const r = { ok, fail };
      setResult(r);
      onAfterImport?.(r);
    } finally {
      setImporting(false);
    }
  }

  return (
   <div className="rounded-none sm:rounded-2xl border-0 sm:border-2 border-slate-200 bg-white p-4 sm:p-6 shadow-none">

      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-slate-600" />
        <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
      </div>

      {/* Action buttons */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => downloadXlsTemplate()}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
        >
          <Download className="h-4 w-4" />
          Unduh Template (.xls)
        </button>

        <label className="inline-flex w-full sm:w-auto justify-center cursor-pointer items-center gap-2 rounded-lg border-2 border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 transition hover:bg-indigo-100">
          <UploadCloud className="h-4 w-4" />
          <span>Upload</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.csv,.tsv"
            className="hidden"
            onChange={onInputFile}
          />
        </label>

        {rows.length > 0 && (
          <>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={saveToEndpoint}
              disabled={importing}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {importing ? "Mengimpor..." : "Simpan ke Database"}
            </button>
          </>
        )}
      </div>

      {/* Dropzone */}
      <div
        ref={dropRef}
        className={`flex min-h[120px] items-center justify-center rounded-xl border-2 border-dashed p-4 sm:p-6 text-center transition ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <div>
          <p className="text-slate-800 font-medium">Tarik & letakkan file di sini</p>
          <p className="text-slate-700 text-xs sm:text-sm">
            Atau klik tombol <span className="font-semibold">Upload</span> di atas — Format: .xls (template kami), .csv, .tsv
          </p>
          <p className="text-slate-600 text-[11px] sm:text-xs mt-1">Maksimum 5MB</p>
        </div>
      </div>

      {/* Preview + Validation */}
      {rows.length > 0 && (
        <div className="mt-5">
          {!!errors.length && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {errors.length} error ditemukan. Perbaiki sebelum simpan.
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {errors.slice(0, 5).map((e, idx) => (
                  <li key={idx}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
                {errors.length > 5 && <li>…dan {errors.length - 5} error lainnya.</li>}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-800">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Jenjang</th>
                  <th className="px-3 py-2 font-semibold">SPP</th>
                  <th className="px-3 py-2 font-semibold">Pakaian</th>
                  <th className="px-3 py-2 font-semibold">Sarpras</th>
                  <th className="px-3 py-2 font-semibold">Kasur</th>
                  <th className="px-3 py-2 font-semibold">Kitab</th>
                  <th className="px-3 py-2 font-semibold">BP3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {rows.slice(0, maxPreview).map((r, i) => (
                  <tr key={i} className="odd:bg-white even:bg-slate-50 hover:bg-slate-100">
                    <td className="px-3 py-2 text-slate-700">{r.__row}</td>
                    <td className="px-3 py-2 font-medium">{r.jenjangLabel}</td>
                    <td className="px-3 py-2 font-semibold text-blue-700">{toIDR(r.spp)}</td>
                    <td className="px-3 py-2">{toIDR(r.uangPangkal.pakaian)}</td>
                    <td className="px-3 py-2">{toIDR(r.uangPangkal.sarpras)}</td>
                    <td className="px-3 py-2">{toIDR(r.uangPangkal.kasur)}</td>
                    <td className="px-3 py-2">{toIDR(r.uangPangkal.kitab)}</td>
                    <td className="px-3 py-2">{toIDR(r.uangPangkal.bp3)}</td>
                  </tr>
                ))}
                {rows.length > maxPreview && (
                  <tr>
                    <td colSpan={8} className="px-3 py-2 text-slate-700">
                      …menampilkan {maxPreview} baris pertama dari {rows.length}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-[11px] sm:text-xs text-slate-700">
            Tips: Ekspor dari Google Sheets sebagai <b>.tsv</b> atau <b>.csv</b>. Template kami (<code>.xls</code>) berisi TSV agar mudah diisi.
          </div>
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 text-xs sm:text-sm">
          Berhasil: <b>{result.ok}</b> • Gagal: <b>{result.fail}</b>
        </div>
      )}
    </div>
  );
}
