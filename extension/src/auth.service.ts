import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

// ─── Google OAuth Client ID ────────────────────────────────────
// This is the *Chrome app* (or *Web client*) OAuth 2.0 Client ID from Google Cloud Console.
// It MUST match the one configured in Firebase → Authentication → Sign-in method → Google.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const API_BASE_URL = 'http://13.232.183.4:3001';

type StoredFirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

async function persistUserToChromeStorage(user: User): Promise<void> {
  const storedUser: StoredFirebaseUser = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };

  await chrome.storage.local.set({ firebaseUser: storedUser });
}

/**
 * Sign in with Google using chrome.identity.launchWebAuthFlow.
 *
 * Flow:
 * 1. Build a Google OAuth2 authorize URL.
 * 2. Use `chrome.identity.launchWebAuthFlow` to open it (works in MV3 extensions).
 * 3. Extract the `id_token` from the redirect URL fragment.
 * 4. Exchange the `id_token` for a Firebase credential via `signInWithCredential`.
 * 5. Persist the user info in chrome.storage.local so the background script can use it.
 */
export async function signInWithGoogle(): Promise<User> {
  return new Promise((resolve, reject) => {
    // The redirect URL provided by chrome.identity for the current extension
    const redirectUrl = chrome.identity.getRedirectURL();
    console.log("🔑 Redirect URL:", redirectUrl);
    alert("Add this EXACT URL to Google Console Authorized redirect URIs:\n\n" + redirectUrl);

    // Build Google OAuth URL requesting an id_token (implicit / response_type=token id_token)
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("response_type", "token id_token");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("nonce", crypto.randomUUID());
    // Force account chooser so user can pick an account each time
    authUrl.searchParams.set("prompt", "consent");

    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          return reject(new Error(chrome.runtime.lastError?.message || "OAuth flow cancelled"));
        }

        try {
          // Extract tokens from the URL fragment (#access_token=...&id_token=...)
          const url = new URL(responseUrl);
          const fragment = new URLSearchParams(url.hash.substring(1));
          const idToken = fragment.get("id_token");
          const accessToken = fragment.get("access_token");

          if (!idToken) {
            return reject(new Error("No id_token received from Google"));
          }

          // Exchange Google id_token for Firebase credential
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const userCredential = await signInWithCredential(auth, credential);
          const user = userCredential.user;

          // Persist user info in chrome.storage so background service worker can access it
          await persistUserToChromeStorage(user);

          resolve(user);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  await persistUserToChromeStorage(userCredential.user);
  return userCredential.user;
}

export async function signUpWithEmailPassword(email: string, password: string, displayName?: string): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  const trimmedName = displayName?.trim();
  if (trimmedName) {
    await updateProfile(userCredential.user, { displayName: trimmedName });
  }

  await persistUserToChromeStorage(userCredential.user);
  return userCredential.user;
}

/**
 * Sign out of Firebase and clear persisted user from chrome.storage.
 */
export async function firebaseSignOut(): Promise<void> {
  await signOut(auth);
  await chrome.storage.local.remove("firebaseUser");
}

/**
 * Subscribe to Firebase auth state changes.
 * Returns an unsubscribe function.
 */
export function onFirebaseAuthChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Keep chrome.storage in sync
      await persistUserToChromeStorage(user);
    }
    callback(user);
  });
}

/**
 * Gets the currently persisted user from chrome.storage.local.
 * Useful for the background service worker which can't use the Firebase auth listener.
 */
export async function getStoredUser(): Promise<StoredFirebaseUser | null> {
  const result = await chrome.storage.local.get("firebaseUser") as { firebaseUser?: StoredFirebaseUser };
  return result.firebaseUser || null;
}

/**
 * Request a password reset code (OTP).
 */
export async function sendForgotPasswordCode(email: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to send reset code");
    }
  } else {
    // If it's not JSON, it's likely an HTML 404/500 page
    const text = await response.text();
    console.error("Non-JSON response from server:", text);
    throw new Error(`Server error (${response.status}). If testing locally, ensure API_BASE_URL is correct.`);
  }
}

/**
 * Reset password using the verification code.
 */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to reset password");
    }
  } else {
    const text = await response.text();
    console.error("Non-JSON response from server:", text);
    throw new Error(`Server error (${response.status}). Ensure your backend is running and routes are updated.`);
  }
}
