import { FilterField } from "@/components/filter-field";
import { Input } from "@/components/ui/input";
import { MAX_YEAR, MIN_YEAR } from "@/lib/utils";

type YearRangeFieldsProps = {
  yearFrom: string;
  onYearFromChange: (value: string) => void;
  yearTo: string;
  onYearToChange: (value: string) => void;
};

export function YearRangeFields({
  yearFrom,
  onYearFromChange,
  yearTo,
  onYearToChange,
}: YearRangeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FilterField label="Year from">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={yearFrom}
            onChange={(event) => onYearFromChange(event.target.value)}
          />
        )}
      </FilterField>
      <FilterField label="Year to">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={yearTo}
            onChange={(event) => onYearToChange(event.target.value)}
          />
        )}
      </FilterField>
    </div>
  );
}
