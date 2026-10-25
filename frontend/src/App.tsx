import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { ScrollToTop } from "./components/scroll-to-top";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { api, registerUnauthorizedHandler } from "./lib/api";
import { downloadResponse } from "./lib/download";
import { parseSearch, parseSearchString, pickSearch, stringifySearch } from "./lib/search-params";
import { queryKeys, sessionQueryOptions, shouldRetry, useSession } from "./lib/queries";
import { DetailPage } from "./pages/detail";
import { LibraryPage } from "./pages/library";
import { LoginPage } from "./pages/login";
import { SearchPage } from "./pages/search";
import { WatchOrderPage } from "./pages/watch-order";

type AppContext = {
  queryClient: QueryClient;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});

// Any 401 means the cookie is gone. Refetching the session flips `authed` and
// RootLayout sends the reader to the login page.
registerUnauthorizedHandler(() => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.session });
});

const RootLayout = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sessionQuery = useSession();
  const authed = sessionQuery.data?.authenticated ?? false;

  useEffect(() => {
    if (sessionQuery.isLoading) return;
    if (!authed && !pathname.startsWith("/login")) {
      void navigate({ to: "/login" });
    }
  }, [authed, sessionQuery.isLoading, pathname, navigate]);

  const handleExport = async () => {
    await downloadResponse(await api.exportData(), "show-ratings.json");
  };

  const handleExportDB = async () => {
    await downloadResponse(await api.exportDB(), "paired-ratings.db");
  };

  const handleLogout = async () => {
    const session = await api.logout();
    // Drop every cached library page, not just the session, so nothing private
    // stays in memory after signing out.
    queryClient.clear();
    queryClient.setQueryData(queryKeys.session, session);
    await navigate({ to: "/login" });
  };

  if (sessionQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-[1720px] px-4 py-16 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <Loading />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {authed ? (
        <Navbar onExport={handleExport} onExportDB={handleExportDB} onLogout={handleLogout} />
      ) : null}
      <main className="mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 md:py-8 lg:px-8 xl:px-10 2xl:px-12">
        <Outlet />
      </main>
      {authed ? <ScrollToTop /> : null}
    </div>
  );
};

const requireSession = async (queryClient: QueryClient) => {
  const session = await queryClient.ensureQueryData(sessionQueryOptions);

  if (!session.authenticated) {
    throw redirect({ to: "/login" });
  }

  return session;
};

const rootRoute = createRootRouteWithContext<AppContext>()({
  component: RootLayout,
});

const librarySearchKeys = [
  "status",
  "genre",
  "origin_country",
  "year_from",
  "year_to",
  "unrated",
  "sort",
  "page",
  "page_size",
] as const;
type LibrarySearch = Partial<Record<(typeof librarySearchKeys)[number], string>>;

const searchPageKeys = [
  "q",
  "media_type",
  "year_from",
  "year_to",
  "min_rating",
  "min_votes",
  "sort",
  "genres",
  // Genre names from "Find similar". The search page resolves them to TMDB
  // genre ids once the genre list loads.
  "genre_names",
  "origin_country",
  "original_language",
  "page",
] as const;
type SearchPageSearch = Partial<Record<(typeof searchPageKeys)[number], string>>;

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  validateSearch: (search: Record<string, unknown>): LibrarySearch =>
    pickSearch(search, librarySearchKeys),
  component: LibraryPage,
});

const watchOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watch-order",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  component: WatchOrderPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  validateSearch: (search: Record<string, unknown>): SearchPageSearch =>
    pickSearch(search, searchPageKeys),
  component: SearchPage,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/show/$showId",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  validateSearch: (search: Record<string, unknown>): { from?: string } => {
    const from = parseSearchString(search.from);
    // Only an in-app path is a valid way back. "//host" would leave the site.
    if (from && from.startsWith("/") && !from.startsWith("//")) {
      return { from };
    }
    return {};
  },
  component: DetailPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session.authenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  watchOrderRoute,
  searchRoute,
  detailRoute,
  loginRoute,
]);

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultViewTransition: true,
  scrollRestoration: true,
  parseSearch,
  stringifySearch,
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
