import { useMemo, useState, type FormEvent } from "react";
import { signInWithEmailPassword, signInWithGoogle, signUpWithEmailPassword, sendForgotPasswordCode, resetPasswordWithCode } from "./auth.service";

interface AuthProps {
  onLoginSuccess?: () => void;
}

const Auth = ({ onLoginSuccess }: AuthProps) => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "google" | "email" | "forgot" | "reset">(null);

  const isSignup = mode === "signup";

  const submitDisabledReason = useMemo(() => {
    if (!email.trim()) return "Enter your email";
    if (!password) return "Enter your password";
    if (isSignup && password.length < 6) return "Password must be at least 6 characters";
    if (isSignup && password !== confirmPassword) return "Passwords do not match";
    return null;
  }, [confirmPassword, email, isSignup, password]);

  function getAuthErrorMessage(err: unknown): string {
    const anyErr = err as { code?: unknown; message?: unknown };
    const code = typeof anyErr?.code === "string" ? anyErr.code : "";

    if (code === "auth/invalid-email") return "Invalid email address.";
    if (code === "auth/user-not-found") return "No account found for this email.";
    if (code === "auth/wrong-password") return "Incorrect password.";
    if (code === "auth/invalid-credential") return "Invalid email or password.";
    if (code === "auth/email-already-in-use") return "An account already exists with this email.";
    if (code === "auth/weak-password") return "Password is too weak (min 6 characters).";
    if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";

    if (typeof anyErr?.message === "string" && anyErr.message.trim()) return anyErr.message;
    return "Authentication failed. Please try again.";
  }

  async function handleEmailAuth(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    if (submitDisabledReason) {
      setError(submitDisabledReason);
      return;
    }

    setLoading("email");
    try {
      if (isSignup) {
        await signUpWithEmailPassword(email.trim(), password, displayName.trim() || undefined);
      } else {
        await signInWithEmailPassword(email.trim(), password);
      }
      onLoginSuccess?.();
    } catch (err) {
      console.error("Email auth failed:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (loading || !email.trim()) return;
    setError(null);
    setLoading("forgot");
    try {
      await sendForgotPasswordCode(email.trim());
      setSuccess("A verification code has been sent to your email.");
      setMode("reset");
    } catch (err: any) {
      setError(err.message || "Failed to send reset code.");
    } finally {
      setLoading(null);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (loading || !otpCode || !password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading("reset");
    try {
      await resetPasswordWithCode(email.trim(), otpCode.trim(), password);
      setSuccess("Password reset successful! You can now log in.");
      setMode("login");
      setOtpCode("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogleLogin() {
    if (loading) return;
    setError(null);
    setLoading("google");
    try {
      await signInWithGoogle();
      onLoginSuccess?.();
    } catch (err: any) {
      console.error("Google login failed:", err);
      // Don't alert if user simply closed the popup
      if (!err.message?.includes("cancelled") && !err.message?.includes("closed")) {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(null);
    }
  }

  const loginSignupView = (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          padding: "6px",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("login")}
          disabled={!!loading}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "10px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: "13px",
            color: mode === "login" ? "black" : "#d4d4d8",
            backgroundColor: mode === "login" ? "white" : "transparent",
            transition: "all 200ms",
          }}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          disabled={!!loading}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "10px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: "13px",
            color: mode === "signup" ? "black" : "#d4d4d8",
            backgroundColor: mode === "signup" ? "white" : "transparent",
            transition: "all 200ms",
          }}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {isSignup && (
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Name (optional)"
            disabled={!!loading}
            autoComplete="name"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "white",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              opacity: loading ? 0.7 : 1,
            }}
          />
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          disabled={!!loading}
          autoComplete={isSignup ? "email" : "username"}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            backgroundColor: "rgba(255,255,255,0.03)",
            color: "white",
            outline: "none",
            fontSize: "14px",
            boxSizing: "border-box",
            opacity: loading ? 0.7 : 1,
          }}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={!!loading}
          autoComplete={isSignup ? "new-password" : "current-password"}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            backgroundColor: "rgba(255,255,255,0.03)",
            color: "white",
            outline: "none",
            fontSize: "14px",
            boxSizing: "border-box",
            opacity: loading ? 0.7 : 1,
          }}
        />

        {isSignup && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            disabled={!!loading}
            autoComplete="new-password"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "white",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              opacity: loading ? 0.7 : 1,
            }}
          />
        )}

        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.22)",
              color: "#fecaca",
              padding: "10px 12px",
              borderRadius: "12px",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!!loading || !!submitDisabledReason}
          style={{
            width: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            color: "white",
            fontWeight: 800,
            padding: "13px 16px",
            borderRadius: "12px",
            transition: "all 200ms",
            cursor: loading || submitDisabledReason ? "not-allowed" : "pointer",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            opacity: loading || submitDisabledReason ? 0.65 : 1,
            fontSize: "14px",
          }}
        >
          {loading === "email"
            ? isSignup
              ? "Creating account..."
              : "Signing in..."
            : isSignup
              ? "Create account"
              : "Log in"}
        </button>

        {!isSignup && (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setSuccess(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#a1a1aa",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "right",
              marginTop: "-4px",
              textDecoration: "underline",
            }}
          >
            Forgot password?
          </button>
        )}
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", opacity: 0.7 }}>
        <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.12)", flex: 1 }} />
        <div style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 700 }}>OR</div>
        <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.12)", flex: 1 }} />
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={!!loading}
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
        {loading === "google" ? "Signing in..." : "Continue with Google"}
      </button>
    </div>
  );

  // ─── Forgot Password View ────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, textAlign: "center", margin: 0 }}>Reset Password</h2>
        <p style={{ fontSize: "13px", color: "#a1a1aa", textAlign: "center", margin: 0 }}>
          Enter your email to receive a 6-digit verification code.
        </p>
        <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "white",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          {error && <div style={{ color: "#fca5a5", fontSize: "12px" }}>{error}</div>}
          <button
            type="submit"
            disabled={!!loading}
            style={{
              width: "100%",
              backgroundColor: "white",
              color: "black",
              fontWeight: 800,
              padding: "13px",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              fontSize: "14px",
            }}
          >
            {loading ? "Sending..." : "Send Reset Code"}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: "13px", cursor: "pointer" }}
          >
            ← Back to login
          </button>
        </form>
      </div>
    );
  }

  // ─── Verification & New Password View ────────────────────────
  if (mode === "reset") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, textAlign: "center", margin: 0 }}>Verify Code</h2>
        <p style={{ fontSize: "13px", color: "#a1a1aa", textAlign: "center", margin: 0 }}>
          We've sent a code to <b>{email}</b>
        </p>
        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "white",
              fontSize: "14px",
              textAlign: "center",
              letterSpacing: "4px",
              fontWeight: 700,
              boxSizing: "border-box",
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Password"
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "white",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "white",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          {error && <div style={{ color: "#fca5a5", fontSize: "12px" }}>{error}</div>}
          {success && <div style={{ color: "#86efac", fontSize: "12px" }}>{success}</div>}
          <button
            type="submit"
            disabled={!!loading}
            style={{
              width: "100%",
              backgroundColor: "white",
              color: "black",
              fontWeight: 800,
              padding: "13px",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              fontSize: "14px",
            }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
          <button
            type="button"
            onClick={() => setMode("forgot")}
            style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: "13px", cursor: "pointer" }}
          >
            ← Change email
          </button>
        </form>
      </div>
    );
  }

  return loginSignupView;
};

export default Auth;
