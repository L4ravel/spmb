import "server-only";
import * as admin from "firebase-admin";

let _app;

/* —— Helper: normalize nama bucket —— */
function normalizeBucketName(name) {
  if (!name) return "";
  // buang prefix gs:// dan spasi tak perlu
  return String(name).replace(/^gs:\/\//i, "").trim();
}

/** Pastikan singleton Admin app */
export function getAdminApp() {
  if (!_app) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    const rawBucket   = process.env.FIREBASE_STORAGE_BUCKET || "";
    const storageBucket = normalizeBucketName(rawBucket);

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Env Firebase Admin tidak lengkap. Cek FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
      );
    }

    if (admin.apps.length === 0) {
      _app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        // set default bucket jika disediakan (boleh kosong, tidak wajib)
        ...(storageBucket ? { storageBucket } : {}),
      });
    } else {
      _app = admin.app();
    }
  }
  return _app;
}

/** Firestore instance */
export function getAdminDb() {
  return getAdminApp().firestore();
}

/** Alias siap pakai */
export const adminDb = getAdminDb();

/** Util Firestore */
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp  = admin.firestore.Timestamp;

/** Bucket Storage (ENV boleh .appspot.com / .firebasestorage.app / atau pakai default dari initializeApp) */
export function getAdminBucket() {
  const app = getAdminApp();

  // Prioritas: ENV (dinormalisasi), kalau kosong pakai default dari initializeApp
  const envName = normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET || "");
  const bucketName = envName || app.options?.storageBucket || "";

  if (!bucketName) {
    throw new Error(
      "Bucket tidak terkonfigurasi. Set FIREBASE_STORAGE_BUCKET=ppdp-lc.firebasestorage.app atau isi storageBucket saat initializeApp."
    );
  }

  return app.storage().bucket(bucketName);
}

export const adminBucket = getAdminBucket();

/** Ambil UID dari Authorization: Bearer <idToken> (opsional) */
export async function getUserIdFromReq(req) {
  try {
    getAdminApp();
    const header =
      (typeof req.headers?.get === "function" && (req.headers.get("authorization") || req.headers.get("Authorization"))) ||
      (typeof req.headers === "object" && (req.headers["authorization"] || req.headers["Authorization"])) ||
      "";

    const m = String(header).match(/^Bearer\s+(.+)$/i);
    if (!m) return null;

    const decoded = await admin.auth().verifyIdToken(m[1]);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

/** Default export admin agar impor lama tetap bekerja */
export default admin;
