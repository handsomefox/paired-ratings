import {
  GenericCombobox,
  OptionLabel,
  type ComboboxFieldProps,
} from "@/components/generic-combobox";
import type { ApiLanguage } from "@/lib/api";
import { flagEmojiFromLanguageCode } from "@/lib/utils";

export function LanguageCombobox({
  options,
  ...props
}: ComboboxFieldProps & { options: ApiLanguage[] }) {
  return (
    <GenericCombobox
      {...props}
      options={options}
      searchPlaceholder="Search languages..."
      normalizeOnSelect={(code) => code.toLowerCase()}
      renderLabel={(l) => (
        <OptionLabel
          emoji={flagEmojiFromLanguageCode(l.code)}
          primary={l.name || l.code}
          code={l.code}
        />
      )}
      emptyText="No languages found."
    />
  );
}
