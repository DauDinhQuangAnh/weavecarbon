import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

export const isControlledEvidence = (item: EvidenceDocumentV2) =>
  ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") &&
  item.fileSizeBytes > 0;

export const selectLatestRevisions = <T extends { revision: number }>(
  items: T[],
  reference: (item: T) => string
) => {
  const latest = new Map<string, T>();
  for (const item of items) {
    const key = reference(item);
    const current = latest.get(key);
    if (!current || item.revision > current.revision) latest.set(key, item);
  }
  return [...latest.values()];
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
};

export const sha256CanonicalJson = async (value: unknown) => {
  const encoded = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const zonedLocalDateTimeToIso = (localValue: string, timeZone: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localValue);
  if (!match) throw new Error("A local date and time are required.");
  const expected = match.slice(1).map((part) => Number(part || 0));
  const desiredUtc = Date.UTC(expected[0], expected[1] - 1, expected[2], expected[3], expected[4], expected[5] || 0);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const zonedParts = (timestamp: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    return [Number(parts.year), Number(parts.month), Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)];
  };
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(candidate);
    candidate = desiredUtc - (Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]) - candidate);
  }
  const resolved = zonedParts(candidate);
  if (resolved.some((part, index) => part !== expected[index])) {
    throw new Error("The local date and time do not exist in the facility time zone.");
  }
  return new Date(candidate).toISOString();
};
