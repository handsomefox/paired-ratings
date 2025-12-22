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
  emoji?: string;
  primary: string;
  code: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {emoji ? <span className="shrink-0">{emoji}</span> : null}
      <span className="min-w-0 flex-1 truncate">{primary}</span>
      <span className="text-muted-foreground shrink-0">{code}</span>
    </div>
  );
}
