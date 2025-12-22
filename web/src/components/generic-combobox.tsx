import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

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
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  code: string;
  name: string;
};

type GenericComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  anyValue: string;
  renderLabel: (option: ComboboxOption) => JSX.Element;
  normalizeOnSelect: (code: string) => string;
  searchPlaceholder: string;
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
};

export function GenericCombobox({
  value,
  onValueChange,
  options,
  anyValue,
  renderLabel,
  normalizeOnSelect,
  searchPlaceholder,
  placeholder = "Any",
  anyLabel = "Any",
  className,
  disabled,
  emptyText = "No results found.",
}: GenericComboboxProps) {
  const [open, setOpen] = useState(false);

  const normalizedValue = value || anyValue;

  const selected = useMemo(() => options.find((option) => option.code === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal text-left", className)}
          disabled={disabled}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            {selected ? renderLabel(selected) : <span className="truncate">{placeholder}</span>}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList
            className="max-h-[min(15rem,calc(100svh-12rem))] overflow-y-auto overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={anyValue}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
                className="flex items-center"
              >
                <span className="min-w-0 flex-1 truncate">{anyLabel}</span>
                <Check
                  className={cn(
                    "ml-2 h-4 w-4 shrink-0",
                    normalizedValue === anyValue ? "opacity-100" : "opacity-0",
                  )}
                />
              </CommandItem>

              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.code} ${option.name}`.toLowerCase()}
                  onSelect={() => {
                    onValueChange(normalizeOnSelect(option.code));
                    setOpen(false);
                  }}
                  className="flex items-center"
                >
                  <span className="min-w-0 flex-1 truncate">{renderLabel(option)}</span>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4 shrink-0",
                      normalizedValue === option.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
