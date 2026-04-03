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
import { ScrollToTop } from "./components/scroll-to-top";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { api, registerUnauthorizedHandler } from "./lib/api";
import { withViewTransition } from "./lib/view-transitions";
import { DetailPage } from "./pages/detail";
import { LibraryPage } from "./pages/library";
import { LoginPage } from "./pages/login";
import { SearchPage } from "./pages/search";
import { WatchOrderPage } from "./pages/watch-order";

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

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
    });
  }, []);

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

  const handleExportDB = async () => {
    const res = await api.exportDB();
    if (!res.ok) throw new Error("export failed");
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? "paired-ratings.db";
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
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
      <main className="mx-auto w-full px-4 py-16 sm:px-6 lg:max-w-[88vw] lg:px-8 xl:max-w-[84vw] xl:px-10 2xl:max-w-[80vw] 2xl:px-12">
        <Loading />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {authed ? <Navbar onExport={handleExport} onExportDB={handleExportDB} onLogout={handleLogout} /> : null}
      <main className="mx-auto w-full px-4 py-6 sm:px-6 md:py-8 lg:max-w-[88vw] lg:px-8 xl:max-w-[84vw] xl:px-10 2xl:max-w-[80vw] 2xl:px-12">
        <Outlet />
      </main>
      {authed ? <ScrollToTop /> : null}
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

type LibrarySearch = {
  status?: string;
  genre?: string;
  origin_country?: string;
  year_from?: string;
  year_to?: string;
  unrated?: string;
  sort?: string;
};

type SearchSearch = {
  q?: string;
  media_type?: string;
  year_from?: string;
  year_to?: string;
  min_rating?: string;
  min_votes?: string;
  sort?: string;
  genres?: string;
  origin_country?: string;
  original_language?: string;
  page?: string;
};

const parseSearchString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  validateSearch: (search): LibrarySearch => {
    if (!search || typeof search !== "object") return {};
    const params = search as Record<string, unknown>;
    const next: LibrarySearch = {};

    const status = parseSearchString(params.status);
    const genre = parseSearchString(params.genre);
    const origin_country = parseSearchString(params.origin_country);
    const year_from = parseSearchString(params.year_from);
    const year_to = parseSearchString(params.year_to);
    const unrated = parseSearchString(params.unrated);
    const sort = parseSearchString(params.sort);

    if (status) next.status = status;
    if (genre) next.genre = genre;
    if (origin_country) next.origin_country = origin_country;
    if (year_from) next.year_from = year_from;
    if (year_to) next.year_to = year_to;
    if (unrated) next.unrated = unrated;
    if (sort) next.sort = sort;

    return next;
  },
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
  validateSearch: (search): SearchSearch => {
    if (!search || typeof search !== "object") return {};
    const params = search as Record<string, unknown>;
    const next: SearchSearch = {};

    const q = parseSearchString(params.q);
    const media_type = parseSearchString(params.media_type);
    const year_from = parseSearchString(params.year_from);
    const year_to = parseSearchString(params.year_to);
    const min_rating = parseSearchString(params.min_rating);
    const min_votes = parseSearchString(params.min_votes);
    const sort = parseSearchString(params.sort);
    const genres = parseSearchString(params.genres);
    const origin_country = parseSearchString(params.origin_country);
    const original_language = parseSearchString(params.original_language);
    const page = parseSearchString(params.page);

    if (q) next.q = q;
    if (media_type) next.media_type = media_type;
    if (year_from) next.year_from = year_from;
    if (year_to) next.year_to = year_to;
    if (min_rating) next.min_rating = min_rating;
    if (min_votes) next.min_votes = min_votes;
    if (sort) next.sort = sort;
    if (genres) next.genres = genres;
    if (origin_country) next.origin_country = origin_country;
    if (original_language) next.original_language = original_language;
    if (page) next.page = page;

    return next;
  },
  component: SearchPage,
});

type DetailSearch = {
  from?: string;
};

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/show/$showId",
  beforeLoad: async ({ context }) => requireSession(context.queryClient),
  validateSearch: (search): DetailSearch => {
    if (!search || typeof search !== "object") return {};
    const from = (search as { from?: unknown }).from;
    if (typeof from === "string" && from.trim().length > 0) {
      return { from };
    }
    return {};
  },
  component: DetailPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
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
