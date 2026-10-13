import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "MPI Putra",
  description: "Informasi pendaftaran program Manajemen Pendidikan Islam Putra di Assunnah Lombok.",
  path: "/landing-page/jenjang/MPIPutraDetail",
});

export default function Layout({ children }) { return children; }
