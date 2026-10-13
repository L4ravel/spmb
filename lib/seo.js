const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://spmb.pontrenassunnah.com";

export const siteUrl = configuredUrl.replace(/\/$/, "");
export const siteName = "SPMB 2027 Assunnah Lombok";
export const defaultDescription =
  "Pendaftaran murid dan santri baru Pondok Pesantren Assunnah Lombok tahun pelajaran 2026/2027. Temukan informasi jenjang, persyaratan, biaya, dan cara pendaftaran.";

export const openGraphImage = {
  url: "/images/hero/pondok-assunnah-lapangan-1.webp",
  width: 1920,
  height: 1280,
  alt: "Lingkungan Pondok Pesantren Assunnah Lombok",
};

export function createPublicPageMetadata({ title, description, path }) {
  return {
    title: { absolute: `${title} | ${siteName}` },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      url: path,
      images: [openGraphImage],
    },
    twitter: {
      title: `${title} | ${siteName}`,
      description,
      images: [openGraphImage.url],
    },
  };
}
