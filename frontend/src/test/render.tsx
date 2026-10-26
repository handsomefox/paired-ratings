import { TooltipProvider } from "@/components/ui/tooltip";
import { createAppRouter } from "@/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithQuery(ui: ReactElement) {
  const client = testQueryClient();
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

/** Renders the whole app with its real routes, starting at `url`. */
export function renderApp(url: string) {
  const client = testQueryClient();
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createAppRouter(client, history);
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { client, history, router };
}

/** The validated search of the current page, as the page itself reads it. */
export function pageSearch(router: ReturnType<typeof createAppRouter>) {
  return router.state.matches.at(-1)?.search;
}
