import { api } from "@/lib/api";
import { downloadResponse } from "@/lib/download";
import { queryKeys } from "@/lib/queries";
import { cn, scrollToTop } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Download,
  Home,
  ListOrdered,
  LogOut,
  MoreHorizontal,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

// Exact matching, so "/" is not marked as the current page everywhere, and
// filters in the query string do not make the link inactive.
const navActiveOptions = { exact: true, includeSearch: false } as const;

type NavTarget = "/" | "/watch-order" | "/search";

const navItems: Array<{ to: NavTarget; label: string; icon: LucideIcon }> = [
  { to: "/", label: "Library", icon: Home },
  { to: "/watch-order", label: "Watch order", icon: ListOrdered },
  { to: "/search", label: "Add", icon: Plus },
];

/**
 * Returns a click handler for a link to `to`. On that page already, the link
 * keeps the page's filters and scrolls to the top instead.
 */
function useScrollTopWhenCurrent() {
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  return (to: NavTarget) => (event: MouseEvent) => {
    if (currentPath === to) {
      event.preventDefault();
      scrollToTop();
    }
  };
}

/** The export and log out actions, shared by the header and the tab bar. */
function useAccountActions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const exportJSON = async () => {
    try {
      await downloadResponse(await api.exportData(), "show-ratings.json");
      toast.success("Exported ratings.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const exportDB = async () => {
    try {
      await downloadResponse(await api.exportDB(), "paired-ratings.db");
      toast.success("Database exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const logout = async () => {
    try {
      const session = await api.logout();
      // Drop every cached library page, not just the session, so nothing
      // private stays in memory after signing out.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, session);
      await navigate({ to: "/login" });
    } catch {
      toast.error("Log out failed.");
    }
  };

  return { exportJSON, exportDB, logout };
}

function NavLink({ to, children }: { to: NavTarget; children: ReactNode }) {
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

/**
 * The header. On phones it only carries the name and scrolls away with the
 * page, because the tab bar holds the navigation.
 */
export function Navbar() {
  const { exportJSON, exportDB, logout } = useAccountActions();
  const scrollTopWhenCurrent = useScrollTopWhenCurrent();

  return (
    <header className="z-30 border-b border-border/60 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur md:sticky md:top-0">
      <div className="mx-auto flex h-14 w-full max-w-[1720px] items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            activeOptions={navActiveOptions}
            className="flex items-center gap-3"
            onClick={scrollTopWhenCurrent("/")}
          >
            <div className="relative h-8 w-8 overflow-hidden rounded-2xl shadow-lg sm:h-9 sm:w-9">
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-bf/40 via-bf/10 to-gf/40" />
              <img
                src="/icons/logo.png"
                alt=""
                className="absolute inset-0 z-10 h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="text-sm sm:text-base">Show Ratings</div>
              <div className="hidden text-xs text-muted-foreground sm:block">
                Shared watchlist + ratings
              </div>
            </div>
          </Link>
        </div>

        <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={exportJSON}>
                <Download className="h-4 w-4" />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportDB}>
                <Download className="h-4 w-4" />
                Export DB
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="rounded-full" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}

const tabClass =
  "flex cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors";
const sheetItemClass =
  "flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-4 text-sm font-medium text-foreground/90 transition hover:bg-card";

/** The navigation on phones, at the bottom of the screen within thumb reach. */
export function TabBar() {
  const { exportJSON, exportDB, logout } = useAccountActions();
  const scrollTopWhenCurrent = useScrollTopWhenCurrent();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur md:hidden"
    >
      <div className="grid h-14 grid-cols-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={navActiveOptions}
            className={tabClass}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            onClick={scrollTopWhenCurrent(to)}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className={cn(tabClass, "text-muted-foreground")}>
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl border-border/60 bg-card pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>More</SheetTitle>
              <SheetDescription>Export your data or log out.</SheetDescription>
            </SheetHeader>
            <div className="mt-5 grid gap-2">
              <SheetClose asChild>
                <button type="button" className={sheetItemClass} onClick={exportJSON}>
                  <Download className="h-4 w-4" />
                  Export JSON
                </button>
              </SheetClose>
              <SheetClose asChild>
                <button type="button" className={sheetItemClass} onClick={exportDB}>
                  <Download className="h-4 w-4" />
                  Export DB
                </button>
              </SheetClose>
              <SheetClose asChild>
                <button type="button" className={sheetItemClass} onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
