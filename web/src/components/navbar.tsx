import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { NavLink } from "./nav-link";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ViewTransitionLink } from "./view-transition-link";

type NavbarProps = {
  onExport: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function Navbar({ onExport, onLogout }: NavbarProps) {
  const navigate = useNavigate();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ViewTransitionLink
            to="/"
            className="flex items-center gap-3"
            onClick={(e) => {
              if (router.state.location.pathname === "/") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <div className="relative h-9 w-9 rounded-2xl shadow-lg overflow-hidden">
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/70 via-primary/30 to-purple-500/60" />
              <img
                src="/assets/logo.png"
                alt=""
                className="absolute inset-0 z-10 h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="text-base font-display">Show Ratings</div>
              <div className="text-xs text-muted-foreground">Shared watchlist + ratings</div>
            </div>
          </ViewTransitionLink>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/">Library</NavLink>
          <NavLink to="/search">Add</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full md:hidden">
                <span className="sr-only">Open menu</span>
                <span className="text-lg leading-none">≡</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem onClick={() => void navigate({ to: "/" })}>
                Library
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate({ to: "/search" })}>
                Add
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await onExport();
                    toast.success("Exported ratings.");
                  } catch {
                    toast.error("Export failed.");
                  }
                }}
              >
                Export
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={async () => {
                  await onLogout();
                }}
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-full md:inline-flex"
            onClick={async () => {
              try {
                await onExport();
                toast.success("Exported ratings.");
              } catch {
                toast.error("Export failed.");
              }
            }}
          >
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-full md:inline-flex"
            onClick={async () => {
              await onLogout();
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
