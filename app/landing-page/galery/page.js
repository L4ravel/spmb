"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Header from "../header";
import Footer from "../footer";

/* ===== Util ===== */
const mod = (n, m) => ((n % m) + m) % m;
const SLIDE_MS = 5000; // autoplay delay
const FADE_MS = 700;   // fade duration

/* ===== Sumber gambar ===== */
const slides = Array.from({ length: 12 }, (_, i) => `/galery/${i + 1}.jpg`);

/* ===== Preload sederhana ===== */
function useImagePreload() {
  const cache = useRef(new Map());
  const preload = useCallback(async (src) => {
    if (!src || cache.current.get(src) === true) return true;
    cache.current.set(src, false);
    await new Promise((res) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = src;
      const done = () => { cache.current.set(src, true); res(true); };
      img.onload = done;
      img.onerror = done;
    });
    return true;
  }, []);
  return { preload };
}

export default function GaleryPage() {
  const len = slides.length;
  const [front, setFront] = useState(0);
  const [back, setBack] = useState(1);
  const [fading, setFading] = useState(false);
  const { preload } = useImagePreload();
  const containerRef = useRef(null);

  const goto = useCallback(async (tgt) => {
    const t = mod(tgt, len);
    if (t === front || fading) return;
    await preload(slides[t]);
    setBack(t);
    setFading(true);
  }, [front, fading, len, preload]);

  const next = useCallback(() => goto(front + 1), [goto, front]);
  const prev = useCallback(() => goto(front - 1), [goto, front]);

  // autoplay
  useEffect(() => {
    if (fading) return;
    const id = setInterval(next, SLIDE_MS);
    return () => clearInterval(id);
  }, [next, fading]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // swipe
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let x0 = null;
    const down = (e) => { x0 = e.clientX ?? e.touches?.[0]?.clientX ?? null; };
    const up = (e) => {
      if (x0 == null) return;
      const x1 = e.clientX ?? e.changedTouches?.[0]?.clientX ?? x0;
      const dx = x1 - x0;
      if (Math.abs(dx) > 40) (dx > 0 ? prev() : next());
      x0 = null;
    };
    el.addEventListener("pointerdown", down, { passive: true });
    el.addEventListener("pointerup", up, { passive: true });
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
    };
  }, [next, prev]);

  // preload tetangga
  useEffect(() => {
    preload(slides[front]);
    preload(slides[mod(front + 1, len)]);
    preload(slides[mod(front - 1, len)]);
  }, [front, len, preload]);

  const onFadeEnd = () => {
    if (!fading) return;
    setFront(back);
    setFading(false);
  };

  // 4 preview berikutnya (responsif)
  const previewIdx = useMemo(
    () => Array.from({ length: 4 }, (_, i) => mod(front + i + 1, len)),
    [front, len]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <Header />

      <main className="flex-grow">
        <section
          ref={containerRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Galeri Foto"
          className="relative isolate w-full overflow-hidden sm:rounded-3xl min-h-[50svh] sm:min-h-[70svh] md:min-h-[80svh] lg:min-h-[92svh]"
          style={{ contain: "paint" }}
        >
          {/* BACKGROUND IMAGES: PURE CROSS-FADE */}
          <div className="absolute inset-0">
            {/* FRONT */}
            <div
              className="absolute inset-0"
              style={{
                opacity: fading ? 0 : 1,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
                willChange: "opacity",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              }}
              onTransitionEnd={onFadeEnd}
            >
              <img
                src={slides[front]}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-cover object-center"
              />
            </div>

            {/* BACK */}
            <div
              className="absolute inset-0"
              style={{
                opacity: fading ? 1 : 0,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
                willChange: "opacity",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              }}
            >
              <img
                src={slides[back]}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-cover object-center"
              />
            </div>
          </div>

          {/* Kontrol kiri bawah */}
          <div className="absolute left-4 bottom-24 z-20 sm:left-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={prev}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow transition hover:bg-white sm:h-12 sm:w-12"
                aria-label="Sebelumnya"
              >
                ‹
              </button>
              <button
                onClick={next}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow transition hover:bg-white sm:h-12 sm:w-12"
                aria-label="Selanjutnya"
              >
                ›
              </button>
            </div>
          </div>

          {/* PANEL KANAN (desktop): preview */}
          <div
            className="
              absolute z-20 hidden lg:flex
              right-3 sm:right-6 xl:right-8
              top-1/2 -translate-y-1/2
              flex-col gap-3 sm:gap-4
              max-h-[72vh] overflow-y-auto
            "
            aria-label="Preview slide"
          >
            {previewIdx.map((idx) => (
              <button
                key={idx}
                onClick={() => goto(idx)}
                className="relative h-20 w-36 overflow-hidden rounded-2xl shadow ring-1 ring-black/10 focus:outline-none focus:ring-black/30 md:h-24 md:w-44 xl:h-28 xl:w-52"
                aria-label={`Lihat foto ${idx + 1}`}
              >
                <img
                  src={slides[idx]}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
              </button>
            ))}
          </div>

          {/* THUMBS MOBILE */}
          <div className="absolute inset-x-0 bottom-6 z-20 flex gap-2 overflow-x-auto px-4 pb-2 sm:px-8 lg:hidden">
            {previewIdx.map((idx) => (
              <button
                key={`m-${idx}`}
                onClick={() => goto(idx)}
                className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10 focus:outline-none focus:ring-black/30 sm:h-18 sm:w-28"
                aria-label={`Lihat foto ${idx + 1}`}
              >
                <img
                  src={slides[idx]}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
