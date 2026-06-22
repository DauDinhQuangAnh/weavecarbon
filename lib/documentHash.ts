/** Returns the first 8 hex chars of a SHA-256 hash for display. */
export const shortHash = (hash: string): string => hash.slice(0, 8);
