import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, flagEmojiFromLanguageCode } from "@/lib/utils";

type LanguageBadgeProps = {
  code: string;
  label?: string;
  className?: string;
};

export function LanguageBadge({ code, label, className }: LanguageBadgeProps) {
  if (!code) return null;
  const emoji = flagEmojiFromLanguageCode(code);
  const upperCode = code.toUpperCase();
  const text = label?.trim() || upperCode;
  const showCode = text.toUpperCase() !== upperCode;

  // The tooltip only helps with a truncated name under a mouse pointer. The
  // full name and code are also in the badge text for screen readers.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("flex w-full justify-center gap-1", className)}>
          {emoji ? (
            <span aria-hidden="true" className="text-base leading-none">
              {emoji}
            </span>
          ) : null}
          <span className="truncate">{text}</span>
          {showCode ? <span className="sr-only">({upperCode})</span> : null}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <span className="max-w-[220px] truncate">{showCode ? `${text} (${upperCode})` : text}</span>
      </TooltipContent>
    </Tooltip>
  );
}
