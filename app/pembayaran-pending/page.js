"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import PortalHeader from "./Header";

// util
const cx = (...a) => a.filter(Boolean).join(" ");
const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function PembayaranPendingPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [uDoc, setUDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem("appUser") || "null");
    } catch {}
    if (!parsed?.id && !parsed?.username) {
      router.replace("/login");
      return;
    }
    const username = parsed.username || parsed.id;
    setUser({ id: username, username });

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users_app", username));
        if (!snap.exists()) {
          setErr("Akun tidak ditemukan. Hubungi panitia.");
          setLoading(false);
          return;
        }
        const data = snap.data();

        if (data.verifiedPayment === true || data.accountEnabled === true) {
          router.replace("/portal");
          return;
        }
        setUDoc({ id: snap.id, ...data });
      } catch (e) {
        console.error(e);
        setErr("Gagal memuat data akun.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasProof = !!uDoc?.registrationPaymentProof;
  const verified = uDoc?.verifiedPayment === true;
  const waitingReview =
    (uDoc?.registrationPaymentStatus || "").toLowerCase() !== "verified" &&
    hasProof;

  const statusBadge = useMemo(() => {
    if (verified)
      return (
        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-800 border-emerald-200">
          Terverifikasi
        </span>
      );
    if (waitingReview)
      return (
        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-amber-50 text-amber-800 border-amber-200">
          Menunggu verifikasi (1–3 hari kerja)
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-slate-50 text-slate-700 border-slate-200">
        Belum ada bukti pembayaran
      </span>
    );
  }, [verified, waitingReview]);

  async function handleUpload(file) {
    if (!user || !uDoc || !file) return;
    try {
      setErr("");
      setOk("");
      setBusy(true);
      setProgress(0);

      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `ppdb/payment_proofs/${user.username}-${Date.now()}.${ext}`;
      const task = uploadBytesResumable(sRef(storage, path), file, {
        cacheControl: "public,max-age=31536000",
      });

      task.on("state_changed", (snap) => {
        const p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setProgress(p);
      });

      await task;
      const url = await getDownloadURL(task.snapshot.ref);

      await updateDoc(doc(db, "users_app", user.username), {
        registrationPaymentProof: url,
        registrationPaymentStatus: "waiting_review",
        registrationPaymentProofAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setUDoc((prev) => ({
        ...prev,
        registrationPaymentProof: url,
        registrationPaymentStatus: "waiting_review",
      }));
      setOk("Bukti terkirim. Mohon tunggu 1–3 hari kerja untuk verifikasi.");
    } catch (e) {
      console.error(e);
      setErr("Gagal mengunggah bukti. Coba lagi.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function handleCancel() {
    if (!user || !uDoc || verified || !hasProof) return;
    try {
      setErr("");
      setOk("");
      setBusy(true);

      await updateDoc(doc(db, "users_app", user.username), {
        registrationPaymentProof: null,
        registrationPaymentStatus: "pending",
        updatedAt: serverTimestamp(),
      });

      setUDoc((prev) => ({
        ...prev,
        registrationPaymentProof: null,
        registrationPaymentStatus: "pending",
      }));
      setOk("Bukti dibatalkan. Anda bisa unggah ulang.");
    } catch (e) {
      console.error(e);
      setErr("Gagal membatalkan bukti.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="animate-pulse text-slate-600">Memuat…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-slate-50">
      {/* === Header dipanggil di atas === */}
      <PortalHeader user={user} />

       {/* kasih jarak biar ga nempel */}
    <div className="grid place-items-center px-4 mt-14">
      <div className="relative w-full max-w-5xl">
        <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />

          {/* Card rekening */}
          <div className="relative z-30 mb-6">
            <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="text-xs text-slate-500">Transfer Bank</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    Bank Syariah Indonesia
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500">Nama Pemilik</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    Ponpes As sunnah Bagek Nyaka
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500">No. Rekening</div>
                  <div className="mt-1 font-mono text-slate-900 text-lg">
                    1234 5678 9012
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText("123456789012")}
                    className="rounded-md bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 text-sm font-medium"
                  >
                    Salin Nomor Rekening
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Layout utama */}
          <div className="relative flex flex-col-reverse lg:grid lg:grid-cols-2 rounded-[26px] bg-white ring-1 ring-slate-200 overflow-visible">
            {/* kolom kiri (form) */}
            <div className="relative z-20 p-8 md:p-10">
              <h2 className="text-2xl font-extrabold text-slate-900">
                Akun Belum Terverifikasi
              </h2>
              <p className="mt-2 text-slate-600">
                Untuk mendapatkan <b>akses penuh</b>, wali murid perlu
                menyelesaikan pembayaran pendaftaran terlebih dahulu.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Username: <span className="font-mono">{user?.username}</span>
              </p>
              <div className="mt-3">{statusBadge}</div>

              {/* upload bukti */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-700">
                  Silakan unggah <b>bukti pembayaran</b> (gambar/PDF).
                  Biaya pendaftaran <b>{fmtIDR(200_000)}</b>.
                </div>

                {!hasProof ? (
                  <div className="mt-3 flex items-center gap-2">
                    <label
                      className={cx(
                        "inline-flex items-center gap-2 rounded-lg text-black border px-3 py-2 cursor-pointer text-sm",
                        busy
                          ? "opacity-60 pointer-events-none"
                          : "hover:bg-white",
                        "border-slate-300 bg-white"
                      )}
                    >
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files?.[0])}
                        disabled={busy}
                      />
                      {busy ? (
                        <span>Mengunggah… {progress}%</span>
                      ) : (
                        <span>Upload Bukti</span>
                      )}
                    </label>
                    <span className="text-xs text-slate-500">
                      Maksimal 10MB. Format: JPG/PNG/PDF.
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a
                      href={uDoc.registrationPaymentProof}
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-700 underline text-sm"
                    >
                      Lihat bukti
                    </a>
                    <button
                      onClick={handleCancel}
                      disabled={verified || busy}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                    >
                      Batalkan Bukti
                    </button>
                  </div>
                )}
              </div>

              {err && (
                <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900">
                  {err}
                </div>
              )}
              {ok && (
                <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
                  {ok}
                </div>
              )}
            </div>

            {/* kolom kanan (panel ungu) */}
            <div className="relative isolate overflow-hidden rounded-tr-[26px] rounded-br-[26px]">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 to-violet-600" />
              <div className="hidden md:block absolute -left-25 top-0 h-full w-32 rounded-r-[60px] bg-white -z-10 pointer-events-none" />
              <div className="relative z-10 h-full p-8 md:p-10 text-white flex flex-col items-center justify-center text-center">
                <h3 className="text-3xl font-extrabold">Konfirmasi Pembayaran</h3>
                <p className="mt-3 text-indigo-100 max-w-sm">
                  Unggah bukti pembayaran untuk mengaktifkan akun. Setelah
                  diverifikasi, Anda bisa mengakses seluruh fitur portal.
                </p>
                <Link
                  href="/app/portal"
                  className={cx(
                    "mt-6 rounded-full px-6 py-2 font-semibold transition",
                    verified
                      ? "bg-white text-indigo-700 hover:bg-indigo-50"
                      : "bg-white/40 text-white cursor-not-allowed"
                  )}
                >
                  {verified ? "Buka Portal" : "Menunggu Verifikasi"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
