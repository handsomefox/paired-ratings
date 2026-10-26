import { useEffect, useEffectEvent, useState } from "react";

/**
 * The text of an input that writes a search param. The input follows every
 * keystroke, and `commit` writes the cleaned text to the URL once the reader
 * pauses, so typing "2015" sends one request rather than four.
 *
 * `urlValue` is what the URL holds now. When it changes for another reason,
 * such as Reset, a link, or the back button, it replaces the typed text.
 */
export function useTypedSearchValue(
  urlValue: string,
  commit: (value: string) => void,
  options: { delay: number; clean?: (raw: string) => string },
): [string, (text: string) => void] {
  const { delay, clean = (raw) => raw.trim() } = options;
  const [text, setText] = useState(urlValue);
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);
  const pending = clean(text);

  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);
    // The URL caught up with what was typed. Keep the text as it is, so
    // "2015 " does not lose its space while the reader is still typing.
    if (pending !== urlValue) setText(urlValue);
  }

  const onCommit = useEffectEvent(commit);
  useEffect(() => {
    // Nothing to write, which is also the case on mount: the URL is only ever
    // changed by an edit, so the history entry and its scroll position stay.
    if (pending === urlValue) return;
    const timer = window.setTimeout(() => onCommit(pending), delay);
    return () => window.clearTimeout(timer);
  }, [pending, urlValue, delay]);

  return [text, setText];
}
