"use client";

export function EmojiCell({ emoji }: { emoji: string }) {
  return (
    <span aria-hidden="true" className="inline-block w-[1.6em] shrink-0 text-center leading-none">
      {emoji}
    </span>
  );
}

export function OptionLabel({
  emoji,
  primary,
  code,
}: {
  emoji: string;
  primary: string;
  code: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <EmojiCell emoji={emoji} />
      <span className="min-w-0 truncate">
        {primary} ({code})
      </span>
    </span>
  );
}
