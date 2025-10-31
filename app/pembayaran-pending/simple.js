"use client";
import React, { useEffect, useState } from "react";
import { KonfirmasiWaButton } from "./wa";

/* ===== Main Component (tanpa card Aktivasi Akun, tanpa tombol rekening) ===== */
export default function Simple({
  userUsername,
  badgeNode,
  showFee,
  feeInfo,
  registrationLevel,
  UploadButtonComponent,
  fmtIDR,
  hasProof,
  isVerifiedFS,
  busy,
  onOpenPreview,
  onCancel,
  konfirmasiProps,
}) {
  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Info nominal singkat */}
      <div className="rounded-lg bg-slate-50 p-3 mb-3">
        {showFee ? (
          <p className="text-sm text-slate-700">
            Nominal {feeInfo?.label || registrationLevel}:{" "}
            <span className="font-bold text-violet-700 text-lg">
              {fmtIDR(feeInfo?.fee, feeInfo?.currency)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-slate-600">Nominal tampil otomatis sesuai jenjang.</p>
        )}
      </div>

      {/* Aksi utama — bahasa disederhanakan */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {UploadButtonComponent && <UploadButtonComponent disabled={hasProof} />}
          <KonfirmasiWaButton {...konfirmasiProps} />
        </div>

        <p className="text-xs text-slate-500">
          Unggah bukti. Lalu tekan “Konfirmasi WA”.
        </p>

        {/* Kelola bukti (muncul setelah ada unggahan) */}
        {hasProof && (
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={onOpenPreview}
              className="rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 px-4 py-2 text-sm font-medium"
            >
              Lihat Bukti
            </button>
            <button
              onClick={onCancel}
              disabled={isVerifiedFS || busy}
              className="rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Batalkan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
