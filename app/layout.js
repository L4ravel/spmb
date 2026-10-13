// app/layout.js
import "./globals.css";

import {
  defaultDescription,
  openGraphImage,
  siteName,
  siteUrl,
} from "@/lib/seo";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | Pondok Pesantren Assunnah Lombok`,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  authors: [{ name: "Pondok Pesantren Assunnah Lombok", url: siteUrl }],
  creator: "Pondok Pesantren Assunnah Lombok",
  publisher: "Pondok Pesantren Assunnah Lombok",
  category: "education",
  keywords: [
    "SPMB 2027",
    "penerimaan murid baru",
    "Pondok Pesantren Assunnah Lombok",
    "sekolah Islam Lombok",
    "pesantren Lombok Timur",
    "pendaftaran santri baru",
  ],
  icons: {
    icon: "/favicon.ico",
    apple: "/logo/spmb.png",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Halaman akun, admin, ujian, dan data peserta mewarisi noindex ini.
  // Halaman informasi publik mengaktifkan indexing pada layout/page masing-masing.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: siteUrl,
    siteName,
    title: `${siteName} | Pondok Pesantren Assunnah Lombok`,
    description: defaultDescription,
    images: [openGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} | Pondok Pesantren Assunnah Lombok`,
    description: defaultDescription,
    images: [openGraphImage.url],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      {/* antialiased: font lebih halus; bg pakai kelas yang pasti ada */}
      <body className="min-h-screen bg-white antialiased">
        {children}
      </body>
    </html>
  );
}
