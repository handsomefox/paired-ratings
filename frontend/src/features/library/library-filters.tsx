import { CountryCombobox } from "@/components/country-combobox";
import { FilterField } from "@/components/filter-field";
import { GenreCombobox } from "@/components/genre-combobox";
import { YearRangeFields } from "@/components/year-range-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  pageSizes,
  type LibrarySort,
  type PageSize,
  type RatedFilter,
} from "@/features/library/library-search";
import type { ApiCountry } from "@/lib/api";
import { showStatusOptions, type ShowStatus } from "@/lib/status";

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
  minRating: string;
  onMinRatingChange: (value: string) => void;
  rated: RatedFilter | "any";
  onRatedChange: (value: RatedFilter | "any") => void;
  ratedOptions: Array<{ value: RatedFilter | "any"; label: string }>;
  sort: LibrarySort;
  onSortChange: (value: LibrarySort) => void;
  pageSize: PageSize;
  onPageSizeChange: (value: PageSize) => void;
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
  minRating,
  onMinRatingChange,
  rated,
  onRatedChange,
  ratedOptions,
  sort,
  onSortChange,
  pageSize,
  onPageSizeChange,
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

        <FilterField label="Ratings">
          {(id) => (
            <Select
              value={rated}
              onValueChange={(value) => onRatedChange(value as RatedFilter | "any")}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder="Ratings" />
              </SelectTrigger>
              <SelectContent>
                {ratedOptions.map((option) => (
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

        <FilterField label="Per page">
          {(id) => (
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder="Per page" />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FilterField>
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
