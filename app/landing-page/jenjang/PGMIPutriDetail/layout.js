import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "PGMI Putri",
  description: "Informasi pendaftaran program Pendidikan Guru Madrasah Ibtidaiyah Putri di Assunnah Lombok.",
  path: "/landing-page/jenjang/PGMIPutriDetail",
});

export default function Layout({ children }) { return children; }
