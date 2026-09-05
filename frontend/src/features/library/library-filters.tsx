import { CountryCombobox, type CountryOption } from "@/components/country-combobox";
import FilterField from "@/components/filter-field";
import { GenreCombobox } from "@/components/genre-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export type LibraryFiltersProps = {
  status: string;
  onStatusChange: (value: string) => void;
  genre: string;
  onGenreChange: (value: string) => void;
  originCountry: string;
  onOriginCountryChange: (value: string) => void;
  yearFrom: string;
  onYearFromChange: (value: string) => void;
  yearTo: string;
  onYearToChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  unrated: boolean;
  onUnratedChange: (value: boolean) => void;
  statusOptions: Array<{ value: string; label: string }>;
  sortOptions: Array<{ value: string; label: string }>;
  genres: string[];
  countries: CountryOption[];
  onRefresh: () => void;
  refreshPending: boolean;
};

export function LibraryFilters({
  status,
  onStatusChange,
  genre,
  onGenreChange,
  originCountry,
  onOriginCountryChange,
  yearFrom,
  onYearFromChange,
  yearTo,
  onYearToChange,
  sort,
  onSortChange,
  unrated,
  onUnratedChange,
  statusOptions,
  sortOptions,
  genres,
  countries,
  onRefresh,
  refreshPending,
}: LibraryFiltersProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 [&>*]:min-w-0">
        <FilterField label="Status">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Genre">
          <div className="w-full min-w-0">
            <GenreCombobox
              value={genre}
              onValueChange={onGenreChange}
              genres={genres}
              placeholder="Any"
              anyLabel="Any"
            />
          </div>
        </FilterField>

        <FilterField label="Origin country">
          <div className="w-full min-w-0">
            <CountryCombobox
              value={originCountry}
              onValueChange={onOriginCountryChange}
              options={countries}
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

        <FilterField label="Sort">
          <Select value={sort} onValueChange={onSortChange}>
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
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
        <Checkbox checked={unrated} onCheckedChange={(value) => onUnratedChange(Boolean(value))} />
        <div>
          <div className="text-sm font-medium">Unrated only</div>
          <div className="text-xs text-muted-foreground">Hide anything with ratings.</div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          onClick={onRefresh}
          disabled={refreshPending}
        >
          {refreshPending ? "Refreshing..." : "Refresh TMDB"}
        </Button>
      </div>
    </div>
  );
}
