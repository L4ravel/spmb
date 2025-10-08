// app/layout.js
import "./globals.css";

export const metadata = {
  title: "PPDB 2025",
  description: "Penerimaan Peserta Didik Baru 2025/2026",
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
