import { EN_DICTIONARY } from "./en/dictionary";

/**
 * Vietnamese → English translation for rendered UI copy.
 * Exact phrase match first, then templated phrases (with {placeholders}),
 * then longest-phrase replacement for mixed strings. Technical terms such as
 * CBAM, GHG, ISO, PCF, DPP, MRV, Scope 1/2/3 and CO₂e are kept as-is.
 */

const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

const SEPARATORS = [" · ", " — ", " – ", " | ", " → ", " / ", ": ", ", "];

const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Pattern {
  regex: RegExp;
  names: string[];
  en: string;
  anchor: string;
}

const exact = new Map<string, string>();
const patterns: Pattern[] = [];
const phrases: Array<[string, string]> = [];

for (const [rawVi, en] of Object.entries(EN_DICTIONARY)) {
  const vi = normalize(rawVi);
  if (!vi || !en || vi === en) continue;
  if (vi.includes(", plural,") || vi.includes(", select,")) continue;
  if (PLACEHOLDER.test(vi)) {
    PLACEHOLDER.lastIndex = 0;
    const names: string[] = [];
    const literals = vi.split(PLACEHOLDER).filter((_, index) => index % 2 === 0);
    const source = vi.replace(PLACEHOLDER, "\u0000").split("\u0000").map(escapeRegExp).join("([\\s\\S]+?)");
    vi.replace(PLACEHOLDER, (_, name: string) => {
      names.push(name);
      return "";
    });
    const anchor = literals.reduce((longest, part) => (part.trim().length > longest.length ? part.trim() : longest), "");
    if (anchor.length < 2) continue;
    patterns.push({ regex: new RegExp(`^${source}$`), names, en, anchor });
    continue;
  }
  exact.set(vi, en);
  if (vi.length >= 6 && VI_CHARS.test(vi)) phrases.push([vi, en]);
}

phrases.sort((a, b) => b[0].length - a[0].length);
patterns.sort((a, b) => b.anchor.length - a.anchor.length);

const cache = new Map<string, string>();

const translateCore = (text: string): string => {
  const direct = exact.get(text);
  if (direct !== undefined) return direct;

  // Chart libraries append their own suffixes (e.g. "<series> legend icon").
  const suffix = / (legend icon)$/.exec(text);
  if (suffix) return `${translateCore(text.slice(0, suffix.index))} ${suffix[1]}`;

  // Composite labels such as "Thép · Q3 2026 · CBAM": translate each segment on its own.
  for (const separator of SEPARATORS) {
    if (!text.includes(separator)) continue;
    const joined = text
      .split(separator)
      .map((part) => (part.trim() ? translateCore(part.trim()) : part))
      .join(separator);
    if (!VI_CHARS.test(joined)) return joined;
  }

  for (const pattern of patterns) {
    if (!text.includes(pattern.anchor)) continue;
    const match = pattern.regex.exec(text);
    if (!match) continue;
    const values = new Map(
      pattern.names.map((name, index) => [name, translateCore(normalize(match[index + 1]))])
    );
    // A short literal anchor must not swallow untranslated Vietnamese (e.g. "Vật liệu {0}").
    if (pattern.anchor.length < 12 && [...values.values()].some((value) => VI_CHARS.test(value))) continue;
    return pattern.en.replace(PLACEHOLDER, (whole, name: string) => values.get(name) ?? whole);
  }

  let out = text;
  for (const [vi, en] of phrases) {
    if (!VI_CHARS.test(out)) break;
    if (out.includes(vi)) out = out.split(vi).join(en);
  }
  return out;
};

/** Translate one rendered string, keeping its surrounding whitespace. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Vietnamese month labels such as "T3/2026" or "T1–T8/2026" carry no diacritics.
const translateMonthLabels = (input: string) =>
  input.replace(/\bT(1[0-2]|[1-9])(?=\s*[/–-]|\b)(\/(\d{4}))?/g, (whole, month: string, _year, year?: string) =>
    year ? `${MONTHS[Number(month) - 1]} ${year}` : MONTHS[Number(month) - 1] ?? whole
  );

export function translateToEnglish(input: string): string {
  if (!input) return input;
  if (/\bT(1[0-2]|[1-9])\b/.test(input) && !VI_CHARS.test(input)) return translateMonthLabels(input);
  if (!VI_CHARS.test(input)) return input;
  const cached = cache.get(input);
  if (cached !== undefined) return cached;
  const leading = input.match(/^\s*/)?.[0] ?? "";
  const trailing = input.match(/\s*$/)?.[0] ?? "";
  const result = `${leading}${translateCore(normalize(input))}${trailing}`;
  if (cache.size > 20000) cache.clear();
  cache.set(input, result);
  return result;
}
