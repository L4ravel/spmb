import { defaultDescription, openGraphImage } from "@/lib/seo";

export const metadata = {
  title: "Program Pendidikan",
  description: defaultDescription,
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
    title: "Program Pendidikan Pondok Pesantren Assunnah Lombok",
    description: defaultDescription,
    images: [openGraphImage],
  },
};

export default function PublicInformationLayout({ children }) {
  return children;
}
