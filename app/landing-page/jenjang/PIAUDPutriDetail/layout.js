import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "PIAUD Putri",
  description: "Informasi pendaftaran program Pendidikan Islam Anak Usia Dini Putri di Assunnah Lombok.",
  path: "/landing-page/jenjang/PIAUDPutriDetail",
});

export default function Layout({ children }) { return children; }
