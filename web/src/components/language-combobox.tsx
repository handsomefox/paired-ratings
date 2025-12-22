import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, flagEmojiFromLanguageCode } from "@/lib/utils";

export type LanguageOption = {
  code: string;
  name: string;
};

type LanguageComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: LanguageOption[];
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
};

const anyLanguageValue = "__any_language__";

export function LanguageCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Any",
  anyLabel = "Any",
  className,
  disabled,
}: LanguageComboboxProps) {
  const [open, setOpen] = useState(false);

  const normalizedValue = value || anyLanguageValue;

  const selected = useMemo(() => options.find((option) => option.code === value), [options, value]);

  const displayLabel = selected
    ? `${flagEmojiFromLanguageCode(selected.code)} ${selected.name || selected.code.toUpperCase()} (${selected.code.toUpperCase()})`
    : anyLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className="truncate">{selected ? displayLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search languages..." />
          <CommandList className="max-h-60">
            <CommandEmpty>No languages found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={anyLanguageValue}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <span>{anyLabel}</span>
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    normalizedValue === anyLanguageValue ? "opacity-100" : "opacity-0",
                  )}
                />
              </CommandItem>
              {options.map((language) => {
                const label = `${flagEmojiFromLanguageCode(language.code)} ${language.name || language.code} (${language.code})`;
                return (
                  <CommandItem
                    key={language.code}
                    value={language.code}
                    onSelect={() => {
                      onValueChange(language.code.toLowerCase());
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1">{label}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        normalizedValue === language.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
