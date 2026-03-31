"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import { db, storage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  limit,
  onSnapshot, // ⬅️ REALTIME LISTENER
} from "firebase/firestore";
import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

/* ====== WA util/komponen (tetap) ====== */
import { KonfirmasiWaButton, toWaChatLink } from "./wa";
/* ====== Konten simpel aktivasi (tetap) ====== */
import Simple from "./simple";

/* ================= Utils ================= */
const cx = (...a) => a.filter(Boolean).join(" ");
const fmtIDR = (n, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const SESSION_COOKIE = "ppdb_session";
function readSessionCookie() {
  try {
    const ck = document.cookie
      .split("; ")
      .find((c) => c.startsWith(SESSION_COOKIE + "="))
      ?.split("=")[1];
    if (!ck) return null;
    const json = atob(decodeURIComponent(ck));
    return JSON.parse(json || "{}");
  } catch {
    return null;
  }
}
function writeSessionCookie(s, maxAgeDays = 7) {
  try {
    const payload = encodeURIComponent(btoa(JSON.stringify(s || {})));
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${SESSION_COOKIE}=${payload}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {}
}

/* ================= Body Scroll Lock ================= */
function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/* ================= Modal Preview Bukti ================= */
function PreviewModal({ open, src, onClose }) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const isPDF = typeof src === "string" && /\.pdf(\?|$)/i.test(src);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-[1001] w-[96vw] max-w-4xl max-h-[88vh] rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">Pratinjau Bukti Pembayaran</h4>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800">Tutup</button>
        </div>
        <div className="bg-slate-50 p-3">
          <div className="w-full h-[70vh] rounded-lg bg-white overflow-auto">
            {isPDF ? (
              <iframe src={src} title="Bukti Pembayaran (PDF)" className="w-full h-full" />
            ) : (
              <div className="w-full h-full grid place-items-center p-2">
                <img src={src} alt="Bukti Pembayaran" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 text-xs text-slate-500">
          <span>Jika gambar tidak tampil, pastikan koneksi stabil atau unggah ulang.</span>
          <a href={src} download className="underline hover:text-slate-700">Unduh file</a>
        </div>
      </div>
    </div>
  );
}

/* ================= Modal Tutorial ================= */
function TutorialModal({ open, onClose, jumlah, rekening }) {
  const [copied, setCopied] = useState(false);
  useBodyScrollLock(open);

  const cleanNumber = String(rekening?.number || "").replace(/\D/g, "");
  const visibleText = String(rekening?.number || cleanNumber);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const copyRekening = async () => {
    try {
      if (!cleanNumber) return;
      await navigator.clipboard.writeText(cleanNumber);
      setCopied(true);
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[1001] w-[92vw] max-w-[640px] md:w-[640px] h-[72vh] md:h-[520px] rounded-3xl bg-white/90 backdrop-blur-sm shadow-xl overflow-hidden animate-fade-in-up flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-base font-bold text-slate-900">Tutorial Pembayaran</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700" aria-label="Tutup">✕</button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-700">
            <li>Buka aplikasi <b>m-banking/ ATM/ BSI/ ke-Alfamart/ Indomaret terdekat</b>.</li>
            <li>
              Transfer ke rekening: <b>{rekening?.bank}</b> a.n. <b>{rekening?.owner}</b> —{" "}
              <button
                type="button"
                onClick={copyRekening}
                className="inline-flex items-center gap-1 align-middle rounded-md border px-2 py-1 text-[13px] font-mono
                           border-emerald-300 bg-emerald-50 text-emerald-800
                           hover:bg-emerald-100 active:bg-emerald-200
                           focus:outline-none focus:ring-2 focus:ring-emerald-300"
                title="Klik untuk menyalin nomor rekening"
                aria-label={`Salin nomor rekening ${cleanNumber}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="shrink-0">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2"></path>
                </svg>
                <span>{visibleText}</span>
              </button>
              {copied && (
                <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border
                                  bg-emerald-50 border-emerald-200 text-emerald-700 select-none">
                  Disalin
                </span>
              )}
            </li>
            <li>Jumlah transfer: <b>{jumlah}</b> (pastikan nominal sesuai).</li>
            <li>Simpan struk/screenshot bukti pembayaran.</li>
            <li>Kembali ke halaman ini, klik <b>Upload Bukti</b> lalu pilih file bukti.</li>
            <li>Setelah terunggah, klik <b>Konfirmasi WA</b> untuk lapor ke panitia.</li>
          </ol>

          <div className="mt-4 text-xs text-center text-slate-600">
            Verifikasi 1–3 hari kerja. Jika ada kendala, hubungi panitia via WA.
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-sm font-semibold">
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Modal Tentang Akun ================= */
function AccountInfoModal({ open, onClose }) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[1001] w-[92vw] max-w-[640px] md:w-[640px] h-[72vh] md:h-[520px] rounded-3xl bg-white/90 backdrop-blur-sm shadow-xl overflow-hidden animate-fade-in-up flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-base font-bold text-slate-900">Kegunaan Akun</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-700">
            Akun ini digunakan untuk mengikuti <b>tes akademik online</b> <i>(kecuali jenjang TK, SD dan PPS ULA)</i>.
          </p>

          <p className="mt-2 text-sm text-slate-700">
            Selain itu, akun calon peserta didik dipergunakan untuk melihat <b>informasi kelulusan</b>,
            melakukan <b>daftar ulang</b>, serta <b>bergabung ke grup WhatsApp</b> resmi.
          </p>

          <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-slate-700">
            <li>Harap menjaga kerahasiaan <b>username</b> dan <b>password</b>.</li>
            <li>Pastikan nomor WhatsApp aktif agar jadwal ujian dan informasi terkirim tepat waktu.</li>
            <li>Apabila mengalami kendala akses, silakan menghubungi panitia melalui WhatsApp pada bagian bantuan.</li>
          </ul>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-sm font-semibold">
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Page ================= */
function PembayaranPendingInner() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [uDoc, setUDoc] = useState(null);
  const [feeInfo, setFeeInfo] = useState({ fee: null, currency: "IDR", label: null });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [waPrivateLink, setWaPrivateLink] = useState("");
  const [waLabel, setWaLabel] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // === Flags untuk mencegah double-load & double-redirect
  const feesLoadedRef = useRef(false);
  const redirectedRef = useRef(false);

  /* ==== INIT + REALTIME LISTENER ==== */
  useEffect(() => {
    let unsub = null;
    (async () => {
      // ambil user lokal
      let parsed = null;
      try { parsed = JSON.parse(localStorage.getItem("appUser") || "null"); } catch {}
      if (!parsed?.id && !parsed?.username) {
        router.replace("/login");
        return;
      }
      const username = parsed.username || parsed.id;
      setUser({ id: username, username });

      try {
        const userRef = doc(db, "users_app", username);

        // ——— REALTIME: pantau perubahan dokumen user ———
        unsub = onSnapshot(userRef, async (snap) => {
          if (!snap.exists()) {
            setErr("Akun tidak ditemukan. Hubungi panitia.");
            setUDoc(null);
            setLoading(false);
            return;
          }

          const data = snap.data() || {};
          setUDoc({ id: snap.id, ...data });

          // Muat fee & WA Group sekali ketika level tersedia
          if (!feesLoadedRef.current && data?.registrationLevel) {
            feesLoadedRef.current = true;
            try {
              // fees
              const feeQ = query(
                collection(db, "fees"),
                where("label", "==", String(data.registrationLevel)),
                limit(1)
              );
              const feeSnap = await getDocs(feeQ);
              if (!feeSnap.empty) {
                const f = feeSnap.docs[0].data();
                setFeeInfo({
                  fee: Number(f?.fee ?? 0),
                  currency: String(f?.currency || "IDR"),
                  label: String(f?.label || data.registrationLevel),
                });
              } else {
                setFeeInfo((p) => ({ ...p, fee: 0, label: data.registrationLevel }));
              }

              // wa groups
              try {
                const waQ = query(
                  collection(db, "wa_groups"),
                  where("label", "==", String(data.registrationLevel)),
                  limit(1)
                );
                const waSnap = await getDocs(waQ);
                if (!waSnap.empty) {
                  const w = waSnap.docs[0].data() || {};
                  const finalLink = w?.privateLink || toWaChatLink(w?.private || "");
                  setWaPrivateLink(finalLink || "");
                  setWaLabel(String(w?.label || data.registrationLevel));
                } else {
                  setWaPrivateLink("");
                  setWaLabel(String(data.registrationLevel || ""));
                }
              } catch {
                setWaPrivateLink("");
                setWaLabel(String(data.registrationLevel || ""));
              }
            } catch {
              setErr("Gagal memuat data akun/biaya.");
            }
          }

          // Jika diverifikasi → update cookie & redirect (sekali saja)
          const status = String(data?.registrationPaymentStatus || "").trim().toLowerCase();

if (status === "verified" && !redirectedRef.current) {
  redirectedRef.current = true;

  // update session cookie dulu supaya middleware/portal langsung kenal
  const sess = readSessionCookie() || {};
  const nextSess = {
    ...sess,
    id: sess?.id || username,
    username: sess?.username || username,
    registrationPaymentStatus: "verified",
    verifiedPayment: true,
    accountEnabled: true,
  };
  writeSessionCookie(nextSess, 7);

  // hindari race dengan render
  Promise.resolve().then(() => router.replace("/portal"));
}

          setLoading(false);
        });
      } catch {
        setErr("Gagal memuat data akun/biaya.");
        setLoading(false);
      }
    })();

    return () => {
      try { unsub && unsub(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasProof = !!uDoc?.registrationPaymentProof;
  const statusStr = String(uDoc?.registrationPaymentStatus || "").toLowerCase();
  const isVerifiedFS =
    uDoc?.verifiedPayment === true || uDoc?.accountEnabled === true || statusStr === "verified";
  const waitingReview = !isVerifiedFS && hasProof;

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
    } catch {
      setErr("Gagal mengunggah bukti. Coba lagi.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function handleCancel() {
    if (!user || !uDoc || isVerifiedFS || !hasProof) return;
    try {
      setErr("");
      setOk("");
      setBusy(true);

      try {
        const delRef = sRef(storage, uDoc.registrationPaymentProof);
        await deleteObject(delRef);
      } catch {}

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
    } catch {
      setErr("Gagal membatalkan bukti.");
    } finally {
      setBusy(false);
    }
  }

  function UploadButton({ disabled }) {
    const uploaded = !!uDoc?.registrationPaymentProof;
    const isDisabled = disabled || busy || uploaded;

    return (
      <label
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm h-10 w-full sm:w-auto",
          isDisabled ? "opacity-80 pointer-events-none" : "hover:bg-white",
          uploaded
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-slate-300 bg-white text-black"
        )}
        title={uploaded ? "Bukti sudah diunggah" : "Unggah bukti pembayaran"}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
          disabled={isDisabled}
        />

        {/* Ikon status */}
        {busy ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
              viewBox="0 0 24 24" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.2"/>
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        ) : uploaded ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M20 6L9 17l-5-5" strokeWidth="2" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 3v12m0-12l-4 4m4-4l4 4M3 21h18" strokeWidth="2"/>
          </svg>
        )}

        <span aria-live="polite">
          {busy
            ? `Mengunggah… ${progress}%`
            : uploaded
            ? "Bukti telah diunggah"
            : "Upload Bukti"}
        </span>
      </label>
    );
  }

  function openPreview() {
    if (!uDoc?.registrationPaymentProof) return;
    setPreviewSrc(uDoc.registrationPaymentProof);
    setPreviewOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="animate-pulse text-slate-600">Memuat…</div>
      </div>
    );
  }

  const showFee = feeInfo.fee != null;

  /* ====== Data rekening (tetap untuk tutorial) ====== */
  const rekeningView = {
    bank: "Bank Syariah Indonesia",
    owner: "Spmb Pas",
    number: "111 115 7778",
  };

  const helpLink = waPrivateLink || "https://wa.me/6287720242025";

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-orange-100/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-orange-100/20 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <Header />

      <div className="relative mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* ====== SINGLE CARD ====== */}
        <div className="rounded-3xl border border-slate-200/60 bg-white/90 backdrop-blur-sm shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in-up">
          {/* Header Card */}
          <div className="text-center pt-4 px-3">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full mb-4 shadow-xl shadow-orange-500/25 animate-scale-in">
              <span className="text-white text-2xl font-bold select-none">i</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-1 tracking-tight">
              Status <span className="text-orange-600">Pembayaran</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
              Unggah bukti pembayaran untuk menyelesaikan proses pendaftaran
            </p>
          </div>

          <div className="mx-6 my-6 border-t border-slate-200" />

          {/* BAR ATAS: 2 tombol kanan */}
          <div className="px-6 pb-2 flex items-center justify-end md:justify-center gap-2 text-black">
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="inline-flex h-14 w-48 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 text-center"
            >
              <span className="leading-tight">Kegunaan Akun</span>
            </button>

            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="inline-flex h-14 w-48 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 text-center"
            >
              <span className="leading-tight">Tutorial Pembayaran</span>
            </button>
          </div>

          {/* Konten Simple */}
          <div className="px-4 sm:px-6 pb-2">
            <Simple
              className="w-full"
              userUsername={user?.username}
              badgeNode={null}
              showFee={showFee}
              feeInfo={feeInfo}
              registrationLevel={uDoc?.registrationLevel}
              UploadButtonComponent={UploadButton}
              fmtIDR={fmtIDR}
              hasProof={!!uDoc?.registrationPaymentProof}
              isVerifiedFS={isVerifiedFS}
              busy={busy}
              onOpenPreview={openPreview}
              onCancel={handleCancel}
              konfirmasiProps={{
                hasProof: !!uDoc?.registrationPaymentProof,
                waPrivateLink: helpLink,
                waLabel,
                fullName: uDoc?.fullName,
                nisn: uDoc?.nisn || user?.username,
                amount: feeInfo?.fee,
                label: feeInfo?.label || uDoc?.registrationLevel,
              }}
            />
          </div>

          {/* Pesan + Bantuan WA */}
          <div className="px-6 pb-6">
            {err && (
              <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {err}
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-center">
              <div className="mt-0">
                <p className="text-xs text-slate-500">Butuh bantuan?</p>
                <a
                  href={helpLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-semibold text-green-700 hover:underline mt-1"
                >
                  (+62) 877&nbsp;2024&nbsp;2025
                </a>
                <p className="text-[11px] text-slate-500 mt-1">
                  WhatsApp Panitia SPMB — klik nomor untuk chat
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-5deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          33% { transform: translate(-30px, 30px) rotate(-5deg); }
          66% { transform: translate(20px, -20px) rotate(5deg); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-scale-in { animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-float { animation: float 20s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 25s ease-in-out infinite; }
        .animation-delay-200 { animation-delay: 200ms; }
        .animation-delay-400 { animation-delay: 400ms; }
      `}</style>

      {/* Modals */}
      <PreviewModal open={previewOpen} src={previewSrc} onClose={() => setPreviewOpen(false)} />
      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        jumlah={fmtIDR(feeInfo?.fee, feeInfo?.currency)}
        rekening={rekeningView}
      />
      <AccountInfoModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </div>
  );
}

export default function PembayaranPendingPage() {
  return (
    <Suspense fallback={null}>
      <PembayaranPendingInner />
    </Suspense>
  );
}
