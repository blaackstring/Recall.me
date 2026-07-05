import admin from "firebase-admin";
import { config } from "../config.js";
import { db } from "./db.service.js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Firebase Admin Initialization ─────────────────────────────
if (!admin.apps.length) {
  try {
    const rawKey = config.firebaseServiceAccountKey?.trim();

    if (rawKey && rawKey.startsWith('{')) {
      // Loaded from FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string)
      const serviceAccount = JSON.parse(rawKey);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log("🔥 Firebase Admin initialized via env var");
    } else {
      // Try loading from a local JSON file (server/firebase-service-account.json)
      try {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const serviceAccount = require("../../firebase-service-account.json");
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("🔥 Firebase Admin initialized via service account file");
      } catch {
        // No credentials found — initialize with just the project ID (limited capabilities)
        if (config.firebaseProjectId) {
          admin.initializeApp({ projectId: config.firebaseProjectId });
          console.warn("⚠️  Firebase Admin initialized with project ID only (no service account). Token verification uses fallback.");
        } else {
          console.warn("⚠️  Firebase Admin skipped — no credentials or project ID configured.");
        }
      }
    }
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
