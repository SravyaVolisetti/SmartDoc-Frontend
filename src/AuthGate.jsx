import { useEffect, useState } from "react";
import "./AuthGate.css";

const API = "https://smartdoc-backend-9v7s.onrender.com";

let csrfToken = "";

export default function AuthGate({ children }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function getCsrfToken() {
    return csrfToken;
  }

  async function initializeCsrf() {
    const response = await fetch(`${API}/api/auth/csrf`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        "Could not initialize security. Please try again."
      );
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error(
        "The backend did not provide a CSRF token. Please check the backend configuration."
      );
    }

    csrfToken = data.token;
  }

  async function checkSession() {
    try {
      await initializeCsrf();

      const response = await fetch(`${API}/api/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.authenticated ? data : null);
      } else if (response.status === 401) {
        setUser(null);
      } else {
        throw new Error("Could not check your sign-in status.");
      }
    } catch (err) {
      setUser(null);
      setError(
        err.message ||
          "Cannot connect to the backend. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkSession();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      await initializeCsrf();

      const token = getCsrfToken();

      if (!token) {
        throw new Error(
          "Security token is missing. Please refresh the page."
        );
      }

      const response = await fetch(
        `${API}/api/auth/${mode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": token,
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            "Security verification failed. Please refresh the page and try again."
          );
        }

        throw new Error(
          data.message ||
            data.error ||
            (response.status === 401
              ? "Invalid email or password."
              : "Authentication failed. Please try again.")
        );
      }

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setError("Account created! Please sign in.");
      } else {
        setPassword("");
        await checkSession();
      }
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the backend. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");

    try {
      await initializeCsrf();

      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-XSRF-TOKEN": getCsrfToken(),
          Accept: "application/json",
        },
      });

      if (!response.ok && response.status !== 401) {
        throw new Error("Sign out failed. Please try again.");
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      csrfToken = "";
      setUser(null);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMode("login");
    }
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
        <p>Preparing SmartDoc...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="smartdoc-authenticated">
        <header className="auth-topbar">
          <div className="auth-brand">
            <span className="auth-brand-icon">S</span>
            <span>SmartDoc</span>
          </div>

          <div className="auth-user">
            <span>{user.email || email}</span>
            <button
              onClick={handleLogout}
              className="auth-logout"
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        {children}
      </div>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand auth-brand-light">
          <span className="auth-brand-icon">S</span>
          <span>SmartDoc</span>
        </div>

        <div className="auth-visual-content">
          <span className="auth-eyebrow">
            YOUR DOCUMENT WORKSPACE
          </span>

          <h1>
            Every format.
            <br />
            One simple workspace.
          </h1>

          <p>
            Convert, organize, and manage your documents in one place.
            Your files, your workflow, made simpler.
          </p>

          <div className="auth-feature">
            <span>↗</span>
            <div>
              <strong>Convert with ease</strong>
              <p>Move between supported document formats.</p>
            </div>
          </div>

          <div className="auth-feature">
            <span>▤</span>
            <div>
              <strong>Your documents, organized</strong>
              <p>Access your workspace after signing in.</p>
            </div>
          </div>
        </div>

        <p className="auth-footer-note">
          A smarter way to work with documents.
        </p>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <span className="auth-brand-icon">S</span>
            <span>SmartDoc</span>
          </div>

          <span className="auth-eyebrow auth-eyebrow-dark">
            {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
          </span>

          <h2>
            {mode === "login"
              ? "Sign in to SmartDoc"
              : "Create your account"}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Enter your details to access your workspace."
              : "Create an account to start using your workspace."}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="auth-email">Email address</label>

            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="auth-password">Password</label>

            <input
              id="auth-password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              required
            />

            {mode === "register" && (
              <>
                <label htmlFor="auth-confirm-password">
                  Confirm password
                </label>

                <input
                  id="auth-confirm-password"
                  type="password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </>
            )}

            {error && (
              <p
                className={`auth-message ${
                  error.startsWith("Account created")
                    ? "auth-success"
                    : ""
                }`}
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in to SmartDoc →"
                  : "Create account →"}
            </button>
          </form>

          <p className="auth-security-note">
            Your workspace is protected by account sign-in.
          </p>
        </div>
      </section>
    </main>
  );
}