import { useState } from "react";
import { signInWithGoogle } from "./auth.service";

interface AuthProps {
  onLoginSuccess?: () => void;
}

const Auth = ({ onLoginSuccess }: AuthProps) => {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
      onLoginSuccess?.();
    } catch (err: any) {
      console.error("Google login failed:", err);
      // Don't alert if user simply closed the popup
      if (!err.message?.includes("cancelled") && !err.message?.includes("closed")) {
        alert(`Login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        width: "100%",
        backgroundColor: "white",
        color: "black",
        fontWeight: 700,
        padding: "14px 24px",
        borderRadius: "12px",
        transition: "all 200ms",
        boxShadow: "0 10px 15px -3px rgba(255, 255, 255, 0.1)",
        cursor: loading ? "not-allowed" : "pointer",
        border: "none",
        opacity: loading ? 0.7 : 1,
        fontSize: "15px",
      }}
      onMouseOver={(e) => {
        if (!loading) e.currentTarget.style.backgroundColor = "#e4e4e7";
      }}
      onMouseOut={(e) => {
        if (!loading) e.currentTarget.style.backgroundColor = "white";
      }}
      onMouseDown={(e) => {
        if (!loading) e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        if (!loading) e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* Google "G" icon */}
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.04 24.04 0 0 0 0 21.56l7.98-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {loading ? "Signing in..." : "Continue with Google"}
    </button>
  );
};

export default Auth;