import { CountryCombobox } from "@/components/country-combobox";
import { FilterField } from "@/components/filter-field";
import { LanguageCombobox } from "@/components/language-combobox";
import { YearRangeFields } from "@/components/year-range-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sortOptions, type Sort } from "@/features/search/search-constants";
import { cn } from "@/lib/utils";
import { Ban } from "lucide-react";
import type { GenreMode } from "@/features/search/search-utils";
import type { ApiCountry, ApiGenre, ApiLanguage } from "@/lib/api";

type SearchFiltersProps = {
  genreMode: GenreMode;
  onGenreModeChange: (value: GenreMode) => void;
  selectedGenres: string[];
  excludedGenres: string[];
  /** A genre is either selected, excluded, or neither, so both lists change together. */
  onGenresChange: (next: { selected: string[]; excluded: string[] }) => void;
  availableGenres: ApiGenre[];
  genresLoading: boolean;
  originCountry: string;
  onOriginCountryChange: (value: string) => void;
  originalLanguage: string;
  onOriginalLanguageChange: (value: string) => void;
  availableCountries: ApiCountry[];
  availableLanguages: ApiLanguage[];
  yearFrom: string;
  onYearFromChange: (value: string) => void;
  yearTo: string;
  onYearToChange: (value: string) => void;
  minRating: string;
  onMinRatingChange: (value: string) => void;
  minVotes: string;
  onMinVotesChange: (value: string) => void;
  sort: Sort;
  onSortChange: (value: Sort) => void;
};

export function SearchFilters({
  genreMode,
  onGenreModeChange,
  selectedGenres,
  excludedGenres,
  onGenresChange,
  availableGenres,
  genresLoading,
  originCountry,
  onOriginCountryChange,
  originalLanguage,
  onOriginalLanguageChange,
  availableCountries,
  availableLanguages,
  yearFrom,
  onYearFromChange,
  yearTo,
  onYearToChange,
  minRating,
  onMinRatingChange,
  minVotes,
  onMinVotesChange,
  sort,
  onSortChange,
}: SearchFiltersProps) {
  return (
    <div className="space-y-5">
      <FilterField label="Genres" group>
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3">
          <Select
            value={genreMode}
            onValueChange={(value) => onGenreModeChange(value as GenreMode)}
          >
            <SelectTrigger aria-label="Genre match">
              <SelectValue placeholder="Match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Match all selected</SelectItem>
              <SelectItem value="any">Match any selected</SelectItem>
            </SelectContent>
          </Select>

          <ScrollArea className="h-48 pr-2">
            <div className="space-y-2">
              {genresLoading ? (
                <div className="text-xs text-muted-foreground">Loading genres…</div>
              ) : null}
              {!genresLoading && availableGenres.length === 0 ? (
                <div className="text-xs text-muted-foreground">No genres found.</div>
              ) : null}
              {availableGenres.map((genre) => {
                const id = String(genre.id);
                const checked = selectedGenres.includes(id);
                const excluded = excludedGenres.includes(id);
                const without = (list: string[]) => list.filter((value) => value !== id);
                return (
                  <div key={genre.id} className="flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          onGenresChange({
                            selected:
                              value === true ? [...selectedGenres, id] : without(selectedGenres),
                            excluded: without(excludedGenres),
                          })
                        }
                      />
                      <span className={cn(excluded && "text-muted-foreground line-through")}>
                        {genre.name}
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-pressed={excluded}
                      aria-label={`Exclude ${genre.name}`}
                      title={`Exclude ${genre.name}`}
                      onClick={() =>
                        onGenresChange({
                          selected: without(selectedGenres),
                          excluded: excluded ? without(excludedGenres) : [...excludedGenres, id],
                        })
                      }
                      className={cn(
                        "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
                        excluded
                          ? "bg-destructive/15 text-destructive"
                          : "text-muted-foreground/60 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </FilterField>

      <FilterField label="Origin country">
        {(id) => (
          <div className="w-full min-w-0">
            <CountryCombobox
              id={id}
              value={originCountry}
              onValueChange={onOriginCountryChange}
              options={availableCountries}
            />
          </div>
        )}
      </FilterField>

      <FilterField label="Original language">
        {(id) => (
          <div className="w-full min-w-0">
            <LanguageCombobox
              id={id}
              value={originalLanguage}
              onValueChange={onOriginalLanguageChange}
              options={availableLanguages}
            />
          </div>
        )}
      </FilterField>

      <YearRangeFields
        yearFrom={yearFrom}
        onYearFromChange={onYearFromChange}
        yearTo={yearTo}
        onYearToChange={onYearToChange}
      />

      <FilterField label="Min TMDB rating">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={10}
            step={0.1}
            value={minRating}
            onChange={(event) => onMinRatingChange(event.target.value)}
          />
        )}
      </FilterField>

      <FilterField label="Min reviews">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={1000000}
            step={1}
            value={minVotes}
            onChange={(event) => onMinVotesChange(event.target.value)}
          />
        )}
      </FilterField>

      <FilterField label="Sort">
        {(id) => (
          <Select value={sort} onValueChange={(value) => onSortChange(value as Sort)}>
            <SelectTrigger id={id}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FilterField>
    </div>
  );
}
