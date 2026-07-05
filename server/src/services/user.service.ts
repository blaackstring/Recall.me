import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db, subscriptionCollection } from "./db.service.js";

// ─── Users Collection (AstraDB) ────────────────────────────────
const usersCollection = db.collection("users");

export interface UserRecord {
    _id?: string;
    uid: string;
    email: string;
    password: string;       // hashed
    displayName: string;
    created_at: Date;
}

/**
 * Create a new user with hashed password.
 */
export async function createUser(email: string, password: string, displayName: string) {
    // Check if email already exists
    const existing = await usersCollection.findOne({ email });
    if (existing) {
        throw new Error("Email already registered");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const uid = uuidv4();

    const user = {
        uid,
        email,
        password: hashedPassword,
        displayName,
        created_at: new Date(),
    };

    await usersCollection.insertOne(user);

    // Return user without password
    return { uid, email, displayName };
}

/**
 * Find user by email and verify password. Returns user (without password) on success.
 */
export async function verifyUser(email: string, password: string) {
    const user = await usersCollection.findOne({ email });
    if (!user) {
        throw new Error("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.password as string);
    if (!isMatch) {
        throw new Error("Invalid email or password");
    }

    return {
        uid: user.uid as string,
        email: user.email as string,
        displayName: user.displayName as string,
    };
}

/**
 * Find user by uid. Returns user (without password).
 */
export async function findUserByUid(uid: string) {
    const user = await usersCollection.findOne({ uid });
    if (!user) return null;

    return {
        uid: user.uid as string,
        email: user.email as string,
        displayName: user.displayName as string,
    };
}
/**
 * Find user by email. Returns user (without password).
 */
export async function findUserByEmail(email: string) {
    const user = await usersCollection.findOne({ email });
    if (!user) return null;

    return {
        uid: user.uid as string,
        email: user.email as string,
        displayName: user.displayName as string,
    };
}

/**
 * Update user password with hashing.
 */
export async function updateUserPassword(email: string, password: string) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await usersCollection.updateOne(
        { email },
        { $set: { password: hashedPassword } }
    );
}

// ─── Gmail OAuth Tokens ──────────────────────────────────────────

export interface GmailTokens {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
}

/**
 * Save Gmail OAuth tokens for a user.
 */
export async function saveGmailTokens(uid: string, tokens: GmailTokens) {
    await subscriptionCollection.updateOne(
        { user_id: uid },
        { $set: { gmail_tokens: tokens, gmail_connected_at: new Date() } },
        { upsert: true }
    );
    console.log(`[Gmail] Tokens saved for user ${uid}`);
}

/**
 * Get Gmail OAuth tokens for a user.
 */
export async function getGmailTokens(uid: string): Promise<GmailTokens | null> {
    const sub = await subscriptionCollection.findOne({ user_id: uid });
    if (!sub || !sub.gmail_tokens) return null;
    return sub.gmail_tokens as GmailTokens;
}

/**
 * Remove Gmail OAuth tokens for a user (disconnect).
 */
export async function removeGmailTokens(uid: string) {
    await subscriptionCollection.updateOne(
        { user_id: uid },
        { $unset: { gmail_tokens: "", gmail_connected_at: "" } }
    );
    console.log(`[Gmail] Tokens removed for user ${uid}`);
}

/**
 * Check if a user has Gmail connected.
 */
export async function isGmailConnected(uid: string): Promise<boolean> {
    const sub = await subscriptionCollection.findOne({ user_id: uid });
    return !!(sub && sub.gmail_tokens);
}
