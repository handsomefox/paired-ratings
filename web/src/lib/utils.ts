import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const DEFAULT_REGION_BY_LANG: Record<string, string> = {
  AM: "ET",
  AR: "SA",
  ARY: "MA",
  BG: "BG",
  BN: "BD",
  BS: "BA",
  CS: "CZ",
  DA: "DK",
  DD: "DE",
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
  SU: "RU",
  SV: "SE",
  SW: "TZ",
  TA: "IN",
  TE: "IN",
  TH: "TH",
  TR: "TR",
  UK: "UA",
  UR: "PK",
  VI: "VN",
  XC: "CZ",
  XZ: "CZ",
  YO: "NG",
  YU: "RS",
  ZH: "TW",
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
  let code = countryCode.trim().toUpperCase();
  code = DEFAULT_REGION_BY_LANG[code] ?? code;
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
  const region = DEFAULT_REGION_BY_LANG[lang.toUpperCase()] ?? locale.region ?? "";
  if (region == "RU") return String.fromCodePoint(0x1f4a9);

  return region ? flagEmoji(region) : "";
}
