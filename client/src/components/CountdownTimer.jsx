// src/components/CountdownTimer.jsx
import React, { useState, useEffect } from "react";

const CIRCUMFERENCE = 2 * Math.PI * 45; // r=45 → 283

export default function CountdownTimer({ expiresAt, onExpire }) {
  const total   = expiresAt - (Date.now() - (expiresAt % 1)); // stabilise
  const [msLeft, setMsLeft] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const tick = setInterval(() => {
      const left = Math.max(0, expiresAt - Date.now());
      setMsLeft(left);
      if (left === 0) { clearInterval(tick); onExpire && onExpire(); }
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt, onExpire]);

  const totalSec = Math.round((expiresAt - Date.now() + msLeft) / 1000) || 300;
  const secLeft  = Math.ceil(msLeft / 1000);
  const progress = msLeft / (totalSec * 1000);
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const mins = Math.floor(secLeft / 60);
  const secs = secLeft % 60;
  const isLow = secLeft <= 60;

  return (
    <div className="timer-wrap">
      <svg width="100" height="100" className="timer-ring">
        <circle className="track"    cx="50" cy="50" r="45"/>
        <circle className="progress" cx="50" cy="50" r="45"
          style={{
            strokeDashoffset: dashOffset,
            stroke: isLow ? "var(--amber)" : "var(--teal)",
          }}
        />
        <text x="50" y="54" textAnchor="middle"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "14px",
            fill: isLow ? "var(--amber)" : "var(--teal)",
            transform: "rotate(90deg)",
            transformOrigin: "50px 50px",
          }}>
          {mins}:{secs.toString().padStart(2,"0")}
        </text>
      </svg>
      <span className="timer-label">
        {secLeft > 0
          ? `Link expires in ${mins}m ${secs}s`
          : "⚠ Link expired"}
      </span>
    </div>
  );
}
