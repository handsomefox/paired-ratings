import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailRatingPanel } from "@/features/detail/detail-rating-panel";
import { Eraser } from "lucide-react";

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
  /** Asks to clear both ratings and comments. */
  onClearRatings: () => void;
  clearDisabled: boolean;
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
  clearDisabled,
  onSave,
  saveDisabled,
  savePending,
}: DetailRatingsProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-lg sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Ratings</h2>
          <p className="text-xs text-muted-foreground">0.5–10, add a note if you want</p>
        </div>
        {/* Clear sits up here, away from Save, so a miss does not hit it. */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-full border-destructive/40 bg-destructive/10 px-3 text-xs text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onClearRatings}
            disabled={clearDisabled}
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
          <div className="inline-flex h-7 items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 text-xs">
            <span className="uppercase tracking-wide text-muted-foreground">Avg</span>
            <strong>{average}</strong>
          </div>
        </div>
      </div>

      <Separator className="my-4 sm:my-6" />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
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

      <div className="mt-4 flex justify-end sm:mt-6">
        <Button variant="gf" onClick={onSave} disabled={saveDisabled || savePending}>
          Save ratings
        </Button>
      </div>
    </div>
  );
}
