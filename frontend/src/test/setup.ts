import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no matchMedia. Every query reads as not matching, which gives the
// phone layout.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) satisfies MediaQueryList;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
