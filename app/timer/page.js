'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

// ====== CONFIG ======
// WITA = +08:00
const TARGET_ISO = '2025-11-01T00:00:00+08:00';
const TITLE = 'SPMB 2026';
const SUBTITLE = 'Sistem Penerimaan Murid Baru Pondok As-Sunnah Bagik Nyaka';

// ---- util waktu ----
function diffParts(ms) {
  const clamp = Math.max(0, ms);
  const s = Math.floor(clamp / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return { days, hours, minutes, seconds, totalSec: s };
}
function pad(n) {
  return n.toString().padStart(2, '0');
}

// ---- responsif: ukuran lingkaran berdasarkan lebar layar ----
function useCircleSize() {
  const [size, setSize] = useState(320);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w >= 1440) setSize(360);
      else if (w >= 1280) setSize(340);
      else if (w >= 1024) setSize(320);
      else if (w >= 640) setSize(280);
      else setSize(260);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return size;
}

export default function TimerPage() {
  const target = useMemo(() => new Date(TARGET_ISO).getTime(), []);
  const [now, setNow] = useState(Date.now());
  const [initialTotal, setInitialTotal] = useState(() =>
    Math.max(1, new Date(TARGET_ISO).getTime() - Date.now())
  );
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setInitialTotal(Math.max(1, target - Date.now()));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  const remaining = Math.max(0, target - now);
  const { days, hours, minutes, seconds } = diffParts(remaining);
  const opened = remaining <= 0;

  // Progress circle (pakai ukuran responsif)
  const size = useCircleSize();
  const stroke = 6;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  const progress = 1 - remaining / initialTotal;
  const dash = Math.min(1, Math.max(0, progress)) * C;

  // Pecahan kecil (24 shard)
  const shards = Array.from({ length: 24 }, (_, i) => i);

  /* ================= UNLOCK refs & helpers ================= */
  const bufferRef = useRef('');
  const resetTimerRef = useRef(null);
  const triggeredRef = useRef(false);

  // NEW: click 5x unlock
  const [clicks, setClicks] = useState(0);
  const clickTimerRef = useRef(null);

  function maybeUnlock() {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('key', 'buka');
      url.searchParams.set('next', '/spmb');
      window.location.assign(`/timer?${url.searchParams.toString()}`);
    } catch {
      window.location.assign('/timer?key=buka&next=/spmb');
    }
  }

  function onSecretClick() {
    // hitung klik cepat; reset setelah 1.2s tanpa klik
    setClicks((c) => {
      const n = c + 1;
      if (n >= 5) {
        // bersihkan & buka
        clearTimeout(clickTimerRef.current);
        setTimeout(() => setClicks(0), 0);
        maybeUnlock();
        return 0;
      }
      return n;
    });
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => setClicks(0), 1200);
  }

  useEffect(() => {
    function onKey(e) {
      const k = (e.key || '').toLowerCase();

      // Abaikan modifier / control keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k.length !== 1) {
        if (k === ' ') return;
        return;
      }

      // Tambah ke buffer (huruf/angka saja)
      if (!/^[a-z0-9]$/.test(k)) return;
      bufferRef.current = (bufferRef.current + k).slice(-8); // simpan 8 char terakhir

      // Reset buffer jika idle > 1200ms
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, 1200);

      // Cek kata kunci
      if (bufferRef.current.includes('buka')) {
        maybeUnlock();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      clearTimeout(clickTimerRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen w-full bg-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* === KEYFRAMES & HOVER EFFECT CSS === */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gridMove { 0%{ transform: translateY(0) } 100%{ transform: translateY(50px) } }
@keyframes float { 0%,100%{ transform: translate(0,0) scale(1) } 50%{ transform: translate(30px,-30px) scale(1.1) } }
@keyframes scanlines { 0%{ transform: translateY(0) } 100%{ transform: translateY(10px) } }
@keyframes glow { 0%,100%{ box-shadow: 0 0 20px rgba(6,95,70,.22), 0 0 40px rgba(6,95,70,.12), inset 0 0 20px rgba(6,95,70,.06) } 50%{ box-shadow: 0 0 30px rgba(6,95,70,.32), 0 0 60px rgba(6,95,70,.22), inset 0 0 30px rgba(6,95,70,.12) } }
@keyframes slideIn { from{ opacity:0; transform: translateY(-12px) } to{ opacity:1; transform: translateY(0) } }
@keyframes pulse { 0%,100%{ opacity: .9; transform: scale(1) } 50%{ opacity: 1; transform: scale(1.03) } }
@keyframes spinCW { from{ transform: rotate(0deg)} to{ transform: rotate(360deg)} }
@keyframes spinCCW { from{ transform: rotate(0deg)} to{ transform: rotate(-360deg)} }

.fracture-container { transition: transform .35s ease, filter .35s ease; }
.fracture-container:hover { transform: scale(1.03); filter: saturate(1.05); }

.fracture-ring { transition: stroke-dasharray .35s ease, stroke-width .2s ease, opacity .25s ease; }
.fracture-container:hover .fracture-ring { stroke-dasharray: 8 22 !important; opacity: .9; }

.fracture-container .dash-ring-outer { animation: spinCW 10s linear infinite; }
.fracture-container .dash-ring-inner { animation: spinCCW 12s linear infinite; }
.fracture-container:hover .dash-ring-outer { animation-duration: 6s; }
.fracture-container:hover .dash-ring-inner { animation-duration: 7s; }

.shard {
  position:absolute; left:50%; top:50%;
  width: 8px; height: 14px; border-radius: 2px;
  background: rgba(6,95,70,.28);
  box-shadow: 0 4px 12px rgba(6,95,70,.25);
  transform-origin: 50% calc(50% + ${r - 8}px);
  opacity: 0;
  transition: transform .45s cubic-bezier(.22,.9,.24,1), opacity .25s ease;
}
.fracture-container:hover .shard { opacity: 1; transform: translate(-50%, -50%) translateY(-16px) rotate(var(--deg)); }

.spark {
  position:absolute; left:50%; top:50%;
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(4,120,87,.85);
  filter: blur(0.3px);
  opacity: 0;
  transition: transform .55s cubic-bezier(.2,.9,.2,1), opacity .25s ease;
}
.fracture-container:hover .spark { opacity: .9; transform: translate(-50%,-50%) translateY(-26px) rotate(var(--deg)) scale(0.9); }
          `,
        }}
      />

      {/* Latar & dekor sama seperti sebelumnya … */}

      {/* (… potongan dekor tetap sama …) */}

      <div className="relative z-10 w-full max-w-6xl">
        {/* HEADER */}
        {/* … header tetap sama … */}

        {/* ===== LINGKARAN TIMER ===== */}
        <div className="flex items-center justify-center mb-10 md:mb-12">
          <div
            className="relative fracture-container group select-none"
            style={{ width: size, height: size, cursor: 'pointer' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onSecretClick}
            role="button"
            aria-label='Klik 5x atau ketik "buka"'
            title='Klik 5x atau ketik "buka"'
          >
            {/* (… seluruh isi SVG & konten di dalam lingkaran tetap sama …) */}

            {/* SVG */}
            {/* --- keep the existing SVG and inner content from your file --- */}
            {/* >>> SALIN PERSIS blok SVG & konten tengah dari versi sebelumnya <<< */}

            {/* Agar jawaban tidak terlalu panjang, blok di bawah
               persis sama seperti file kamu sebelumnya. */}
            {/* === Mulai blok yang tidak berubah === */}
            <div
              className="absolute inset-0 rounded-full border-2 border-emerald-800/15"
              style={{ animation: 'glow 3s ease-in-out infinite' }}
            />
            <div
              className="absolute inset-8 rounded-full border border-emerald-800/15"
              style={{ animation: 'glow 3s ease-in-out infinite 1s' }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(6,95,70,0.17), transparent 70%)',
                filter: 'blur(36px)',
                animation: 'pulse 4s ease-in-out infinite',
              }}
            />
            {shards.map((i) => {
              const deg = (i / shards.length) * 360;
              return (
                <React.Fragment key={`shard-${i}`}>
                  <div className="shard" style={{ transform: 'translate(-50%,-50%) rotate(0deg)', ['--deg']: `${deg}deg` }} />
                  <div className="spark" style={{ ['--deg']: `${deg}deg` }} />
                </React.Fragment>
              );
            })}
            <svg width={size} height={size} className="relative">
              <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(6,95,70,0.12)" strokeWidth={stroke} fill="none" />
              <circle className="dash-ring-outer" cx={size / 2} cy={size / 2} r={r - 10} stroke="rgba(6,95,70,0.28)" strokeWidth={2} fill="none" strokeDasharray="3 12" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
              <circle className="dash-ring-inner" cx={size / 2} cy={size / 2} r={r - 18} stroke="rgba(6,95,70,0.22)" strokeWidth={2} fill="none" strokeDasharray="2 10" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="url(#neonGradient)"
                strokeWidth={hovered ? stroke + 0.5 : stroke}
                fill="none"
                strokeDasharray={
                  hovered
                    ? `${Math.max(0.0001, dash / 1.2)} ${Math.max(0, C - dash)}`
                    : `${dash} ${C - dash}`
                }
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="fracture-ring transition-all duration-500 ease-out"
                style={{ filter: 'drop-shadow(0 0 8px rgba(6,95,70,0.45)) drop-shadow(0 0 15px rgba(6,95,70,0.25))' }}
              />
              <defs>
                <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="50%" stopColor="#0ea56e" />
                  <stop offset="100%" stopColor="#065f46" />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {!opened ? (
                <>
                  <div className="text-emerald-700/70 text-[10px] md:text-xs uppercase tracking-[0.35em] font-bold mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                    SISTEM LOADING 
                    <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                  </div>

                  <div className="relative mb-1.5">
                    <div className="absolute inset-0 bg-emerald-800/15 blur-3xl" />
                    <div
                      className="relative font-black text-transparent bg-clip-text tabular-nums text-6xl md:text-7xl lg:text-8xl leading-none"
                      style={{
                        background: 'linear-gradient(180deg, #059669 0%, #065f46 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 2px 14px rgba(6,95,70,0.28))',
                      }}
                    >
                      {days}
                    </div>
                  </div>

                  <div className="px-3 py-0.5 rounded-full bg-emerald-800/10 border border-emerald-800/30 backdrop-blur-sm mb-4">
                    <span className="text-emerald-800 text-[10px] md:text-xs font-bold uppercase tracking-[0.28em]">
                      HARI 
                    </span>
                  </div>

                  <div className="flex items-center gap-3 md:gap-4">
                    <TimeBox label="Jam" value={pad(hours)} />
                    <div className="text-emerald-800/40 text-2xl md:text-3xl font-bold">:</div>
                    <TimeBox label="Menit" value={pad(minutes)} />
                    <div className="text-emerald-800/40 text-2xl md:text-3xl font-bold">:</div>
                    <TimeBox label="Detik" value={pad(seconds)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative w-24 h-24 md:w-28 md:h-28 mb-6 md:mb-8">
                    <div className="absolute inset-0 bg-emerald-700/20 rounded-full blur-2xl animate-pulse" />
                    <div
                      className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-700 to-emerald-600 flex items-center justify-center border-2 border-emerald-700/40 shadow-xl shadow-emerald-200"
                      style={{ animation: 'glow 2s ease-in-out infinite' }}
                    >
                      <svg className="w-12 h-12 md:w-16 md:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-emerald-800/70 text-[10px] md:text-xs uppercase tracking-[0.35em] font-bold mb-3 md:mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                    SYSTEM STATUS
                    <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                  </div>
                  <div className="relative mb-6 md:mb-8">
                    <div className="absolute inset-0 bg-emerald-700/20 blur-3xl" />
                    <div
                      className="relative font-black text-5xl md:text-6xl lg:text-7xl tracking-tight"
                      style={{
                        background:
                          'linear-gradient(135deg, #0ea56e 0%, #065f46 55%, #0ea56e 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 2px 18px rgba(6,95,70,0.32))',
                      }}
                    >
                      ONLINE
                    </div>
                  </div>
                  <a
                    href="/"
                    className="group relative inline-flex items-center justify-center gap-3 rounded-2xl px-8 py-4 font-black text-base md:text-lg tracking-wider uppercase bg-gradient-to-r from-emerald-700 to-emerald-600 border border-emerald-800/40 overflow-hidden hover:scale-105 transition-all duration-300 shadow-xl shadow-emerald-200"
                    style={{ boxShadow: '0 10px 36px rgba(6,95,70,0.28), inset 0 0 18px rgba(255,255,255,0.18)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/0 via-white/30 to-emerald-600/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <span className="relative text-white">Access Portal</span>
                    <svg className="relative w-6 h-6 text-white group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                </>
              )}
            </div>
            {/* === Akhir blok tidak berubah === */}
          </div>
        </div>

        {/* Footer kecil */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/70 border border-emerald-800/20 backdrop-blur-sm mb-3 shadow-lg shadow-emerald-50">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="text-emerald-800/80 text-[11px] md:text-xs uppercase tracking-[0.2em] font-bold">
              Sistem Akan Terbuka Ketika Waktu Telah Habis
            </span>
          </div>
          <p className="text-gray-400 text-[11px] md:text-xs tracking-wider mt-4">
            © {new Date().getFullYear()} SPMB SYSTEM PONDOK ASSUNNAH • ALL RIGHTS RESERVED
          </p>
        </div>
      </div>
    </main>
  );
}

function TimeBox({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-black text-emerald-800 text-3xl md:text-4xl tabular-nums tracking-wider">
        {value}
      </div>
      <div className="text-emerald-800/65 text-[9px] md:text-[10px] uppercase tracking-widest mt-0.5 md:mt-1 font-bold">
        {label}
      </div>
    </div>
  );
}
