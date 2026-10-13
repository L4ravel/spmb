import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "PIAUD Putra",
  description: "Informasi pendaftaran program Pendidikan Islam Anak Usia Dini Putra di Assunnah Lombok.",
  path: "/landing-page/jenjang/PIAUDPutraDetail",
});

export default function Layout({ children }) { return children; }
