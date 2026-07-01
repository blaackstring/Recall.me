import { db } from "./db.service.js";

const otpCollection = db.collection("otp_codes");

/**
 * Generate a 6-digit numeric OTP.
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and store an OTP for an email.
 * Expires in 10 minutes.
 */
export async function createOTP(email: string): Promise<string> {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Upsert OTP for this email
  await otpCollection.updateOne(
    { email },
    { $set: { code, expiresAt } },
    { upsert: true }
  );

  return code;
}

/**
 * Verify an OTP for an email.
 */
export async function verifyOTP(email: string, code: string): Promise<boolean> {
  const record = await otpCollection.findOne({ email });

  if (!record || record.code !== code) {
    return false;
  }

  const expiresAt = new Date(record.expiresAt as string);
  if (expiresAt < new Date()) {
    return false;
  }

  // Remove OTP after successful verification
  await otpCollection.deleteOne({ email });
  return true;
}
