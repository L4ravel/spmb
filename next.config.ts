import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,


  // 🔓 Lewatkan error TypeScript saat build (sementara).
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    // remotePatterns: [
    //   { protocol: "https", hostname: "images.example.com" },
    // ],
  },

  output: "standalone",

  async redirects() {
    return [
      // { source: "/spmb-old", destination: "/spmb", permanent: true },
    ];
  },

  async rewrites() {
    return [
      // { source: "/api/internal/:path*", destination: "https://api.example.com/:path*" },
    ];
  },

  webpack: (config) => {
    // SVGR contoh (aktifkan jika perlu)
    // config.module.rules.push({
    //   test: /\.svg$/i,
    //   issuer: /\.[jt]sx?$/,
    //   use: [{ loader: "@svgr/webpack", options: { icon: true } }],
    // });
    return config;
  },
};

export default nextConfig;
