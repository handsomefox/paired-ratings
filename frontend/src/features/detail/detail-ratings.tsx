import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailRatingPanel } from "@/features/detail/detail-rating-panel";

export type Person = "bf" | "gf";

/** One person's rating as edited on the detail page. */
export type RatingForm = {
  rating: number | null;
  comment: string;
  /** Whether the comment shows as an editor rather than as text. */
  editing: boolean;
};

export type RatingForms = Record<Person, RatingForm>;

type DetailRatingsProps = {
  names: Record<Person, string>;
  forms: RatingForms;
  onChange: (person: Person, patch: Partial<RatingForm>) => void;
  average: string;
  onClearRatings: () => void;
  clearPending: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  savePending: boolean;
};

const people: Person[] = ["bf", "gf"];

export function DetailRatings({
  names,
  forms,
  onChange,
  average,
  onClearRatings,
  clearPending,
  onSave,
  saveDisabled,
  savePending,
}: DetailRatingsProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Ratings</h2>
          <p className="text-xs text-muted-foreground">1–10, add a note if you want</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs">
          <span className="uppercase tracking-wide text-muted-foreground">Avg</span>
          <strong>{average}</strong>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid gap-6 lg:grid-cols-2">
        {people.map((person) => (
          <DetailRatingPanel
            key={person}
            tone={person}
            name={names[person]}
            rating={forms[person].rating}
            onRatingChange={(rating) => onChange(person, { rating })}
            comment={forms[person].comment}
            onCommentChange={(comment) => onChange(person, { comment })}
            editing={forms[person].editing}
            onEditingChange={(editing) => onChange(person, { editing })}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onClearRatings}
          disabled={clearPending}
        >
          Clear ratings
        </Button>
        <Button variant="gf" onClick={onSave} disabled={saveDisabled || savePending}>
          Save ratings
        </Button>
      </div>
    </div>
  );
}
