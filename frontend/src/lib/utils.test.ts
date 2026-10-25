import {
  combinedRating,
  flagEmoji,
  flagEmojiFromLanguageCode,
  shortGenres,
  usableYear,
} from "@/lib/utils";
import { describe, expect, it } from "vitest";

// Builds the expected flag from two regional indicator letters.
const flag = (region: string) =>
  String.fromCodePoint(...[...region].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

describe("flagEmoji", () => {
  it.each([
    ["IN", "IN"],
    ["PT", "PT"],
    ["AR", "AR"],
    ["ET", "ET"],
    ["AM", "AM"],
    ["SV", "SV"],
    ["GB", "GB"],
  ])("shows the flag of country %s itself", (code, region) => {
    expect(flagEmoji(code)).toBe(flag(region));
  });

  it("maps codes for countries that no longer exist", () => {
    expect(flagEmoji("YU")).toBe(flag("RS"));
    expect(flagEmoji("DD")).toBe(flag("DE"));
  });

  it("accepts lower case and surrounding spaces", () => {
    expect(flagEmoji(" de ")).toBe(flag("DE"));
  });

  it("returns nothing for an empty or malformed code", () => {
    expect(flagEmoji("")).toBe("");
    expect(flagEmoji(undefined)).toBe("");
    expect(flagEmoji("USA")).toBe("");
  });
});

describe("flagEmojiFromLanguageCode", () => {
  it.each([
    ["hi", "IN"],
    ["ta", "IN"],
    ["te", "IN"],
    ["am", "ET"],
    ["en", "US"],
    ["pt", "BR"],
    ["ja", "JP"],
  ])("maps language %s to the flag of %s", (code, region) => {
    expect(flagEmojiFromLanguageCode(code)).toBe(flag(region));
  });

  it("returns nothing for a malformed code", () => {
    expect(flagEmojiFromLanguageCode("")).toBe("");
    expect(flagEmojiFromLanguageCode("english")).toBe("");
  });
});

describe("combinedRating", () => {
  it("averages two ratings", () => {
    expect(combinedRating(8, 6)).toBe("7");
    expect(combinedRating(8, 7)).toBe("7.5");
  });

  it("uses the only rating when one is missing", () => {
    expect(combinedRating(9, undefined)).toBe("9");
    expect(combinedRating(null, 4)).toBe("4");
  });

  it("shows a dash when neither person has rated", () => {
    expect(combinedRating(undefined, undefined)).toBe("-");
  });
});

describe("usableYear", () => {
  it("passes a plausible four-digit year through", () => {
    expect(usableYear("2015")).toBe("2015");
    expect(usableYear(" 1999 ")).toBe("1999");
  });

  it("holds back a half-typed or implausible year", () => {
    expect(usableYear("")).toBe("");
    expect(usableYear("20")).toBe("");
    expect(usableYear("1800")).toBe("");
    expect(usableYear("3000")).toBe("");
    expect(usableYear("20a5")).toBe("");
  });
});

describe("shortGenres", () => {
  it("keeps the first two genres", () => {
    expect(shortGenres(["Drama", "Crime", "Mystery"])).toBe("Drama, Crime");
    expect(shortGenres([])).toBe("");
  });
});
