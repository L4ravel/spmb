import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Galeri",
  description: "Lihat lingkungan, fasilitas, dan kegiatan pendidikan di Pondok Pesantren Assunnah Lombok.",
  path: "/landing-page/galery",
});

export default function GalleryLayout({ children }) {
  return children;
}
