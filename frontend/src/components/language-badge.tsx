import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, flagEmojiFromLanguageCode } from "@/lib/utils";

type LanguageBadgeProps = {
  code?: string | null;
  label?: string | null;
  className?: string;
};

export function LanguageBadge({ code, label, className }: LanguageBadgeProps) {
  if (!code) return null;
  const emoji = flagEmojiFromLanguageCode(code);
  const text = label?.trim() || code.toUpperCase();

  const tooltipText = label?.trim()
    ? label.toUpperCase() === code.toUpperCase()
      ? label
      : `${label} (${code.toUpperCase()})`
    : code.toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("flex w-full justify-center gap-1", className)}>
          {emoji ? <span className="text-base leading-none">{emoji}</span> : null}
          <span className="truncate">{text}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <span className="max-w-[220px] truncate">{tooltipText}</span>
      </TooltipContent>
    </Tooltip>
  );
}
