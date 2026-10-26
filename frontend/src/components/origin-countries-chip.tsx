import { badgeVariants } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCountryName } from "@/lib/queries";
import { cn, flagEmoji } from "@/lib/utils";

type OriginCountriesChipProps = {
  codes: string[];
  className?: string;
  badgeClassName?: string;
};

export function OriginCountriesChip({
  codes,
  className,
  badgeClassName,
}: OriginCountriesChipProps) {
  const originCountries = codes.filter(Boolean);
  const primary = originCountries[0];

  const labelFor = useCountryName();

  if (!primary) return null;

  const extra = originCountries.length - 1;

  // A popover rather than a hover card: it opens on tap and from the keyboard,
  // and the library is mostly used on phones.
  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger
          className={cn(badgeVariants({ variant: "outline" }), "cursor-pointer", badgeClassName)}
        >
          <span aria-hidden="true">{flagEmoji(primary)}</span> {primary}
          {extra > 0 ? ` +${extra}` : ""}
          {/* Added to the visible text, not replacing it, so the name a
              screen reader announces still contains what is on screen. */}
          <span className="sr-only">
            . Origin countries: {originCountries.map(labelFor).join(", ")}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Origin countries
          </div>
          <ScrollArea className="mt-2 max-h-28 pr-2">
            <ul className="space-y-1 text-xs">
              {originCountries.map((code) => (
                <li key={code} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-base leading-none">
                    {flagEmoji(code)}
                  </span>
                  <span className="flex-1">{labelFor(code)}</span>
                  <span className="text-muted-foreground">{code}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
