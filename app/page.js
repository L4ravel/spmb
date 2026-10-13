import Header from "./landing-page/header";
import Hero from "./landing-page/hero";
import Footer from "./landing-page/footer";
import {
  defaultDescription,
  openGraphImage,
  siteName,
  siteUrl,
} from "@/lib/seo";

export const metadata = {
  title: { absolute: "SPMB 2027 Pondok Pesantren Assunnah Lombok" },
  description: defaultDescription,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "SPMB 2027 Pondok Pesantren Assunnah Lombok",
    description: defaultDescription,
    url: "/",
    images: [openGraphImage],
  },
  twitter: {
    title: "SPMB 2027 Pondok Pesantren Assunnah Lombok",
    description: defaultDescription,
    images: [openGraphImage.url],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": `${siteUrl}/#organization`,
      name: "Pondok Pesantren Assunnah Lombok",
      alternateName: "Ponpes Assunnah Lombok",
      url: siteUrl,
      logo: `${siteUrl}/logo/spmb.png`,
      image: `${siteUrl}${openGraphImage.url}`,
      telephone: "+62-877-2024-2025",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Jln. TGH. Jamaluddin Bagik Nyaka Santri",
        addressLocality: "Aikmel",
        addressRegion: "Nusa Tenggara Barat",
        addressCountry: "ID",
      },
      sameAs: [
        "https://www.instagram.com/pontren_assunnah/",
        "https://www.youtube.com/@AdmissionPonpesAssunnah",
        "https://web.facebook.com/ponpesassunnahlombok",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      description: defaultDescription,
      inLanguage: "id-ID",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export default function Page() {
  return (
    <main className="spmb-public min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Header />
      <Hero />     
      <Footer />
    </main>
  );
}
