export const readFromStorage = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const writeToStorage = (storage: Storage, key: string, value: string | null) => {
  try {
    if (value) {
      storage.setItem(key, value);
      return;
    }
    storage.removeItem(key);
  } catch {
    // ignore storage write failures (e.g. private browsing quota)
  }
};

export const normalizeToken = (token: string | null | undefined) => {
  if (typeof token !== "string") return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};
