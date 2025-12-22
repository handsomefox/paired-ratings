import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCountryNames } from "@/lib/use-country-names";
import { cn, flagEmoji } from "@/lib/utils";
import { useMemo } from "react";

type OriginCountriesChipProps = {
  codes?: string[] | null;
  className?: string;
  badgeClassName?: string;
  emptyLabel?: string;
  title?: string;
  showCodes?: boolean;
  maxListHeight?: number; // px
};

export function OriginCountriesChip({
  codes,
  className,
  badgeClassName,
  emptyLabel = "No country data.",
  title = "Origin countries",
  showCodes = true,
  maxListHeight = 112, // ~max-h-28
}: OriginCountriesChipProps) {
  const originCountries = useMemo(() => (codes ?? []).filter(Boolean), [codes]);
  const primary = originCountries[0];

  const countriesQuery = useCountryNames();
  const countryNames = countriesQuery.data?.countries ?? [];

  const labelFor = (code: string) => countryNames.find((c) => c.code === code)?.name ?? code;

  if (!primary) return null;

  const badgeText = `${flagEmoji(primary)} ${primary}${
    originCountries.length > 1 ? ` +${originCountries.length - 1}` : ""
  }`;

  return (
    <div className={cn(className)}>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Badge variant="outline" className={cn(badgeClassName)}>
            {badgeText}
          </Badge>
        </HoverCardTrigger>
        <HoverCardContent className="w-64">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <ScrollArea className="mt-2 pr-2" style={{ maxHeight: maxListHeight }}>
            <div className="space-y-1 text-xs">
              {originCountries.length > 0 ? (
                originCountries.map((code) => (
                  <div key={code} className="flex items-center gap-2">
                    <span className="text-base leading-none">{flagEmoji(code)}</span>
                    <span className="flex-1">{labelFor(code)}</span>
                    {showCodes ? <span className="text-muted-foreground">{code}</span> : null}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">{emptyLabel}</div>
              )}
            </div>
          </ScrollArea>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
