import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

type InfoHintProps = {
  /** Names the button, such as "About Refresh TMDB". */
  label: string;
  children: ReactNode;
};

/**
 * An (i) button that explains the control next to it. A mouse opens it by
 * hovering. A tooltip alone would never open on a phone, so a tap or the
 * keyboard opens it too.
 */
export function InfoHint({ label, children }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  // What pressed the button last. The click's own pointerType cannot tell:
  // Safari on iOS reports a tap's click as "mouse".
  const pressedBy = useRef<string | null>(null);
  const hover = (next: boolean) => (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onPointerDown={(event) => {
          pressedBy.current = event.pointerType;
        }}
        // Hovering already opened it, so a mouse click would only toggle it
        // shut under the pointer. A tap, a pen, or the keyboard, which
        // presses no pointer at all, still toggles it.
        onClick={(event) => {
          if (pressedBy.current === "mouse") event.preventDefault();
          pressedBy.current = null;
        }}
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-64 p-3 text-xs leading-relaxed text-muted-foreground"
        // Hovering opens it, so taking focus would move the page for nothing.
        // Focus never moves in, so it need not move back on close either;
        // moving it back would ring the button after a mere hover.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
