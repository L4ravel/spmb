import { siteUrl } from "@/lib/seo";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/landing-page/galery", priority: 0.6, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/TKDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/SDPutraDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/SDPutriDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/SMPPutraDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/SMPPutriDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/SMAPutraDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/SMAPutriDetail", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PPSULA", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PPSWUSTHO", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PPSULYA", priority: 0.8, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PGMIPutraDetail", priority: 0.7, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PGMIPutriDetail", priority: 0.7, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/MPIPutraDetail", priority: 0.7, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/MPIPutriDetail", priority: 0.7, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PIAUDPutraDetail", priority: 0.7, changeFrequency: "monthly" },
  { path: "/landing-page/jenjang/PIAUDPutriDetail", priority: 0.7, changeFrequency: "monthly" },
];

export default function sitemap() {
  const lastModified = new Date();

  return publicRoutes.map(({ path, ...entry }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    ...entry,
  }));
}
