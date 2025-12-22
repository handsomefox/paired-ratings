"use client";

import { GenericCombobox, type ComboboxOption } from "@/components/generic-combobox";
import { flagEmojiFromLanguageCode } from "@/lib/utils";
import { OptionLabel } from "./combobox-util";

export type LanguageOption = ComboboxOption;

const ANY_LANGUAGE = "__any_language__";

export type LanguageComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: LanguageOption[];
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function LanguageCombobox(props: LanguageComboboxProps) {
  return (
    <GenericCombobox
      {...props}
      anyValue={ANY_LANGUAGE}
      searchPlaceholder="Search languages..."
      normalizeOnSelect={(code: string) => code.toLowerCase()}
      renderLabel={(l: ComboboxOption) => (
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
