import { api } from "@/lib/api";
import { downloadResponse } from "@/lib/download";
import { queryKeys } from "@/lib/queries";
import { scrollToTop } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Download,
  Home,
  ListOrdered,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
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

const mobileItemClass =
  "flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-3 text-sm font-medium transition";
const mobileInactiveClass = "text-foreground/80 hover:bg-card/80 hover:text-foreground";
const mobileActiveClass =
  "border-primary/50 bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]";

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

export function Navbar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  const handleExport = async () => {
    try {
      await downloadResponse(await api.exportData(), "show-ratings.json");
      toast.success("Exported ratings.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const handleExportDB = async () => {
    try {
      await downloadResponse(await api.exportDB(), "paired-ratings.db");
      toast.success("Database exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const handleLogout = async () => {
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

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1720px] items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            activeOptions={navActiveOptions}
            className="flex items-center gap-3"
            onClick={(e) => {
              // Already on the library: keep its filters and go to the top.
              if (currentPath === "/") {
                e.preventDefault();
                scrollToTop();
              }
            }}
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

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-full md:hidden">
                <span className="sr-only">Open menu</span>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="border-t border-border/60 bg-card/95 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <SheetHeader>
                <SheetTitle>Quick actions</SheetTitle>
                <SheetDescription className="sr-only">
                  Navigate between pages or run account actions.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <SheetClose key={to} asChild>
                    <Link
                      to={to}
                      activeOptions={navActiveOptions}
                      className={mobileItemClass}
                      activeProps={{ className: mobileActiveClass }}
                      inactiveProps={{ className: mobileInactiveClass }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <button
                    type="button"
                    className={`${mobileItemClass} ${mobileInactiveClass}`}
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <button
                    type="button"
                    className={`${mobileItemClass} ${mobileInactiveClass}`}
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4" />
                    <span>Export JSON</span>
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <button
                    type="button"
                    className={`${mobileItemClass} ${mobileInactiveClass}`}
                    onClick={handleExportDB}
                  >
                    <Download className="h-4 w-4" />
                    <span>Export DB</span>
                  </button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hidden rounded-full md:inline-flex"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleExport}>
                <Download className="h-4 w-4" />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportDB}>
                <Download className="h-4 w-4" />
                Export DB
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-full md:inline-flex"
            onClick={handleLogout}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
