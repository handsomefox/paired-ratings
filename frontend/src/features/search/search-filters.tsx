import { CountryCombobox, type CountryOption } from "@/components/country-combobox";
import FilterField from "@/components/filter-field";
import { LanguageCombobox, type LanguageOption } from "@/components/language-combobox";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import {
  sortOptions,
  type Sort,
} from "@/features/search/search-constants";

export type SearchGenreOption = {
  id: number;
  name: string;
};

type SearchFiltersProps = {
  genreMode: "all" | "any";
  onGenreModeChange: (value: "all" | "any") => void;
  selectedGenres: string[];
  onSelectedGenresChange: (next: string[]) => void;
  availableGenres: SearchGenreOption[];
  genresLoading: boolean;
  originCountry: string;
  onOriginCountryChange: (value: string) => void;
  originalLanguage: string;
  onOriginalLanguageChange: (value: string) => void;
  availableCountries: CountryOption[];
  availableLanguages: LanguageOption[];
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
  onReset: () => void;
};

export function SearchFilters({
  genreMode,
  onGenreModeChange,
  selectedGenres,
  onSelectedGenresChange,
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
  onReset,
}: SearchFiltersProps) {
  return (
    <div className="space-y-5">
      <FilterField label="Genres">
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3">
          <Select
            value={genreMode}
            onValueChange={(value) => onGenreModeChange(value as "all" | "any")}
          >
            <SelectTrigger>
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
                return (
                  <label key={genre.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        if (value) onSelectedGenresChange([...selectedGenres, id]);
                        else onSelectedGenresChange(selectedGenres.filter((val) => val !== id));
                      }}
                    />
                    <span>{genre.name}</span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </FilterField>

      <FilterField label="Origin country">
        <div className="w-full min-w-0">
          <CountryCombobox
            value={originCountry}
            onValueChange={onOriginCountryChange}
            options={availableCountries}
            placeholder="Any"
            anyLabel="Any"
          />
        </div>
      </FilterField>

      <FilterField label="Original language">
        <div className="w-full min-w-0">
          <LanguageCombobox
            value={originalLanguage}
            onValueChange={onOriginalLanguageChange}
            options={availableLanguages}
            placeholder="Any"
            anyLabel="Any"
          />
        </div>
      </FilterField>

      <div className="grid grid-cols-2 gap-3">
        <FilterField label="Year from">
          <Input
            type="number"
            min={1900}
            max={2100}
            value={yearFrom}
            onChange={(event) => onYearFromChange(event.target.value)}
          />
        </FilterField>
        <FilterField label="Year to">
          <Input
            type="number"
            min={1900}
            max={2100}
            value={yearTo}
            onChange={(event) => onYearToChange(event.target.value)}
          />
        </FilterField>
      </div>

      <FilterField label="Min TMDB rating">
        <Input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={minRating}
          onChange={(event) => onMinRatingChange(event.target.value)}
        />
      </FilterField>

      <FilterField label="Min reviews">
        <Input
          type="number"
          min={0}
          max={1000000}
          step={1}
          value={minVotes}
          onChange={(event) => onMinVotesChange(event.target.value)}
        />
      </FilterField>

      <FilterField label="Sort">
        <Select value={sort} onValueChange={(value) => onSortChange(value as Sort)}>
          <SelectTrigger>
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
      </FilterField>

      <Separator />

      <Button type="button" variant="ghost" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
