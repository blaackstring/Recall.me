import admin from "firebase-admin";
import { config } from "../config.js";
import { db } from "./db.service.js";

// ─── Firebase Admin Initialization ─────────────────────────────
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(config.firebaseServiceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin initialized");
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
  }
}

export const authAdmin: admin.auth.Auth = admin.auth();

// ─── Users Collection (AstraDB) ────────────────────────────────
// Stores email/password users alongside your existing screenshot data.
export const usersCollection = db.collection("users");

/**
 * Generate a password reset link (Firebase Admin)
 */
export const getPasswordResetLink = async (email: string) => {
  return await authAdmin.generatePasswordResetLink(email);
};
