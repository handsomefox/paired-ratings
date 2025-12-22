"use client";

import { GenericCombobox, type ComboboxOption } from "@/components/generic-combobox";
import { flagEmoji } from "@/lib/utils";
import { OptionLabel } from "./combobox-util";

export type CountryOption = ComboboxOption;

const ANY_COUNTRY = "__any_country__";

export type CountryComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: CountryOption[];
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function CountryCombobox(props: CountryComboboxProps) {
  return (
    <GenericCombobox
      {...props}
      anyValue={ANY_COUNTRY}
      searchPlaceholder="Search countries..."
      normalizeOnSelect={(code: string) => code.toUpperCase()}
      renderLabel={(c: ComboboxOption) => (
        <OptionLabel
          emoji={flagEmoji(c.code)}
          primary={c.name || c.code.toUpperCase()}
          code={c.code.toUpperCase()}
        />
      )}
      emptyText="No countries found."
    />
  );
}
