import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// The outline is an inset ring rather than a border. At a fractional display
// scale, such as 125%, the browser snaps a border's straight edges to whole
// pixels but not its curves, so a bright border on a pill looks jagged where
// they meet. A ring draws both the same way. The padding is 1px larger to make
// up for the missing border, so a badge keeps its size; set colors with
// inset-ring-*, not border-*.
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-[11px] py-[3px] text-xs font-semibold inset-ring transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "inset-ring-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "inset-ring-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "inset-ring-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "inset-ring-border text-foreground",
        bf: "inset-ring-bf/40 bg-bf/10 text-bf",
        gf: "inset-ring-gf/40 bg-gf/10 text-gf",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
