import { formatChangelogDate, recentEntries } from "@/features/changelog/changelog";
import { markChangesSeen } from "@/features/changelog/seen";
import { Sparkles } from "lucide-react";
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
            {entry.highlights?.length ? (
              <>
                <ul className="mt-3 grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
                  {entry.highlights.map((highlight) => (
                    <li
                      key={highlight.title}
                      // An inset ring, as on badges, with 1px more padding
                      // where the border was.
                      className="inset-ring inset-ring-primary/25 rounded-xl bg-gradient-to-br from-bf/15 via-card/40 to-gf/15 p-[17px]"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        {highlight.title}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {highlight.text}
                      </p>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Also
                </h3>
              </>
            ) : null}
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
