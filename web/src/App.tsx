import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { api } from "./lib/api";
import { NavLink } from "./components/nav-link";
import { ViewTransitionLink } from "./components/view-transition-link";
import { LibraryPage } from "./pages/library";
import { SearchPage } from "./pages/search";
import { DetailPage } from "./pages/detail";
import { LoginPage } from "./pages/login";
import { Loading } from "./components/loading";
import { Button } from "./components/ui/button";
import { withViewTransition } from "./lib/view-transitions";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";

export type AppContext = {
  queryClient: QueryClient;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RootLayout = () => {
  const navigate = useNavigate();
  const state = useRouterState();
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
  });

  const authed = sessionQuery.data?.authenticated ?? false;

  useEffect(() => {
    if (sessionQuery.isLoading) return;
    if (!authed && !state.location.pathname.startsWith("/login")) {
      withViewTransition(() => {
        void navigate({ to: "/login" });
      });
    }
  }, [authed, sessionQuery.isLoading, state.location.pathname, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.location.pathname]);

  if (sessionQuery.isLoading) {
    return (
      <main className="container py-16">
        <Loading />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {authed ? (
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur">
          <div className="container flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ViewTransitionLink to="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/70 via-primary/30 to-purple-500/60 text-sm font-semibold text-foreground shadow-lg">
                  SR
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full md:hidden">
                    <span className="sr-only">Open menu</span>
                    <span className="text-lg leading-none">≡</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                        const res = await api.exportData();
                        if (!res.ok) {
                          throw new Error("export failed");
                        }
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "show-ratings.json";
                        a.click();
                        window.URL.revokeObjectURL(url);
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
                      await api.logout();
                      await queryClient.invalidateQueries({
                        queryKey: ["session"],
                      });
                      withViewTransition(() => {
                        void navigate({ to: "/login" });
                      });
                    }}
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full hidden md:inline-flex"
                onClick={async () => {
                  try {
                    const res = await api.exportData();
                    if (!res.ok) {
                      throw new Error("export failed");
                    }
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "show-ratings.json";
                    a.click();
                    window.URL.revokeObjectURL(url);
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
                className="rounded-full hidden md:inline-flex"
                onClick={async () => {
                  await api.logout();
                  await queryClient.invalidateQueries({
                    queryKey: ["session"],
                  });
                  withViewTransition(() => {
                    void navigate({ to: "/login" });
                  });
                }}
              >
                Log out
              </Button>
            </div>
          </div>
        </header>
      ) : null}
      <main className="container py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
};

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const session = await api.session().catch(() => ({ authenticated: false }));
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
    return session;
  },
  component: LibraryPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  beforeLoad: async () => {
    const session = await api.session().catch(() => ({ authenticated: false }));
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
    return session;
  },
  component: SearchPage,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/show/$showId",
  beforeLoad: async ({ params }) => {
    const session = await api.session().catch(() => ({ authenticated: false }));
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
    return { session, showId: Number(params.showId) };
  },
  component: DetailPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([indexRoute, searchRoute, detailRoute, loginRoute]);

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App(): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster richColors />
        {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
