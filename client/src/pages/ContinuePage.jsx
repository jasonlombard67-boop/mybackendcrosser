// src/pages/ContinuePage.jsx  — Device B
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import CountdownTimer from "../components/CountdownTimer";
import StepTracker    from "../components/StepTracker";

export default function ContinuePage() {
  const [params]  = useSearchParams();
  const token     = params.get("token");

  const [status,  setStatus]  = useState("checking");
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [expired, setExpired] = useState(false);

  // ── Check token status on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus("not_found"); return; }

    api.tokenStatus(token).then(data => {
      if (data.ok) {
        setInfo({ email: data.email, expiresAt: data.expiresAt, msLeft: data.msLeft });
        setStatus("valid");
      } else {
        setStatus(
          data.reason === "ALREADY_USED" ? "used"
        : data.reason === "EXPIRED"      ? "expired"
        :                                  "not_found"
        );
      }
    }).catch(() => setStatus("error"));
  }, [token]);

  // ── Redeem ─────────────────────────────────────────────────────────────────
  const handleRedeem = async () => {
    setLoading(true);
    try {
      const data = await api.redeem({ token });
      if (data.ok) {
        setSession(data);
        setStatus("redeemed");
      } else {
        setStatus(
          data.reason === "ALREADY_USED" ? "used"
        : data.reason === "EXPIRED"      ? "expired"
        :                                  "not_found"
        );
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleExpire = useCallback(() => { setExpired(true); setStatus("expired"); }, []);

  // ── States ─────────────────────────────────────────────────────────────────
  if (!token) return <StatusCard title="Invalid Link" type="error"
    body="No token found in this URL. Make sure you opened the complete magic link." />;

  if (status === "checking") return (
    <div className="page">
      <div className="card fade-up" style={{ textAlign: "center" }}>
        <div className="label" style={{ justifyContent: "center" }}>Verifying Token</div>
        <div style={{ margin: "32px 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)",
            borderTopColor: "var(--teal)", borderRadius: "50%",
            animation: "spin 0.8s linear infinite" }} />
        </div>
        <p style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--muted)" }}>
          Contacting server…
        </p>
      </div>
    </div>
  );

  if (status === "used") return (
    <div className="page">
      <div className="card fade-up">
        <StepTracker current={2} />
        <div className="label">Token Already Used</div>
        <h1>Already Redeemed</h1>
        <div className="alert alert-warn">
          ⚠ This magic link has already been used.<br />
          Each link works for <strong>one redemption only</strong>.
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", lineHeight: "1.9" }}>
          Token: <code style={{ color: "var(--amber)" }}>{token?.slice(0, 16)}…</code><br />
          If you did not use this link, someone else may have intercepted it.<br />
          Ask for a new link to be generated on Device A.
        </div>
      </div>
    </div>
  );

  if (status === "expired") return <StatusCard title="Link Expired" type="error"
    body={`This magic link expired. Links are only valid for 5 minutes. Return to Device A and generate a new one.`} />;

  if (status === "not_found" || status === "error") return (
    <StatusCard title="Link Invalid" type="error"
      body={status === "error"
        ? "Cannot reach the server. Make sure it is running."
        : "This link does not exist or has been revoked."} />
  );

  if (status === "redeemed" && session) return (
    <div className="page">
      <div className="card fade-up">
        <StepTracker current={2} />
        <div className="label">Device B — Logged In</div>
        <h1>✓ Access Granted</h1>
        <p className="subtitle">Cross-device login complete. Token permanently destroyed.</p>

        <div className="alert alert-success">
          ✓ Session cookie set on this device (HttpOnly)<br />
          ✓ Token consumed — cannot be reused<br />
          ✓ Event logged to Telegram
        </div>

        <div className="label" style={{ marginBottom: "8px" }}>Session</div>
        <table className="meta-table">
          <tbody>
            <tr><td>Email</td>       <td>{session.email}</td></tr>
            <tr><td>Session ID</td>  <td>{session.sessionId?.slice(0, 16)}…</td></tr>
            <tr><td>Redeemed at</td> <td>{new Date(session.redeemedAt).toLocaleTimeString()}</td></tr>
            <tr><td>Device A IP</td> <td>{session.deviceA?.ip}</td></tr>
          </tbody>
        </table>

        <hr className="divider" />
        <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", lineHeight: "1.8", textAlign: "center" }}>
          Token <code style={{ color: "var(--red)" }}>{token?.slice(0, 8)}…</code> is permanently invalidated.
        </div>
      </div>
    </div>
  );

  // ── Valid — ready to redeem ────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="card fade-up">
        <StepTracker current={1} />
        <div className="label">Device B — Confirm Login</div>
        <h1>Magic Link Received</h1>
        <p className="subtitle">
          This link was generated for{" "}
          <strong style={{ color: "var(--teal)" }}>{info?.email}</strong>.<br />
          Click confirm to complete the cross-device login.
        </p>

        {info?.expiresAt && !expired && (
          <CountdownTimer expiresAt={info.expiresAt} onExpire={handleExpire} />
        )}

        <div className="alert alert-info">
          🔑 Token: <code>{token?.slice(0, 16)}…</code><br />
          ⚠ One-time use — confirming will permanently invalidate this link.
        </div>

        <div className="label" style={{ marginBottom: "8px" }}>This Device</div>
        <table className="meta-table">
          <tbody>
            <tr><td>Browser</td>  <td>{navigator.userAgent.slice(0, 55)}…</td></tr>
            <tr><td>Platform</td> <td>{navigator.platform}</td></tr>
            <tr><td>Language</td> <td>{navigator.language}</td></tr>
          </tbody>
        </table>

        <button className="btn" style={{ marginTop: "24px" }}
          onClick={handleRedeem} disabled={loading || expired}>
          {loading  ? <><Spinner /> Redeeming…</>
          : expired ? "⏱ Link Expired"
          :           "✓ Confirm Login on This Device"}
        </button>

        <hr className="divider" />
        <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", lineHeight: "1.8", textAlign: "center" }}>
          After confirming, the token is permanently destroyed.
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function StatusCard({ title, type, body }) {
  return (
    <div className="page">
      <div className="card fade-up">
        <div className="label">Device B</div>
        <h1>{title}</h1>
        <div className={`alert alert-${type}`}>{body}</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ width: 14, height: 14, border: "2px solid var(--bg)",
      borderTopColor: "transparent", borderRadius: "50%",
      display: "inline-block", animation: "spin 0.8s linear infinite" }} />
  );
}
