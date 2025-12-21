import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ViewTransitionLink } from "@/components/view-transition-link";

type NavLinkProps = {
  to: "/" | "/search";
  children: ReactNode;
};

export function NavLink({ to, children }: NavLinkProps) {
  const { location } = useRouterState();
  const active = location.pathname === to;
  return (
    <ViewTransitionLink
      to={to}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </ViewTransitionLink>
  );
}
