// app/api/ptk/check/route.js
import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

const APP_NAME = "spmb-admin-app";

function getAdmin() {
  try {
    return admin.app(APP_NAME);
  } catch {
    return admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      },
      APP_NAME
    );
  }
}

function normalizeStatus(s) {
  const t = (s || "").toString().trim().toUpperCase();
  if (["APPROVED", "VERIFIED", "ACCEPTED", "OK", "CONFIRMED"].includes(t)) return "approved";
  if (["REJECTED", "DENIED", "DECLINED"].includes(t)) return "rejected";
  return "pending";
}

export async function POST(req) {
  try {
    const { nisn } = await req.json();
    if (!nisn) return NextResponse.json({ error: "nisn required" }, { status: 400 });

    const app = getAdmin();
    const db = app.firestore();

    const ref = db.doc(`users_app/${nisn}/ptk_confirmation/current`);
    const snap = await ref.get();

    const status = normalizeStatus(snap.exists ? snap.data()?.status : "");
    const approved = status === "approved";
    return NextResponse.json({ approved, status }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
