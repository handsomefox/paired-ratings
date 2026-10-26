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

  // A card has room for the code, not the name. The tooltip shows the name
  // under a mouse pointer, and screen readers get it as text.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("flex w-full justify-center gap-1", className)}>
          {emoji ? (
            <span aria-hidden="true" className="text-base leading-none">
              {emoji}
            </span>
          ) : null}
          <span aria-hidden="true">{upperCode}</span>
          <span className="sr-only">{showCode ? `${text} (${upperCode})` : text}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{showCode ? `${text} (${upperCode})` : text}</TooltipContent>
    </Tooltip>
  );
}
