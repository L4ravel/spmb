import { siteUrl } from "@/lib/seo";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/landing-page/"],
      disallow: [
        "/admin",
        "/api",
        "/portal",
        "/login",
        "/spmb",
        "/daftar-ulang",
        "/hasil-ujian",
        "/hasil-pengumuman",
        "/tes-ujian",
        "/tes-akademik",
        "/surat-digital",
        "/pembayaran-pending",
        "/ganti-password",
        "/confirm-ujian",
        "/cek-daftar-ulang",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
