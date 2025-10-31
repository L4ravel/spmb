// app/admin/data-daftar-ulang/data/firestore.js
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { computeFeesForLevel, applyPTKDiscount } from "./fees";

/**
 * Ambil 1 halaman users_app + ringkasan pembayaran approved & kewajiban daftar ulang (berdasar API biaya resmi).
 */
export async function listUsersWithPaymentPage({ pageSize = 25, cursor = null } = {}) {
  const baseRef = collection(db, "users_app");
  const q = cursor
    ? query(baseRef, orderBy("username"), startAfter(cursor), limit(pageSize))
    : query(baseRef, orderBy("username"), limit(pageSize));

  const snap = await getDocs(q);

  const list = [];
  for (const d of snap.docs) {
    const u = d.data() || {};
    const id = d.id;
    const nisn = u.nisn || u.username || id;
    const level = u.registrationLevel || u.level || "—";

    // 1) Fee baseline dari API (SPP + pangkal detail resmi)
    const fee = await computeFeesForLevel(level);
    let kewajibanTotal = fee.total;
    let displaySpp = fee.spp;
    let displayPangkal = { ...fee.pangkal };

    // 2) Status PTK & potongan
    let status = "Non-PTK";
    const ptkDiscRef = doc(db, "users_app", id, "re_registration", "ptk_discount");
    const ptkDiscSnap = await getDoc(ptkDiscRef);
    if (ptkDiscSnap.exists()) {
      status = "PTK";
      const discountDoc = ptkDiscSnap.data();
      kewajibanTotal = applyPTKDiscount(fee, discountDoc);
      
      // sourceKey bisa: "uangPangkal.bp3" atau "spp" atau "bp3"
      const sourceKey = String(discountDoc.sourceKey || "").toLowerCase();
      const discountType = String(discountDoc.type || "").toLowerCase();
      
      // Jika discount dari SPP, tampilkan SPP = 0
      if (sourceKey === "spp" || discountType === "spp") {
        displaySpp = 0;
      }
      
      // Jika discount dari BP3, tampilkan BP3 = 0 di items DAN recalculate total
      if (sourceKey === "uangpangkal.bp3" || sourceKey === "bp3" || discountType === "bp3") {
        const newItems = fee.pangkal.items.map(item => {
          if (String(item.label || "").toLowerCase() === "bp3") {
            return { ...item, amount: 0 };
          }
          return item;
        });
        
        // Recalculate total pangkal setelah BP3 = 0
        const newTotal = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        displayPangkal = {
          items: newItems,
          total: newTotal
        };
      }
    }

    // 3) Total pembayaran approved
    let totalPaid = 0;
    const payRef = collection(db, "users_app", id, "payments");
    const paySnap = await getDocs(payRef);
    for (const p of paySnap.docs) {
      const pd = p.data();
      if ((pd.status || "").toUpperCase() === "APPROVED") {
        totalPaid += Number(pd.amount || 0);
      }
    }

    const tunggakan = Math.max(kewajibanTotal - totalPaid, 0);

    list.push({
      id,
      nisn,
      fullName: u.fullName || u.name || "—",
      level,
      status,
      spp: displaySpp, // SPP yang sudah disesuaikan (0 jika PTK discount dari SPP)
      pangkal: displayPangkal, // {items,total} – BP3 = 0 jika PTK discount dari BP3
      kewajibanTotal,
      totalPaid,
      tunggakan,
    });
  }

  const lastDoc = snap.docs[snap.docs.length - 1] || null;
  return { list, lastDoc };
}