import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type FilterFieldProps = {
  label: string;
  className?: string;
} & (
  | {
      /** Gets the id to put on the control, so the label names it. */
      children: (controlId: string) => ReactNode;
      group?: false;
    }
  | {
      /** Several controls under one heading, such as a checkbox list. */
      children: ReactNode;
      group: true;
    }
);

const FilterField = ({ label, className, ...rest }: FilterFieldProps) => {
  const id = useId();

  if (rest.group) {
    const labelId = `${id}-label`;
    return (
      <div role="group" aria-labelledby={labelId} className={cn("space-y-2", className)}>
        <div id={labelId} className={labelClass}>
          {label}
        </div>
        {rest.children}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {rest.children(id)}
    </div>
  );
};

export default FilterField;
