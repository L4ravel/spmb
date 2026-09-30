export function normalizeRegistrationPaymentStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeRegistrationPaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();
  return method === "online" || method === "offline" ? method : "";
}

// Satu-satunya aturan pembayaran pendaftaran yang dianggap sah untuk laporan.
// Dua field dipertahankan sebagai fallback agar data lama tetap terbaca.
export function isVerifiedRegistrationPayment(row) {
  return (
    row?.verifiedPayment === true ||
    normalizeRegistrationPaymentStatus(row?.registrationPaymentStatus) === "verified"
  );
}

export function isPendingRegistrationPayment(row) {
  return (
    !isVerifiedRegistrationPayment(row) &&
    normalizeRegistrationPaymentStatus(row?.registrationPaymentStatus) === "waiting_review"
  );
}

export function firestoreDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function registrationCreatedDate(row) {
  return firestoreDate(row?.createdAt || row?.registrationCreatedAt);
}

export function registrationPaymentDate(row) {
  return firestoreDate(
    row?.registrationPaymentVerifiedAt ||
    row?.registrationPaymentProofAt ||
    row?.updatedAt ||
    row?.createdAt
  );
}
