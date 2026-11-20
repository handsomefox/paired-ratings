import { formatChangelogDate, recentEntries } from "@/features/changelog/changelog";
import { markChangesSeen } from "@/features/changelog/seen";
import { useEffect } from "react";

export function WhatsNewPage() {
  const entries = recentEntries();

  useEffect(() => {
    markChangesSeen();
  }, []);

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl">What's new</h1>
        <p className="text-sm text-muted-foreground">Changes to the app over the last month.</p>
      </div>

      <ol className="space-y-4">
        {entries.map((entry) => (
          <li
            key={entry.date}
            className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-lg sm:p-6"
          >
            <h2 className="text-sm font-semibold tabular-nums text-muted-foreground">
              <time dateTime={entry.date}>{formatChangelogDate(entry.date)}</time>
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-primary/70">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
