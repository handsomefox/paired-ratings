import { filenameFromDisposition } from "@/lib/download";
import { describe, expect, it } from "vitest";

describe("filenameFromDisposition", () => {
  it("reads a quoted filename", () => {
    expect(filenameFromDisposition('attachment; filename="paired-ratings-2026-10-25.db"')).toBe(
      "paired-ratings-2026-10-25.db",
    );
  });

  it("reads an unquoted filename", () => {
    expect(filenameFromDisposition("attachment; filename=show-ratings.json")).toBe(
      "show-ratings.json",
    );
  });

  it("returns undefined without a filename", () => {
    expect(filenameFromDisposition(null)).toBeUndefined();
    expect(filenameFromDisposition("attachment")).toBeUndefined();
  });
});
