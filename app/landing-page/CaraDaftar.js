"use client";

import { MousePointerClick, FileText, LogIn, Wallet, Upload, CheckCircle } from "lucide-react";
import Link from "next/link";

const STEPS_ONLINE = [
  { no: 1, title: "Klik Tombol Daftar Sekarang", desc: "Klik tombol daftar sekarang yang tersedia di website.", icon: MousePointerClick },
  { no: 2, title: "Mengisi Data dan Upload Berkas", desc: "Mengisi data diri dan upload berkas yang diminta.", icon: FileText },
  { no: 3, title: "Login ke Akun Anda", desc: "Login menggunakan username dan password yang diberikan.", icon: LogIn },
  { no: 4, title: "Melakukan Pembayaran", desc: "Melakukan pembayaran melalui rekening yang tersedia.", icon: Wallet },
  { no: 5, title: "Upload Bukti Pembayaran", desc: "Upload bukti pembayaran setelah login.", icon: Upload },
  { no: 6, title: "Verifikasi dan Ujian", desc: "Setelah diverifikasi, selanjutnya peserta memilih waktu ujian yang telah ditentukan oleh panitia.", icon: CheckCircle },
];
const STEPS_OFFLINE = [
  { no: 1, title: "Datang ke Stand Pendaftaran", desc: "Datang ke stand pendaftaran yang berada di pondok.", icon: MousePointerClick },
  { no: 2, title: "Membawa Semua Berkas", desc: "Membawa semua berkas persyaratan (direkomendasikan dalam bentuk file).", icon: FileText },
  { no: 3, title: "Panitia Membantu Upload", desc: "Panitia akan membantu upload data dan berkas ke website.", icon: Upload },
  { no: 4, title: "Menerima Akun Login", desc: "Panitia akan memberi akun untuk login.", icon: LogIn },
  { no: 5, title: "Pembayaran ke Panitia", desc: "Melakukan proses pembayaran ke panitia.", icon: Wallet },
  { no: 6, title: "Verifikasi dan Ujian", desc: "Setelah diverifikasi, selanjutnya peserta memilih waktu ujian yang telah ditentukan oleh panitia.", icon: CheckCircle },
];

const ONLINE_HELP = [
  "Buka formulir Ahsan, lalu pilih klasifikasi Reguler, LKSA, atau STIT sesuai tujuan pendidikan.",
  "Periksa kembali nama, identitas, dan nomor WhatsApp. Persyaratan berkas mengikuti program yang dipilih di formulir Ahsan.",
  "Simpan informasi akun yang diberikan setelah pendaftaran. Gunakan halaman Login Ahsan untuk masuk.",
  "Ikuti instruksi pembayaran dan periksa tujuan rekening di akun Ahsan sebelum melakukan transfer.",
  "Pastikan foto bukti pembayaran jelas dan simpan bukti asli sampai proses verifikasi selesai.",
  "Pantau status dan petunjuk berikutnya di akun Ahsan. Hubungi panitia jika membutuhkan bantuan.",
];
const OFFLINE_HELP = [
  "Periksa alamat dan jam pelayanan pada bagian Layanan Informasi sebelum berkunjung.",
  "Siapkan identitas dan berkas sesuai program tujuan. Hubungi panitia terlebih dahulu jika belum yakin dengan persyaratannya.",
  "Panitia membantu pengisian formulir. Periksa kembali data bersama panitia sebelum dikirim.",
  "Simpan informasi akun agar dapat memantau proses pendaftaran di Ahsan.",
  "Ikuti arahan panitia dan simpan bukti pembayaran yang diterima.",
  "Pantau informasi melalui akun Ahsan atau tanyakan perkembangan pendaftaran kepada panitia.",
];

function StepCard({ no, title, desc, icon: Icon, help }) {
  return (
    <article className="spmb-step-item">
      <div className="spmb-step-top"><span>{no}</span><Icon aria-hidden="true" size={22} strokeWidth={1.5} /></div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <details className="spmb-step-help"><summary>Lihat petunjuk</summary><p>{help}</p></details>
    </article>
  );
}

export default function CaraDaftar() {
  return (
    <>
      <section className="spmb-section spmb-online-section">
        <div className="spmb-wide-panel spmb-online-panel">
          <div className="spmb-panel-heading">
            <div>
              <p className="spmb-eyebrow">Panduan Pendaftaran</p>
              <h2 className="spmb-display-title">Cara Daftar Online</h2>
            </div>
            <p>Ikuti langkah-langkah berikut untuk menyelesaikan pendaftaran secara online</p>
          </div>
          <div className="spmb-online-grid">{STEPS_ONLINE.map((step, index) => <StepCard key={step.no} {...step} help={ONLINE_HELP[index]} />)}</div>
        </div>
      </section>
      <section className="spmb-section spmb-offline-section">
        <div className="spmb-container spmb-preparation-layout">
          <div>
            <p className="spmb-eyebrow">Alternatif Pendaftaran</p>
            <h2 className="spmb-display-title">Cara Daftar Offline</h2>
            <p className="spmb-section-copy">Daftar langsung di stand pendaftaran pondok dengan bantuan panitia</p>
          </div>
          <div className="spmb-offline-grid">{STEPS_OFFLINE.map((step, index) => <StepCard key={step.no} {...step} help={OFFLINE_HELP[index]} />)}</div>
        </div>
        <div className="spmb-container spmb-offline-note">
          <p>Ingin mendaftar secara offline?</p>
          <div>
            <p>Kunjungi stand pendaftaran di pondok dan bawa semua berkas persyaratan</p>
            <p>💡 Tips: Siapkan berkas dalam bentuk file digital untuk memudahkan proses</p>
          </div>
        </div>
      </section>
      <section className="spmb-section spmb-registration-cta">
        <div className="spmb-container spmb-cta-layout">
          <div>
            <p className="spmb-display-title">Siap untuk mendaftar online?</p>
            <p className="spmb-section-copy">Mulai perjalanan pendidikan Anda bersama kami</p>
          </div>
          <Link href="https://ahsan.pontrenassunnah.com/spmb/daftar" className="spmb-button spmb-button-green">Daftar Sekarang</Link>
        </div>
      </section>
    </>
  );
}
