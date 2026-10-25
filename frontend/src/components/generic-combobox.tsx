import { Check, ChevronsUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

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

// cmdk needs a value for the "Any" row. No option code starts with "__".
const ANY_VALUE = "__any__";

/** Props shared by the country, language, and genre pickers. */
export type ComboboxFieldProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  anyLabel?: string;
  className?: string;
  disabled?: boolean;
};

type GenericComboboxProps = ComboboxFieldProps & {
  options: ComboboxOption[];
  renderLabel: (option: ComboboxOption) => ReactNode;
  normalizeOnSelect?: (code: string) => string;
  searchPlaceholder: string;
  emptyText?: string;
};

export function OptionLabel({
  emoji,
  primary,
  code,
}: {
  emoji?: string;
  primary: string;
  code: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {emoji ? (
        <span aria-hidden="true" className="shrink-0">
          {emoji}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{primary}</span>
      <span className="shrink-0 text-muted-foreground">{code}</span>
    </span>
  );
}

export function GenericCombobox({
  id,
  value,
  onValueChange,
  options,
  renderLabel,
  normalizeOnSelect = (code) => code,
  searchPlaceholder,
  placeholder = "Any",
  anyLabel = "Any",
  className,
  disabled,
  emptyText = "No results found.",
}: GenericComboboxProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const selected = options.find((option) => option.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full min-w-0 max-w-full justify-between overflow-hidden text-left font-normal",
            className,
          )}
          disabled={disabled}
        >
          <span className="min-w-0 max-w-full flex-1 overflow-hidden whitespace-nowrap">
            {selected ? renderLabel(selected) : <span className="truncate">{placeholder}</span>}
          </span>

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          {isDesktop ? <CommandInput placeholder={searchPlaceholder} /> : null}
          <CommandList
            className="max-h-[min(15rem,calc(100svh-12rem))] touch-pan-y overflow-y-auto overscroll-contain pr-2"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={ANY_VALUE}
                keywords={[anyLabel]}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
                className="flex items-center"
              >
                <span className="min-w-0 flex-1 truncate">{anyLabel}</span>
                <Check
                  className={cn("ml-2 h-4 w-4 shrink-0", value ? "opacity-0" : "opacity-100")}
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
                      value === option.code ? "opacity-100" : "opacity-0",
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
