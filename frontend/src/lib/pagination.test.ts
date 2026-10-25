import { getPageItems } from "@/lib/pagination";
import { describe, expect, it } from "vitest";

describe("getPageItems", () => {
  it("lists every page when they all fit", () => {
    expect(getPageItems(5, 3, 2, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows a single page as itself", () => {
    expect(getPageItems(1, 1, 2, 1)).toEqual([1]);
  });

  it("puts an ellipsis on each side of the current page in the middle", () => {
    expect(getPageItems(20, 10, 2, 1)).toEqual([1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20]);
  });

  it("has no leading ellipsis near the start", () => {
    expect(getPageItems(20, 2, 1, 1)).toEqual([1, 2, 3, "ellipsis", 20]);
  });

  it("has no trailing ellipsis near the end", () => {
    expect(getPageItems(20, 19, 1, 1)).toEqual([1, "ellipsis", 18, 19, 20]);
  });
});
