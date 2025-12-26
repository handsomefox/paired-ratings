import { useRouterState } from "@tanstack/react-router";
import { Download, Home, LogOut, Menu, Plus } from "lucide-react";
import { toast } from "sonner";
import { NavLink } from "./nav-link";
import { Button } from "./ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { cn } from "@/lib/utils";
import { ViewTransitionLink } from "./view-transition-link";

type NavbarProps = {
  onExport: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function Navbar({ onExport, onLogout }: NavbarProps) {
  const { location } = useRouterState();
  const currentPath = location.pathname;
  const isLibrary = currentPath === "/";
  const isSearch = currentPath === "/search";

  const handleExport = async () => {
    try {
      await onExport();
      toast.success("Exported ratings.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const handleLogout = async () => {
    await onLogout();
  };

  const mobileItemClass = (active?: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-3 text-sm font-medium transition",
      active
        ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
        : "text-foreground/80 hover:bg-card/80 hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-4 sm:h-16">
        <div className="flex items-center gap-3">
          <ViewTransitionLink
            to="/"
            className="flex items-center gap-3"
            onClick={(e) => {
              if (location.pathname === "/") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <div className="relative h-8 w-8 overflow-hidden rounded-2xl shadow-lg sm:h-9 sm:w-9">
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/70 via-primary/30 to-purple-500/60" />
              <img
                src="/assets/logo.png"
                alt=""
                className="absolute inset-0 z-10 h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="font-display text-sm sm:text-base">Show Ratings</div>
              <div className="hidden text-xs text-muted-foreground sm:block">
                Shared watchlist + ratings
              </div>
            </div>
          </ViewTransitionLink>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/">Library</NavLink>
          <NavLink to="/search">Add</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full md:hidden"
              >
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
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <SheetClose asChild>
                  <ViewTransitionLink to="/" className={mobileItemClass(isLibrary)}>
                    <Home className="h-4 w-4" />
                    <span>Library</span>
                  </ViewTransitionLink>
                </SheetClose>
                <SheetClose asChild>
                  <ViewTransitionLink to="/search" className={mobileItemClass(isSearch)}>
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </ViewTransitionLink>
                </SheetClose>
                <SheetClose asChild>
                  <button type="button" className={mobileItemClass()} onClick={handleExport}>
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <button type="button" className={mobileItemClass()} onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-full md:inline-flex"
            onClick={handleExport}
          >
            Export
          </Button>

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
