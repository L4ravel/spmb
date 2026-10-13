import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "MPI Putri",
  description: "Informasi pendaftaran program Manajemen Pendidikan Islam Putri di Assunnah Lombok.",
  path: "/landing-page/jenjang/MPIPutriDetail",
});

export default function Layout({ children }) { return children; }
