// src/components/StepTracker.jsx
import React from "react";

const STEPS = ["Login", "Link Ready", "Redeemed"];

export default function StepTracker({ current }) {
  // current: 0 = login, 1 = link generated, 2 = redeemed
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
              <div className="step-dot">
                {done ? "✓" : i + 1}
              </div>
              <span style={{display: i === 1 ? "none" : "inline"}}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`step-line ${done ? "done" : ""}`}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}
