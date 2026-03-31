// app/layout.js
import "./globals.css";

export const metadata = {
  title: "SPMB 2026",
  description: "Sistem Penerimaan Murid Baru Pondok Pondok pesantren Assunnah Lombok",
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