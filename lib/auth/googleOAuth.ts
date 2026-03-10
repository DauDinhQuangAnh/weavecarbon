"use client";

export const GOOGLE_OAUTH_INFLIGHT_KEY = "google_oauth_inflight";
export const GOOGLE_OAUTH_REMEMBER_ME_KEY = "google_oauth_remember_me";

const GOOGLE_OAUTH_INFLIGHT_TTL_MS = 2 * 60 * 1000;

export const clearGoogleOAuthInflightState = () => {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(GOOGLE_OAUTH_INFLIGHT_KEY);
  sessionStorage.removeItem(GOOGLE_OAUTH_REMEMBER_ME_KEY);
};

export const getGoogleRememberPreference = () => {
  if (typeof window === "undefined") return true;

  const preference = sessionStorage.getItem(GOOGLE_OAUTH_REMEMBER_ME_KEY);
  return preference !== "0";
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

export const markGoogleOAuthInflight = (rememberMe = true) => {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(GOOGLE_OAUTH_INFLIGHT_KEY, String(Date.now()));
  sessionStorage.setItem(GOOGLE_OAUTH_REMEMBER_ME_KEY, rememberMe ? "1" : "0");
};
