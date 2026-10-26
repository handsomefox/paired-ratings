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
          {showCode ? (
            <>
              {/* A two-column phone card fits the code but not the name. */}
              <span className="sm:hidden" aria-hidden="true">
                {upperCode}
              </span>
              <span className="sr-only sm:hidden">{text}</span>
              <span className="truncate max-sm:hidden">{text}</span>
              <span className="sr-only">({upperCode})</span>
            </>
          ) : (
            <span className="truncate">{text}</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{showCode ? `${text} (${upperCode})` : text}</TooltipContent>
    </Tooltip>
  );
}
