"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

/* ====== Zona Waktu: WITA (Lombok) ====== */
const TZ_WITA = "Asia/Makassar";
const TZ_LABEL = "WITA";

/* ====== Utils ====== */
const isNISN = (v) => /^\d{8,12}$/.test(String(v || "").trim());
const toMs = (v) =>
  typeof v?.toMillis === "function" ? v.toMillis() : new Date(String(v)).getTime() || 0;

const fmtWITA = (ms) =>
  ms
    ? new Date(ms).toLocaleString("id-ID", {
        timeZone: TZ_WITA,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

/* Title-case ringan untuk nama */
const toTitle = (s) => {
  if (!s) return "";
  const low = s.toLowerCase();
  return low.replace(/\b([a-z\u00C0-\u024F]{2,})/g, (m) => m.charAt(0).toUpperCase() + m.slice(1));
};

/* Format ms → H:MM:SS (atau D hari H:MM:SS) untuk countdown */
const fmtCountdown = (ms) => {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const hms = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return days > 0 ? `${days} hari ${hms}` : hms;
};

/* RAW → UPPER_SNAKE_CASE aman */
const toSafeUpperSnake = (s) =>
  (s || "LAINNYA").toString().trim().toUpperCase().replace(/[^\w-]/g, "_");

export default function ConfirmUjianPage() {
  const router = useRouter();

  // user
  const [nisn, setNisn] = useState("");
  const [nama, setNama] = useState("Peserta");

  // jadwal: tampilkan levelRaw; levelSafe disiapkan untuk halaman tes
  // {id,title,levelRaw,levelSafe,startMs,endMs,active}
  const [schedule, setSchedule] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [paidOk, setPaidOk] = useState(false);
  const [completed, setCompleted] = useState(false);

  // UI states
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  // countdown
  const [tLeft, setTLeft] = useState(0);

  // Phase waktu
  const phase = useMemo(() => {
    if (!schedule) return "NOTREADY";
    if (!schedule.active) return "INACTIVE";
    if (!eligible || !paidOk) return "NOTREADY";
    if (completed) return "COMPLETED";
    const now = Timestamp.now().toMillis();
    if (now < schedule.startMs) return "BEFORE";
    if (now > schedule.endMs) return "AFTER";
    return "DURING";
  }, [schedule, eligible, paidOk, completed, tLeft]);

  const canStart = phase === "DURING";

  // ticker countdown
  useEffect(() => {
    if (!schedule?.startMs) return;
    const tick = () => {
      const now = Timestamp.now().toMillis();
      setTLeft(Math.max(schedule.startMs - now, 0));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [schedule?.startMs]);

  /* ====== Boot: ambil user & jadwal (Jenjang dari users_app) ====== */
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem("appUser");
        if (!raw) {
          router.replace("/login");
          return;
        }
        const u = JSON.parse(raw);
        const candidate = u?.username || u?.id || "";
        if (!isNISN(candidate)) {
          setReason("Data NISN tidak valid. Silakan login ulang.");
          setLoading(false);
          return;
        }
        setNisn(candidate);

        // users_app
        const userSnap = await getDoc(doc(db, "users_app", candidate));
        if (!userSnap.exists()) {
          setReason("Akun tidak ditemukan. Silakan hubungi panitia SPMB.");
          setLoading(false);
          return;
        }
        const d = userSnap.data() || {};

        // Nama utama dari DB
        const nameRaw =
          d.fullName ||
          d.namaLengkap ||
          d.name ||
          d.profile?.fullName ||
          u?.displayName ||
          u?.fullName ||
          u?.name ||
          "Peserta";
        setNama(toTitle(String(nameRaw).trim()));

        // status pembayaran & eligibility
        const paid =
          d.verifiedPayment === true ||
          d.registrationPaymentStatus === "verified" ||
          d.reRegistrationPaymentStatus === "verified";
        setPaidOk(paid);
        setEligible(d.examEligible === true);
        setCompleted(d.examStatus === "completed");

        // Jenjang: **SELALU** prioritaskan dari users_app.registrationLevel
        const levelRawFromUser = (d.registrationLevel || "").toString().trim();
        const levelSafeFromUser = levelRawFromUser ? toSafeUpperSnake(levelRawFromUser) : "";

        const scheduleId = d.examScheduleId;
        if (!scheduleId) {
          setReason(
            "Anda belum dijadwalkan pada gelombang ujian. Silakan menunggu penjadwalan dari admin."
          );
          setSchedule(null);
          setLoading(false);
          return;
        }

        // exam_schedules/{id}
        const schedSnap = await getDoc(doc(db, "exam_schedules", scheduleId));
        if (!schedSnap.exists()) {
          setReason(
            "Jadwal ujian belum ditentukan. Pemberitahuan akan diinformasikan melalui pengumaman di portal PPDB."
          );
          setSchedule(null);
          setLoading(false);
          return;
        }
        const s = schedSnap.data() || {};
        const startMs = toMs(s.windowStartAt) || toMs(d.examWindowStartAt);
        const endMs = toMs(s.windowEndAt) || toMs(d.examWindowEndAt);

        setSchedule({
          id: scheduleId,
          title: s.title || "Gelombang",
          // TAMPILKAN yang dari USER; jadikan level schedule hanya fallback jika user kosong
          levelRaw: levelRawFromUser || (s.level || ""),
          levelSafe: levelRawFromUser ? levelSafeFromUser : (s.level ? toSafeUpperSnake(s.level) : ""),
          startMs,
          endMs,
          active: s.active === true,
        });

        setReason("");
        setLoading(false);
      } catch (e) {
        console.error(e);
        setReason("Terjadi kesalahan saat memeriksa status ujian.");
        setLoading(false);
      }
    })();
  }, [router]);

  const goStart = () => {
    if (!canStart || !nisn) return;
    // Halaman tes akan membaca users_app lagi & memakai levelSafe untuk query soal
    router.push(`/tes-ujian/${nisn}`);
  };

  // skeleton saat loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header name="Memuat…" />
        <main className="mx-auto w-full max-w-3xl px-4 md:px-6 py-10 flex-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="mt-3 h-4 w-full bg-slate-200 rounded animate-pulse" />
            <div className="mt-2 h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const waktuRange =
    schedule?.startMs && schedule?.endMs
      ? `${fmtWITA(schedule.startMs)} — ${fmtWITA(schedule.endMs)}`
      : "—";

  // teks status berdasarkan phase
  const statusBlock = (() => {
    switch (phase) {
      case "INACTIVE":
        return {
          ok: false,
          title: "Status: Jadwal Nonaktif.",
          detail:
            "Jadwal ujian ini sedang nonaktif. Silakan ikuti informasi terbaru dari panitia.",
        };
      case "COMPLETED":
        return {
          ok: false,
          title: "Status: Ujian sudah selesai.",
          detail: "Anda telah menyelesaikan Tes Akademik.",
        };
      case "NOTREADY":
        return {
          ok: false,
          title: "Status: Belum dapat mengikuti tes.",
          detail:
            reason ||
            (!paidOk
              ? "Pembayaran belum diverifikasi."
              : !eligible
              ? "Anda belum diizinkan mengikuti Tes Akademik."
              : "Data belum lengkap."),
        };
      case "BEFORE":
        return {
          ok: false,
          title: "Status: Menunggu waktu mulai.",
          detail: `Tes akan dimulai pada ${fmtWITA(schedule.startMs)} (${TZ_LABEL}).`,
          countdown: true,
        };
      case "AFTER":
        return {
          ok: false,
          title: "Status: Waktu ujian telah berakhir.",
          detail: `Jadwal berakhir pada ${fmtWITA(schedule.endMs)} (${TZ_LABEL}).`,
        };
      case "DURING":
      default:
        return {
          ok: true,
          title: "Status: Siap mengikuti Tes Akademik.",
          detail:
            "Sistem telah memverifikasi pembayaran, izin ujian, keaktifan jadwal, dan jendela waktu.",
        };
    }
  })();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header name={nama} />

      <main className="mx-auto w-full max-w-3xl px-4 md:px-6 py-10 flex-1">
        <div className="rounded-2xl border border-violet-200 bg-white shadow-[0_15px_45px_rgba(24,0,75,.06)] p-6">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            Konfirmasi Tes Akademik SPMB
          </h1>

          <p className="mt-2 text-slate-600">
            Dimohon kepada peserta atas nama <b>{nama}</b> (NISN <b>{nisn}</b>) untuk membaca
            pemberitahuan berikut sebelum melanjutkan ke pelaksanaan Tes Akademik. Seluruh waktu
            ditampilkan dalam zona <b>WITA</b>.
          </p>

          {/* Ringkasan Jadwal */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3 text-black">
              <div className="text-sm text-slate-500">Gelombang</div>
              <div className="font-semibold">{schedule?.title || "—"}</div>
              {schedule?.levelRaw && (
                <div className="text-sm text-slate-600 mt-0.5">
                  Jenjang: {schedule.levelRaw}
                </div>
              )}
              <div className="text-xs text-slate-500 mt-2">Zona waktu: WITA</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-black">
              <div className="text-sm text-slate-500">Rentang Waktu</div>
              <div className="font-semibold">{waktuRange}</div>
              <div className="text-sm mt-0.5">
                Status Jadwal:{" "}
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                    schedule?.active
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                  ].join(" ")}
                >
                  {schedule?.active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </div>
          </div>

          {/* Tata tertib ringkas */}
          <ul className="mt-5 list-disc pl-5 text-slate-700 space-y-2">
            <li>Tes Akademik merupakan bagian resmi dari proses seleksi SPMB.</li>
            <li>Peserta wajib mengerjakan secara mandiri, jujur, dan tertib.</li>
            <li>Pastikan perangkat dan koneksi internet dalam kondisi baik.</li>
          </ul>

          {/* Kartu Status */}
          <div
            className="mt-6 rounded-lg border p-4"
            style={{
              borderColor: statusBlock.ok ? "rgb(5 150 105)" : "rgb(244 63 94)",
              background: statusBlock.ok ? "rgb(236 253 245)" : "rgb(254 242 242)",
              color: statusBlock.ok ? "rgb(6 95 70)" : "rgb(153 27 27)",
            }}
          >
            <div className="font-semibold">{statusBlock.title}</div>
            <div className="text-sm opacity-90 mt-1">{statusBlock.detail}</div>

            {/* Countdown saat BEFORE */}
            {statusBlock.countdown && (
              <div className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-2 text-slate-800 ring-1 ring-violet-400">
                <span className="text-sm mr-2">Mulai dalam:</span>
                <span className="font-mono text-lg font-bold tracking-widest">
                  {fmtCountdown(tLeft)}
                </span>
              </div>
            )}
          </div>

          {/* Tombol Aksi */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={goStart}
              disabled={!canStart}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-white font-semibold hover:bg-violet-700 disabled:opacity-60"
            >
              Lanjut ke Tes
            </button>
            <button
              onClick={() => router.push("/portal")}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-slate-700 font-semibold hover:bg-slate-50"
            >
              Kembali ke Portal
            </button>
          </div>

          {!statusBlock.ok && reason && (
            <p className="mt-4 text-sm text-slate-500">
              Jika diperlukan, silakan menghubungi panitia SPMB untuk konfirmasi status.
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
