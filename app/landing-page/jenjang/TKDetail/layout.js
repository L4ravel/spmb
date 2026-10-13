import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "TK Islam Assunnah",
  description: "Informasi pendaftaran, persyaratan, dan biaya TK Islam Assunnah Lombok tahun pelajaran 2026/2027.",
  path: "/landing-page/jenjang/TKDetail",
});

export default function Layout({ children }) { return children; }
