import { GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";

// ─── Google OAuth Client ID ────────────────────────────────────
// This is the *Chrome app* (or *Web client*) OAuth 2.0 Client ID from Google Cloud Console.
// It MUST match the one configured in Firebase → Authentication → Sign-in method → Google.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
          await chrome.storage.local.set({
            firebaseUser: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            },
          });

          resolve(user);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
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
      await chrome.storage.local.set({
        firebaseUser: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
      });
    }
    callback(user);
  });
}

/**
 * Gets the currently persisted user from chrome.storage.local.
 * Useful for the background service worker which can't use the Firebase auth listener.
 */
export async function getStoredUser(): Promise<{ uid: string; email: string; displayName: string; photoURL: string } | null> {
  const result = await chrome.storage.local.get("firebaseUser") as { firebaseUser?: { uid: string; email: string; displayName: string; photoURL: string } };
  return result.firebaseUser || null;
}
