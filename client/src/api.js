// src/api.js
// Central API client — reads base URL from env so it works in both dev and prod.
// In dev: REACT_APP_API_URL is empty → relative URLs → CRA proxy → localhost:4000
// In prod: REACT_APP_API_URL is empty → relative URLs → Express serves everything

const BASE = process.env.REACT_APP_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  // Always return parsed JSON — let callers check .ok
  const data = await res.json().catch(() => ({ ok: false, error: "Invalid server response." }));
  return { status: res.status, ...data };
}

export const api = {
  login:       (body) => request("/api/login",        { method: "POST", body: JSON.stringify(body) }),
  tokenStatus: (token) => request(`/api/token-status?token=${encodeURIComponent(token)}`),
  redeem:      (body) => request("/api/redeem",       { method: "POST", body: JSON.stringify(body) }),
  health:      ()     => request("/api/health"),
};
