'use client';
import React, { useEffect, useState } from 'react';

/** Build URL surat digital (absolute jika origin tersedia) */
export function buildSuratURL(nisn, origin) {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
  const n = encodeURIComponent(String(nisn || '').trim());
  return `${base}/surat-digital/pendaftaran/${n}`;
}

/* ====== Loader ESM: qrcode (tanpa CDN/public) ====== */
async function loadQRCode() {
  if (typeof window === 'undefined') {
    throw new Error('QRCode hanya tersedia di browser');
  }
  // dynamic import dari node_modules
  const mod = await import('qrcode');
  return mod.default || mod; // Next kadang menaruh di default
}

/** Generate QR Code sebagai DataURL PNG */
export async function generateQRCodeDataURL({
  text,
  size = 256,          // sisi (px)
  margin = 0,
  colorDark = '#000000',
  colorLight = '#ffffff',
} = {}) {
  if (!text) throw new Error('generateQRCodeDataURL: "text" wajib diisi.');
  const QRCode = await loadQRCode();
  // API resmi: QRCode.toDataURL(text, options)
  return await QRCode.toDataURL(text, {
    width: size,
    margin,
    color: { dark: colorDark, light: colorLight },
  });
}

/** Komponen <img> QR siap pakai */
export function QRCodeImg({
  nisn,
  url,                  // override url; jika tidak, dibangun dari nisn
  className = '',
  size = 180,
  margin = 0,
  showUrlText = false,
  alt = 'qrcode',
}) {
  const [src, setSrc] = useState('');
  const targetUrl =
    url ||
    buildSuratURL(
      nisn,
      typeof window !== 'undefined' ? window.location.origin : undefined
    );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dataUrl = await generateQRCodeDataURL({
          text: targetUrl,
          size,
          margin,
        });
        if (alive) setSrc(dataUrl);
      } catch (e) {
        console.error('QR render failed:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [targetUrl, size, margin]);

  return (
    <div className={className}>
      {src ? (
        <img src={src} alt={alt} style={{ display: 'block' }} />
      ) : (
        <div style={{ fontSize: 12, color: '#6b7280' }}>membuat QR…</div>
      )}
      {showUrlText && (
        <div style={{ fontSize: 10, color: '#374151', marginTop: 4, wordBreak: 'break-all' }}>
          {targetUrl}
        </div>
      )}
    </div>
  );
}

/** Gambar QR langsung ke pdf-lib */
export async function drawQRCodeOnPdf({
  pdfDoc,
  page,
  nisn,
  url,
  x,
  y,
  size = 90,      // sisi (pt) di PDF
  origin,
}) {
  if (!pdfDoc || !page) throw new Error('drawQRCodeOnPdf: pdfDoc & page wajib.');
  const targetUrl = url || buildSuratURL(nisn, origin);
  const dataUrl = await generateQRCodeDataURL({ text: targetUrl, size: 256, margin: 0 });

  const pngBytes = await (await fetch(dataUrl)).arrayBuffer();
  const img = await pdfDoc.embedPng(pngBytes);
  page.drawImage(img, { x, y, width: size, height: size });
  return { url: targetUrl };
}
