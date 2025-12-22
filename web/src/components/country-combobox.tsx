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
import { cn, flagEmoji } from "@/lib/utils";

export type CountryOption = {
  code: string;
  name: string;
};

type CountryComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: CountryOption[];
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
};

const anyCountryValue = "__any_country__";

export function CountryCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Any",
  anyLabel = "Any",
  className,
  disabled,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false);

  const normalizedValue = value || anyCountryValue;

  const selected = useMemo(() => options.find((option) => option.code === value), [options, value]);

  const displayLabel = selected
    ? `${flagEmoji(selected.code)} ${selected.name || selected.code.toUpperCase()} (${selected.code.toUpperCase()})`
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
          <CommandInput placeholder="Search countries..." />
          <CommandList className="max-h-60">
            <CommandEmpty>No countries found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={anyCountryValue}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <span>{anyLabel}</span>
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    normalizedValue === anyCountryValue ? "opacity-100" : "opacity-0",
                  )}
                />
              </CommandItem>
              {options.map((country) => {
                const label = `${country.name || country.code} (${country.code})`;
                return (
                  <CommandItem
                    key={country.code}
                    value={country.code}
                    onSelect={() => {
                      onValueChange(country.code.toUpperCase());
                      setOpen(false);
                    }}
                  >
                    <span className="text-base leading-none">{flagEmoji(country.code)}</span>
                    <span className="flex-1">{label}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        normalizedValue === country.code ? "opacity-100" : "opacity-0",
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
