"use client";

export const GOOGLE_OAUTH_INFLIGHT_KEY = "google_oauth_inflight";
export const GOOGLE_OAUTH_REQUESTED_ROLE_KEY = "google_oauth_requested_role";

const GOOGLE_OAUTH_INFLIGHT_TTL_MS = 2 * 60 * 1000;

type GoogleOAuthRequestedRole = "b2b" | "b2c";

export const clearGoogleOAuthInflightState = () => {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(GOOGLE_OAUTH_INFLIGHT_KEY);
  sessionStorage.removeItem(GOOGLE_OAUTH_REQUESTED_ROLE_KEY);
};

export const getGoogleRequestedRole = (): GoogleOAuthRequestedRole | null => {
  if (typeof window === "undefined") return null;

  const role = sessionStorage.getItem(GOOGLE_OAUTH_REQUESTED_ROLE_KEY);
  return role === "b2b" || role === "b2c" ? role : null;
};

export const hasActiveGoogleOAuthInflight = () => {
  if (typeof window === "undefined") return false;

  const raw = sessionStorage.getItem(GOOGLE_OAUTH_INFLIGHT_KEY);
  if (!raw) {
    return false;
  }

  const startedAt = Number.parseInt(raw, 10);
  if (!Number.isFinite(startedAt)) {
    clearGoogleOAuthInflightState();
    return false;
  }

  if (Date.now() - startedAt > GOOGLE_OAUTH_INFLIGHT_TTL_MS) {
    clearGoogleOAuthInflightState();
    return false;
  }

  return true;
};

export const markGoogleOAuthInflight = (
  requestedRole?: GoogleOAuthRequestedRole
) => {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(GOOGLE_OAUTH_INFLIGHT_KEY, String(Date.now()));
  if (requestedRole) {
    sessionStorage.setItem(GOOGLE_OAUTH_REQUESTED_ROLE_KEY, requestedRole);
    return;
  }
  sessionStorage.removeItem(GOOGLE_OAUTH_REQUESTED_ROLE_KEY);
};
