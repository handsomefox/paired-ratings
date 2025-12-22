"use client";

import { GenericCombobox, type ComboboxOption } from "@/components/generic-combobox";

export type GenreComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  genres: string[];
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
};

const ANY_GENRE = "__any_genre__";

export function GenreCombobox({
  value,
  onValueChange,
  genres,
  placeholder = "Any",
  anyLabel = "Any",
  className,
  disabled,
}: GenreComboboxProps) {
  const options: ComboboxOption[] = genres.map((g) => ({ code: g, name: g }));

  return (
    <GenericCombobox
      value={value}
      onValueChange={onValueChange}
      options={options}
      anyValue={ANY_GENRE}
      anyLabel={anyLabel}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      searchPlaceholder="Search genres..."
      normalizeOnSelect={(v) => v}
      renderLabel={(o) => <span className="truncate">{o.name}</span>}
      emptyText="No genres found."
    />
  );
}
