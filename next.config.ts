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
      {
        source: "/login",
        destination: "https://ahsan.pontrenassunnah.com/login",
        permanent: false,
      },
      {
        source: "/spmb",
        destination: "https://ahsan.pontrenassunnah.com/spmb/daftar",
        permanent: false,
      },
      {
        source: "/brosur",
        destination:
          "https://firebasestorage.googleapis.com/v0/b/sidip-4b28d.firebasestorage.app/o/spmb%2Fbrosur%2FBrosur%20spmb%202027-2028%20.pdf?alt=media&token=52764724-3251-4651-8d91-4192d53b671b",
        permanent: true,
      },
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
