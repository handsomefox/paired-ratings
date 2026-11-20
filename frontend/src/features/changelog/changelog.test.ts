import { changelog, formatChangelogDate, recentEntries } from "@/features/changelog/changelog";
import { describe, expect, it } from "vitest";

describe("changelog", () => {
  // The page and the "new" dot both take the first entry as the newest.
  it("lists real dates, newest first, each with changes", () => {
    for (const entry of changelog) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.date))).toBe(false);
      expect(entry.changes.length).toBeGreaterThan(0);
    }
    const dates = changelog.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("shows the month up to the newest entry", () => {
    const entries = [
      { date: "2026-11-20", changes: ["a"] },
      { date: "2026-10-20", changes: ["b"] },
      { date: "2026-10-19", changes: ["c"] },
    ];
    expect(recentEntries(entries).map((entry) => entry.date)).toEqual(["2026-11-20", "2026-10-20"]);
    expect(recentEntries([])).toEqual([]);
  });

  it("writes the date day first", () => {
    expect(formatChangelogDate("2026-11-05")).toBe("05.11.2026");
  });
});
