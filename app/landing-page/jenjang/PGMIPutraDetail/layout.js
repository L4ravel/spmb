import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "PGMI Putra",
  description: "Informasi pendaftaran program Pendidikan Guru Madrasah Ibtidaiyah Putra di Assunnah Lombok.",
  path: "/landing-page/jenjang/PGMIPutraDetail",
});

export default function Layout({ children }) { return children; }
