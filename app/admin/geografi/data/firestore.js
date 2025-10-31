// app/admin/geografi/data/firestore.js
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, orderBy, query, startAfter } from "firebase/firestore";

const text = (v) => (v ?? "").toString();

/**
 * Ambil halaman users_app terurut username. Idempotent & irit read.
 * @param {{ pageSize: number, cursor: any|null }} opts
 * @returns {{ list: Array, lastDoc: any|null }}
 */
export async function listUsersPage({ pageSize = 25, cursor = null } = {}) {
  const baseRef = collection(db, "users_app");
  const q = cursor
    ? query(baseRef, orderBy("username"), startAfter(cursor), limit(pageSize))
    : query(baseRef, orderBy("username"), limit(pageSize));

  const snap = await getDocs(q);
  const list = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      username: text(d.username),
      fullName: text(d.fullName),
      level: text(d.registrationLevel),
      provinceCode: text(d.provinceCode),
      regencyCode: text(d.regencyCode),
      districtCode: text(d.districtCode),
      addressLine: text(d.addressLine),
    };
  });

  const lastDoc = snap.docs[snap.docs.length - 1] || null;
  return { list, lastDoc };
}
