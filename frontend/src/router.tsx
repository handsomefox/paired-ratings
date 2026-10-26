import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { RootLayout } from "./components/root-layout";
import { validateLibrarySearch } from "./features/library/library-search";
import { validateSearchPageSearch } from "./features/search/search-utils";
import { parseSearch, parseSearchString, stringifySearch } from "./lib/search-params";
import { sessionQueryOptions } from "./lib/queries";
import { DetailPage } from "./pages/detail";
import { LibraryPage } from "./pages/library";
import { LoginPage } from "./pages/login";
import { SearchPage } from "./pages/search";
import { WatchOrderPage } from "./pages/watch-order";

type AppContext = {
  queryClient: QueryClient;
};

const rootRoute = createRootRouteWithContext<AppContext>()({
  component: RootLayout,
});

// Every page but the login page sits under this layout, which has no path of
// its own and only checks the session.
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
});

const libraryRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  validateSearch: validateLibrarySearch,
  component: LibraryPage,
});

const watchOrderRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/watch-order",
  component: WatchOrderPage,
});

const searchRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/search",
  validateSearch: validateSearchPageSearch,
  component: SearchPage,
});

const detailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/show/$showId",
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
  authedRoute.addChildren([libraryRoute, watchOrderRoute, searchRoute, detailRoute]),
  loginRoute,
]);

/**
 * The app's router. Tests pass a memory history; the app uses the browser's.
 */
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: "intent",
    defaultViewTransition: true,
    scrollRestoration: true,
    parseSearch,
    stringifySearch,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
