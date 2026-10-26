import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Language code (ISO 639) to the region whose flag stands for it. Only used
// for languages: it must never be applied to a country code, because many
// codes collide. "IN" is India as a country but Indonesian as a language.
const REGION_BY_LANGUAGE: Record<string, string> = {
  AM: "ET",
  AR: "SA",
  ARY: "MA",
  BG: "BG",
  BN: "BD",
  BS: "BA",
  CS: "CZ",
  DA: "DK",
  DE: "DE",
  EL: "GR",
  EN: "US",
  ES: "ES",
  ET: "EE",
  FA: "IR",
  FI: "FI",
  FR: "FR",
  HA: "NG",
  HE: "IL",
  HI: "IN",
  HR: "HR",
  HU: "HU",
  ID: "ID",
  IG: "NG",
  IN: "ID",
  IS: "IS",
  IT: "IT",
  IW: "IL",
  JA: "JP",
  JI: "IL",
  KN: "IN",
  KO: "KR",
  LT: "LT",
  LV: "LV",
  MK: "MK",
  ML: "IN",
  NB: "NO",
  NL: "NL",
  NN: "NO",
  NO: "NO",
  PL: "PL",
  PT: "BR",
  RN: "BI",
  RO: "RO",
  SK: "SK",
  SL: "SI",
  SR: "RS",
  SV: "SE",
  SW: "TZ",
  TA: "IN",
  TE: "IN",
  TH: "TH",
  TR: "TR",
  UK: "UA",
  UR: "PK",
  VI: "VN",
  YO: "NG",
  ZH: "TW",
};

// Country codes that TMDB still uses for countries that no longer exist,
// mapped to the closest current flag.
const REGION_BY_HISTORICAL_COUNTRY: Record<string, string> = {
  CS: "RS",
  DD: "DE",
  SU: "RU",
  XC: "CZ",
  YU: "RS",
  ZR: "CD",
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(value?: number | null) {
  if (!value || value <= 0) return "";
  return value.toFixed(1);
}

export function formatVotes(value?: number | null) {
  if (!value || value <= 0) return "";
  return String(value);
}

export function tmdbRatingTone(value?: number | null) {
  if (!value || value <= 0) return "border-border/60 bg-muted/40 text-muted-foreground";
  if (value >= 8.0) return "border-amber-300/50 bg-amber-400/20 text-amber-100";
  if (value >= 7.0) return "border-sky-300/50 bg-sky-500/15 text-sky-100";
  if (value >= 5.0) return "border-orange-500/40 bg-orange-600/15 text-orange-200";
  return "border-border/60 bg-card/50 text-foreground";
}

export function ratingText(value?: number | null) {
  if (!value) return "-";
  return String(value);
}

export function combinedRating(bf?: number | null, gf?: number | null) {
  if (bf && gf) {
    const avg = (bf + gf) / 2;
    return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
  }
  return ratingText(bf || gf);
}

export function shortGenres(genres?: string[] | null) {
  if (!genres || genres.length === 0) return "";
  return genres.slice(0, 2).join(", ");
}

function regionFlag(region: string) {
  if (region === "RU") return String.fromCodePoint(0x1f4a9);
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (region.charCodeAt(0) - 65),
    base + (region.charCodeAt(1) - 65),
  );
}

/** Flag for an ISO 3166-1 country code, as TMDB reports it in origin_country. */
export function flagEmoji(countryCode?: string | null) {
  if (!countryCode) return "";
  let code = countryCode.trim().toUpperCase();
  code = REGION_BY_HISTORICAL_COUNTRY[code] ?? code;
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return regionFlag(code);
}

/** Flag for an ISO 639 language code, as TMDB reports it in original_language. */
export function flagEmojiFromLanguageCode(languageCode?: string | null) {
  if (!languageCode) return "";

  const lang = languageCode.trim().toLowerCase();
  if (!/^[a-z]{2,3}$/.test(lang)) return "";

  const region = REGION_BY_LANGUAGE[lang.toUpperCase()] ?? new Intl.Locale(lang).maximize().region;
  // The region is already a country code, so it goes straight to the flag and
  // is not looked up a second time.
  return region && /^[A-Z]{2}$/.test(region) ? regionFlag(region) : "";
}

export function mediaTypeLabel(mediaType: string) {
  if (mediaType === "movie") return "Movie";
  if (mediaType === "tv") return "TV";
  return mediaType;
}

export function tmdbUrl(mediaType: string, tmdbId: number) {
  return `https://www.themoviedb.org/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}`;
}

// A half-typed year like "20" is not a filter anyone means. Hold it back until
// it is a plausible four-digit year, so a list does not empty out mid-keystroke.
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

export function usableYear(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d{4}$/.test(trimmed)) return "";
  const year = Number(trimmed);
  if (year < MIN_YEAR || year > MAX_YEAR) return "";
  return trimmed;
}

export function scrollToTop() {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}
