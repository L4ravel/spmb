// app/admin/useAuthEmail.ts
"use client";

import { useEffect, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

/**
 * Pastikan Firebase App client ter-init sebelum getAuth().
 * Idempotent (tidak re-init saat HMR) & hanya berjalan di browser.
 */
function ensureFirebaseClient() {
  if (typeof window === "undefined") return; // jangan init di server
  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }
}

/**
 * Hook: mengembalikan email user (string|null).
 * Tidak mengubah API: tetap simple string|null.
 */
export function useAuthEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // ✅ jaminan init sebelum getAuth()
    ensureFirebaseClient();

    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user: User | null) => {
      setEmail(user?.email ?? null);
    });

    return () => unsub();
  }, []);

  return email;
}

// Tetap sediakan default export agar kompatibel dengan import default.
export default useAuthEmail;
