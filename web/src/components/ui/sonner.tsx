import { Toaster as Sonner } from "sonner";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Toaster = ({ className, ...props }: ComponentProps<typeof Sonner>) => (
  <Sonner
    className={cn("group", className)}
    toastOptions={{
      classNames: {
        toast:
          "group !bg-card/90 !text-foreground !border !border-border/60 shadow-[0_12px_40px_-22px_rgba(0,0,0,0.8)] backdrop-blur",
        description: "!text-muted-foreground",
        actionButton:
          "!bg-primary/20 !text-primary-foreground !border !border-primary/40 hover:!bg-primary/30",
        cancelButton:
          "!bg-muted/40 !text-muted-foreground !border !border-border/60 hover:!bg-muted/60",
        icon: "!text-primary",
        error: "!border-red-500/40 !text-red-100",
        success: "!border-teal-500/40 !text-teal-100",
      },
    }}
    {...props}
  />
);

export { Toaster };
