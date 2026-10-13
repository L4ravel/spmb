"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Images } from "lucide-react";
import Header from "../header";
import Footer from "../footer";
import styles from "./gallery.module.css";

const photos = [
  { src: "/galery/optimized/1.webp", title: "Masjid Assunnah", category: "Fasilitas ibadah", position: "center 55%" },
  { src: "/galery/optimized/2.webp", title: "Lapangan Olahraga", category: "Aktivitas santri", position: "center 45%" },
  { src: "/galery/optimized/6.webp", title: "Panorama Pondok", category: "Lingkungan pendidikan", position: "center 56%" },
  { src: "/galery/optimized/3.webp", title: "Kompleks Pendidikan", category: "Gedung belajar", position: "center" },
  { src: "/galery/optimized/4.webp", title: "Area Pendidikan", category: "Lingkungan pendidikan", position: "center" },
  { src: "/galery/optimized/5.webp", title: "Halaman Utama", category: "Ruang terbuka", position: "center" },
  { src: "/galery/optimized/7.webp", title: "TK Islam Assunnah", category: "Pendidikan usia dini", position: "center" },
  { src: "/galery/optimized/8.webp", title: "Lingkungan TK", category: "Area pembelajaran", position: "center" },
  { src: "/galery/optimized/9.webp", title: "Ruang Kelas", category: "Fasilitas belajar", position: "center" },
  { src: "/galery/optimized/10.webp", title: "Gedung Pendidikan", category: "Sarana akademik", position: "center" },
  { src: "/galery/optimized/11.webp", title: "Lapangan Sekolah", category: "Lingkungan belajar", position: "center" },
  { src: "/galery/optimized/12.webp", title: "Kampus Assunnah", category: "Lingkungan kampus", position: "center" },
];

export default function GalleryPage() {
  const sliderRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);

  const goTo = (index) => {
    const target = Math.max(0, Math.min(index, photos.length - 1));
    const slider = sliderRef.current;
    if (!slider) return;
    slider.scrollTo({ left: target * slider.clientWidth, behavior: "smooth" });
    setActive(target);
  };

  const handleScroll = () => {
    const slider = sliderRef.current;
    if (!slider?.clientWidth) return;
    setActive(Math.round(slider.scrollLeft / slider.clientWidth));
  };

  const handlePointerDown = (event) => {
    if (event.pointerType !== "mouse") return;
    const slider = sliderRef.current;
    dragRef.current = { active: true, startX: event.clientX, scrollLeft: slider.scrollLeft };
    setDragging(true);
    slider.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) return;
    const distance = event.clientX - dragRef.current.startX;
    sliderRef.current.scrollLeft = dragRef.current.scrollLeft - distance;
  };

  const handlePointerUp = (event) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    sliderRef.current.releasePointerCapture(event.pointerId);
    goTo(Math.round(sliderRef.current.scrollLeft / sliderRef.current.clientWidth));
  };

  return (
    <div className={`${styles.page} spmb-public`}>
      <Header />

      <main>
        <section className={styles.intro}>
          <div className="spmb-container">
            <Link href="/" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" /> Kembali ke beranda
            </Link>
            <div className={styles.introGrid}>
              <div>
                <p className={styles.eyebrow}><Images size={17} aria-hidden="true" /> Galeri Pondok</p>
                <h1>Melihat Assunnah lebih dekat.</h1>
              </div>
              <p className={styles.introCopy}>
                Dokumentasi lingkungan, fasilitas, dan ruang pendidikan yang mendukung
                aktivitas belajar serta keseharian para santri.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.gallerySection} aria-label="Slideshow galeri pondok">
          <div className="spmb-container">
            <div className={styles.galleryToolbar}>
              <div>
                <span className={styles.counter}>{String(active + 1).padStart(2, "0")}</span>
                <span className={styles.total}>/ {String(photos.length).padStart(2, "0")}</span>
              </div>
              <p>Geser foto untuk menjelajah</p>
              <div className={styles.controls}>
                <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Foto sebelumnya"><ArrowLeft size={20} /></button>
                <button type="button" onClick={() => goTo(active + 1)} disabled={active === photos.length - 1} aria-label="Foto selanjutnya"><ArrowRight size={20} /></button>
              </div>
            </div>

            <div
              ref={sliderRef}
              className={`${styles.slider} ${dragging ? styles.dragging : ""}`}
              onScroll={handleScroll}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {photos.map((photo, index) => (
                <article className={styles.slide} key={photo.src} aria-label={`${index + 1} dari ${photos.length}: ${photo.title}`}>
                  <Image
                    src={photo.src}
                    alt={photo.title}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 767px) calc(100vw - 32px), 1240px"
                    quality={75}
                    draggable={false}
                    style={{ objectPosition: photo.position }}
                  />
                  <span className={styles.slideShade} aria-hidden="true" />
                  <div className={styles.slideCaption}>
                    <p>{photo.category}</p>
                    <h2>{photo.title}</h2>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.thumbnails} aria-label="Pilih foto">
              {photos.map((photo, index) => (
                <button
                  type="button"
                  key={`thumb-${photo.src}`}
                  className={index === active ? styles.activeThumbnail : ""}
                  onClick={() => goTo(index)}
                  aria-label={`Lihat ${photo.title}`}
                  aria-current={index === active ? "true" : undefined}
                >
                  <Image src={photo.src} alt="" fill sizes="120px" quality={60} style={{ objectPosition: photo.position }} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
