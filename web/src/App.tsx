import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Loading } from "./components/loading";
import { Navbar } from "./components/navbar";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { api } from "./lib/api";
import { withViewTransition } from "./lib/view-transitions";
import { DetailPage } from "./pages/detail";
import { LibraryPage } from "./pages/library";
import { LoginPage } from "./pages/login";
import { SearchPage } from "./pages/search";

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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
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

  const handleExport = async () => {
    const res = await api.exportData();
    if (!res.ok) throw new Error("export failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "show-ratings.json";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await api.logout();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    withViewTransition(() => {
      void navigate({ to: "/login" });
    });
  };

  if (sessionQuery.isLoading) {
    return (
      <main className="container py-16">
        <Loading />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {authed ? <Navbar onExport={handleExport} onLogout={handleLogout} /> : null}
      <main className="container py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
};

const requireSession = async (queryClient: QueryClient) => {
  const session = await queryClient.ensureQueryData({
    queryKey: ["session"],
    queryFn: ({ signal }) => api.session({ signal }),
    staleTime: 60_000,
  });

  if (!session.authenticated) {
    throw redirect({ to: "/login" });
  }

  return session;
};

const rootRoute = createRootRouteWithContext<AppContext>()({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  component: LibraryPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  component: SearchPage,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/show/$showId",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
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
