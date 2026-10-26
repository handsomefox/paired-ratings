import {
  GenericCombobox,
  OptionLabel,
  type ComboboxFieldProps,
} from "@/components/generic-combobox";
import type { ApiCountry } from "@/lib/api";
import { flagEmoji } from "@/lib/utils";

export function CountryCombobox({
  options,
  ...props
}: ComboboxFieldProps & { options: ApiCountry[] }) {
  return (
    <GenericCombobox
      {...props}
      options={options}
      searchPlaceholder="Search countries..."
      renderLabel={(c) => (
        <OptionLabel emoji={flagEmoji(c.code)} primary={c.name || c.code} code={c.code} />
      )}
      emptyText="No countries found."
    />
  );
}
