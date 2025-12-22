import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const DEFAULT_REGION_BY_LANG: Record<string, string> = {
  AR: "SA",
  CS: "CZ",
  DA: "DK",
  EL: "GR",
  EN: "US",
  HE: "IL",
  HI: "IN",
  KO: "KR",
  NO: "NO",
  PT: "BR",
  RN: "BI",
  SU: "RU",
  SV: "SE",
  SW: "TZ",
  UK: "UA",
  VI: "VN",
  ZH: "TW",
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

  const lang = languageCode.trim().toLowerCase();
  if (!/^[a-z]{2,3}$/.test(lang)) return "";

  const locale = new Intl.Locale(lang).maximize();
  let region = locale.region;
  if (!region) {
    region = DEFAULT_REGION_BY_LANG[lang.toUpperCase()];
  }
  if (region == "RU") return String.fromCodePoint(0x1f4a9);

  return region ? flagEmoji(region) : "";
}
