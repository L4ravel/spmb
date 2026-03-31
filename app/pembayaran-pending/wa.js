'use client';

import React from 'react';

/* ==== Utils khusus WA (mandiri) ==== */
const cx = (...a) => a.filter(Boolean).join(' ');

// format IDR
export const fmtIDR = (n, currency = 'IDR') =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

// normalisasi nomor Indonesia → 62xxxxxxxxxx
export const normalizePhone = (raw = '') => {
  let s = String(raw || '').replace(/[^\d]/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
};

export const toWaChatLink = (value = '') => {
  if (!value) return '';
  const isHttp = /^https?:\/\//i.test(value);
  if (isHttp) return value.trim();
  const num = normalizePhone(value);
  return num ? `https://wa.me/${num}` : '';
};

// teks konfirmasi WA (URL-encoded)
export function buildWaConfirmText({ name, nisn, amount, label }) {
  const lines = [
    'Bismillah,',
    'konfirmasi pembayaran pendaftaran.',
    `Nama: ${name || '-'}`,
    `NISN: ${nisn || '-'}`,
    `Jenjang: ${label || '-'}`,
    `Jumlah: ${fmtIDR(amount)}`,
    '(Bukti sudah diunggah - Menunggu Konfirmasi.)',
  ];
  return encodeURIComponent(lines.join('\n'));
}

// sertakan ?text=... ke link WA
export function toWaLinkWithText(baseUrl = '', encodedText = '') {
  if (!baseUrl) return '';
  const url = toWaChatLink(baseUrl) || baseUrl;
  if (!encodedText) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}text=${encodedText}`;
}

/* ==== Komponen tombol Konfirmasi WA ==== */
export function KonfirmasiWaButton({
  className = '',
  hasProof = false,
  waPrivateLink = '',
  waLabel = '',
  fullName,
  nisn,
  amount,
  label,
}) {
  const enabled = !!hasProof;
  const encodedMsg = buildWaConfirmText({ name: fullName, nisn, amount, label });

  // Jika admin sediakan link/nomor, pakai itu; jika tidak, fallback tetap buka WA dengan text terisi
  const waHref = enabled
    ? (waPrivateLink
        ? toWaLinkWithText(waPrivateLink, encodedMsg)
        : `https://api.whatsapp.com/send?text=${encodedMsg}`)
    : '#';

  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (enabled) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className={cx(
            'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-semibold h-10',
            'w-full sm:w-auto',
            className
          )}
          title={`Konfirmasi ke admin${waLabel ? ` (${waLabel})` : ''}`}
        >
          Konfirmasi via WA
        </a>

        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2.5 text-sm font-semibold h-10 w-full sm:w-auto"
          title="Lanjutkan ke portal (refresh halaman setelah pembayaran)"
        >
          Lanjutkan
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
      <button
        type="button"
        disabled
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white/80 px-4 py-2.5 text-sm font-semibold h-10 opacity-60 cursor-not-allowed',
          'w-full sm:w-auto',
          className
        )}
        title="Unggah bukti dulu untuk mengaktifkan konfirmasi WA."
      >
        Konfirmasi via WA
      </button>

      <button
  type="button"
  onClick={handleRefresh}
  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold h-10 w-full sm:w-auto"
  title="Lanjutkan (refresh halaman)"
>
  Lanjutkan
</button>
    </div>
  );
}
