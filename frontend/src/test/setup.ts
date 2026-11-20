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

// jsdom has no ResizeObserver either, and Radix's ScrollArea needs one once
// it has content. Nothing in jsdom has a size, so nothing ever resizes.
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Node's own localStorage global hides jsdom's, and Node leaves it undefined
// unless it runs with --localstorage-file. Use an in-memory one instead.
if (typeof globalThis.localStorage?.getItem !== "function") {
  const items = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
