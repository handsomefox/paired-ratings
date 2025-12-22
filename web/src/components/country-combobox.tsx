import { GenericCombobox, type ComboboxOption } from "@/components/generic-combobox";
import { flagEmoji } from "@/lib/utils";

export type CountryOption = ComboboxOption;

const ANY_COUNTRY = "__any_country__";

type CountryComboboxProps = {
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
      renderLabel={(c: ComboboxOption) =>
        `${flagEmoji(c.code)} ${c.name || c.code.toUpperCase()} (${c.code.toUpperCase()})`
      }
      emptyText="No countries found."
    />
  );
}
