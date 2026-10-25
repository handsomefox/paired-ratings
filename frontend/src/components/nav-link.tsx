import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type NavLinkProps = {
  to: "/" | "/watch-order" | "/search";
  children: ReactNode;
};

// Exact matching, so "/" is not marked as the current page everywhere, and
// filters in the query string do not make the link inactive.
const navActiveOptions = { exact: true, includeSearch: false } as const;

export function NavLink({ to, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      activeOptions={navActiveOptions}
      className="rounded-full px-4 py-2 text-sm font-medium transition"
      activeProps={{
        className: "bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]",
      }}
      inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
    >
      {children}
    </Link>
  );
}
