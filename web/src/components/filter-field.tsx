import * as React from "react";

import { cn } from "@/lib/utils";

type FilterFieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
};

const FilterField = ({ label, children, className, labelClassName }: FilterFieldProps) => (
  <div className={cn("space-y-2", className)}>
    <label
      className={cn(
        "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        labelClassName,
      )}
    >
      {label}
    </label>
    {children}
  </div>
);

export default FilterField;
