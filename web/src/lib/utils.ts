import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const DEFAULT_REGION_BY_LANG: Record<string, string> = {
  ar: "SA",
  bg: "BG",
  cs: "CZ",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "US",
  es: "ES",
  fi: "FI",
  fr: "FR",
  he: "IL",
  hi: "IN",
  hu: "HU",
  id: "ID",
  it: "IT",
  ja: "JP",
  ko: "KR",
  nl: "NL",
  no: "NO",
  pl: "PL",
  pt: "BR",
  rn: "BI",
  ro: "RO",
  ru: "RU",
  rw: "RW",
  sk: "SK",
  su: "RU",
  sv: "SE",
  sw: "TZ",
  th: "TH",
  tr: "TR",
  uk: "UA",
  vi: "VN",
  zh: "TW",
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

export function ratingText(value?: number | null) {
  if (!value) return "-";
  return String(value);
}

export function combinedRating(bf?: number | null, gf?: number | null) {
  if (!bf && !gf) return "-";
  if (bf && !gf) return ratingText(bf);
  if (gf && !bf) return ratingText(gf);
  if (bf && gf) {
    const avg = (bf + gf) / 2;
    if (Number.isInteger(avg)) return String(avg);
    return avg.toFixed(1);
  }
  return "-";
}

export function shortGenres(genres?: string | null) {
  if (!genres) return "";
  const parts = genres
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

export function shortGenreList(genres?: string[] | null) {
  if (!genres || genres.length === 0) return "";
  return genres.slice(0, 2).join(", ");
}

export function flagEmoji(countryCode?: string | null) {
  if (!countryCode) return "";
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  if (code == "RU") return String.fromCodePoint(0x1f4a9);
  const base = 0x1f1e6;
  return String.fromCodePoint(base + (code.charCodeAt(0) - 65), base + (code.charCodeAt(1) - 65));
}

export function flagEmojiFromLanguageCode(languageCode?: string | null) {
  if (!languageCode) return "";

  const raw = languageCode.trim();
  if (!raw) return "";

  // If caller ever passes a BCP47 tag like "pt-BR", prefer the explicit region.
  // TMDB config uses ISO639_1, but this keeps the function robust.
  const tag = raw.replace("_", "-");
  const m = tag.match(/^[a-zA-Z]{2,3}-(?<region>[a-zA-Z]{2})\b/);
  const region = m?.groups?.region?.toUpperCase();
  if (region) return flagEmoji(region);

  if (region == "RU") return String.fromCodePoint(0x1f4a9);

  const lang = raw.toLowerCase();
  if (!/^[a-z]{2,3}$/.test(lang)) return "";

  const fallbackRegion = DEFAULT_REGION_BY_LANG[lang];
  return fallbackRegion ? flagEmoji(fallbackRegion) : "";
}
