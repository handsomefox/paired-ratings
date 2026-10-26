import { CountryCombobox } from "@/components/country-combobox";
import { FilterField } from "@/components/filter-field";
import { GenreCombobox } from "@/components/genre-combobox";
import { YearRangeFields } from "@/components/year-range-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { LibrarySort } from "@/features/library/library-search";
import type { ApiCountry } from "@/lib/api";
import { showStatusOptions, type ShowStatus } from "@/lib/status";
import { useId } from "react";

const statusOptions = [{ value: "all", label: "All" }, ...showStatusOptions] as const;

type LibraryFiltersProps = {
  status: ShowStatus | "all";
  onStatusChange: (value: ShowStatus | "all") => void;
  genre: string;
  onGenreChange: (value: string) => void;
  originCountry: string;
  onOriginCountryChange: (value: string) => void;
  yearFrom: string;
  onYearFromChange: (value: string) => void;
  yearTo: string;
  onYearToChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (value: LibrarySort) => void;
  unrated: boolean;
  onUnratedChange: (value: boolean) => void;
  sortOptions: Array<{ value: LibrarySort; label: string }>;
  genres: string[];
  countries: ApiCountry[];
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
  sortOptions,
  genres,
  countries,
  onRefresh,
  refreshPending,
}: LibraryFiltersProps) {
  const unratedId = useId();

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 [&>*]:min-w-0">
        <FilterField label="Status">
          {(id) => (
            <Select
              value={status}
              onValueChange={(value) => onStatusChange(value as ShowStatus | "all")}
            >
              <SelectTrigger id={id}>
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
          )}
        </FilterField>

        <FilterField label="Genre">
          {(id) => (
            <div className="w-full min-w-0">
              <GenreCombobox id={id} value={genre} onValueChange={onGenreChange} genres={genres} />
            </div>
          )}
        </FilterField>

        <FilterField label="Origin country">
          {(id) => (
            <div className="w-full min-w-0">
              <CountryCombobox
                id={id}
                value={originCountry}
                onValueChange={onOriginCountryChange}
                options={countries}
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

        <FilterField label="Sort">
          {(id) => (
            <Select value={sort} onValueChange={(value) => onSortChange(value as LibrarySort)}>
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

      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
        <Checkbox
          id={unratedId}
          checked={unrated}
          onCheckedChange={(value) => onUnratedChange(value === true)}
          aria-describedby={`${unratedId}-hint`}
        />
        <div>
          <label htmlFor={unratedId} className="cursor-pointer text-sm font-medium">
            Unrated only
          </label>
          <div id={`${unratedId}-hint`} className="text-xs text-muted-foreground">
            Hide anything with ratings.
          </div>
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
